"""Resource management for concurrent operations and rate limiting."""

import asyncio
import time
from collections import defaultdict, deque
from dataclasses import dataclass
from typing import Any, Dict, Optional

import structlog

logger = structlog.get_logger(__name__)


@dataclass
class RateLimitConfig:
    """Configuration for rate limiting."""

    requests_per_minute: int
    burst_size: int = 10
    window_size: int = 60  # seconds


class RateLimiter:
    """Token bucket rate limiter."""

    def __init__(self, requests_per_minute: int, burst_size: int = 10):
        self.rate = requests_per_minute / 60.0  # requests per second
        self.burst_size = burst_size
        self.tokens = float(burst_size)
        self.last_update = time.time()
        self._lock = asyncio.Lock()

        # Statistics
        self.total_requests = 0
        self.rejected_requests = 0
        self.wait_times = deque(maxlen=1000)

    async def acquire(self, tokens: int = 1) -> float:
        """
        Acquire tokens from the bucket.
        Returns wait time if rate limited.
        """
        async with self._lock:
            now = time.time()

            # Add tokens based on time elapsed
            elapsed = now - self.last_update
            self.tokens = min(self.burst_size, self.tokens + elapsed * self.rate)
            self.last_update = now

            self.total_requests += 1

            # Check if we have enough tokens
            if self.tokens >= tokens:
                self.tokens -= tokens
                self.wait_times.append(0.0)
                return 0.0
            else:
                # Calculate wait time
                deficit = tokens - self.tokens
                wait_time = deficit / self.rate

                # Wait and then acquire
                await asyncio.sleep(wait_time)

                # Update tokens after wait
                self.tokens = 0.0
                self.last_update = time.time()

                self.wait_times.append(wait_time)
                return wait_time

    async def try_acquire(self, tokens: int = 1) -> bool:
        """
        Try to acquire tokens without waiting.
        Returns True if successful, False otherwise.
        """
        async with self._lock:
            now = time.time()

            # Add tokens based on time elapsed
            elapsed = now - self.last_update
            self.tokens = min(self.burst_size, self.tokens + elapsed * self.rate)
            self.last_update = now

            self.total_requests += 1

            # Check if we have enough tokens
            if self.tokens >= tokens:
                self.tokens -= tokens
                return True
            else:
                self.rejected_requests += 1
                return False

    def get_stats(self) -> Dict[str, Any]:
        """Get rate limiter statistics."""
        avg_wait = (
            sum(self.wait_times) / len(self.wait_times) if self.wait_times else 0.0
        )

        return {
            "total_requests": self.total_requests,
            "rejected_requests": self.rejected_requests,
            "rejection_rate": self.rejected_requests / max(1, self.total_requests),
            "average_wait_time": avg_wait,
            "current_tokens": self.tokens,
            "max_tokens": self.burst_size,
            "rate_per_second": self.rate,
        }


class ResourceManager:
    """
    Manages system resources efficiently:
    - Semaphores for concurrency control
    - Rate limiters for API throttling
    - Resource allocation strategies
    - Performance monitoring
    """

    def __init__(self):
        # Semaphores for concurrent operations
        self.semaphores: Dict[str, asyncio.Semaphore] = {}

        # Rate limiters for API calls
        self.rate_limiters: Dict[str, RateLimiter] = {}

        # Resource usage tracking
        self._usage_stats = defaultdict(
            lambda: {
                "active": 0,
                "total_acquired": 0,
                "total_wait_time": 0.0,
                "max_concurrent": 0,
            }
        )

        # Default configurations
        self._default_configs = {
            "jira": {
                "max_concurrent": 20,
                "rate_limit": RateLimitConfig(requests_per_minute=100, burst_size=20),
            },
            "confluence": {
                "max_concurrent": 15,
                "rate_limit": RateLimitConfig(requests_per_minute=60, burst_size=15),
            },
            "assistant": {
                "max_concurrent": 10,
                "rate_limit": RateLimitConfig(requests_per_minute=30, burst_size=5),
            },
            "default": {
                "max_concurrent": 10,
                "rate_limit": RateLimitConfig(requests_per_minute=60, burst_size=10),
            },
        }

        # Initialize resources
        self._initialize_resources()

    def _initialize_resources(self) -> None:
        """Initialize semaphores and rate limiters."""
        for resource_type, config in self._default_configs.items():
            # Create semaphore
            self.semaphores[resource_type] = asyncio.Semaphore(config["max_concurrent"])

            # Create rate limiter
            rate_config = config["rate_limit"]
            self.rate_limiters[resource_type] = RateLimiter(
                requests_per_minute=rate_config.requests_per_minute,
                burst_size=rate_config.burst_size,
            )

        logger.info(
            "Resource manager initialized", resources=list(self.semaphores.keys())
        )

    def configure_resource(
        self,
        resource_type: str,
        max_concurrent: Optional[int] = None,
        rate_limit: Optional[RateLimitConfig] = None,
    ) -> None:
        """Configure resource limits."""
        if max_concurrent is not None:
            self.semaphores[resource_type] = asyncio.Semaphore(max_concurrent)
            logger.info(
                "Updated concurrency limit",
                resource=resource_type,
                max_concurrent=max_concurrent,
            )

        if rate_limit is not None:
            self.rate_limiters[resource_type] = RateLimiter(
                requests_per_minute=rate_limit.requests_per_minute,
                burst_size=rate_limit.burst_size,
            )
            logger.info(
                "Updated rate limit",
                resource=resource_type,
                rpm=rate_limit.requests_per_minute,
            )

    async def acquire(self, resource_type: str, wait: bool = True) -> bool:
        """
        Acquire resource for operation.

        Returns True if acquired, False if not available and wait=False.
        """
        # Get or create semaphore
        if resource_type not in self.semaphores:
            config = self._default_configs.get("default")
            self.semaphores[resource_type] = asyncio.Semaphore(config["max_concurrent"])

        semaphore = self.semaphores[resource_type]

        # Try to acquire semaphore
        start_time = time.time()

        if wait:
            await semaphore.acquire()
            acquired = True
        else:
            acquired = semaphore.locked() == False
            if acquired:
                await semaphore.acquire()

        if acquired:
            # Check rate limit
            rate_limiter = self.rate_limiters.get(
                resource_type, self.rate_limiters["default"]
            )

            wait_time = await rate_limiter.acquire()

            # Update statistics
            stats = self._usage_stats[resource_type]
            stats["active"] += 1
            stats["total_acquired"] += 1
            stats["total_wait_time"] += time.time() - start_time
            stats["max_concurrent"] = max(stats["max_concurrent"], stats["active"])

            logger.debug(
                "Resource acquired",
                resource=resource_type,
                active=stats["active"],
                wait_time=wait_time,
            )

        return acquired

    def release(self, resource_type: str) -> None:
        """Release resource after operation."""
        if resource_type in self.semaphores:
            self.semaphores[resource_type].release()

            # Update statistics
            stats = self._usage_stats[resource_type]
            stats["active"] = max(0, stats["active"] - 1)

            logger.debug(
                "Resource released", resource=resource_type, active=stats["active"]
            )

    async def acquire_multiple(
        self, resources: Dict[str, int], wait: bool = True
    ) -> bool:
        """
        Acquire multiple resources atomically.

        Args:
            resources: Dict of resource_type -> count needed
            wait: Whether to wait for resources

        Returns:
            True if all acquired, False otherwise
        """
        acquired = []

        try:
            for resource_type, count in resources.items():
                for _ in range(count):
                    if await self.acquire(resource_type, wait=wait):
                        acquired.append(resource_type)
                    else:
                        # Failed to acquire, release all
                        for acq_resource in acquired:
                            self.release(acq_resource)
                        return False

            return True

        except Exception:
            # Release any acquired resources on error
            for acq_resource in acquired:
                self.release(acq_resource)
            raise

    def get_availability(self, resource_type: str) -> Dict[str, Any]:
        """Get current resource availability."""
        semaphore = self.semaphores.get(resource_type)
        if not semaphore:
            return {"available": True, "active": 0, "limit": 0}

        stats = self._usage_stats[resource_type]
        config = self._default_configs.get(
            resource_type, self._default_configs["default"]
        )

        return {
            "available": not semaphore.locked(),
            "active": stats["active"],
            "limit": config["max_concurrent"],
            "utilization": stats["active"] / config["max_concurrent"],
        }

    def get_stats(self, resource_type: Optional[str] = None) -> Dict[str, Any]:
        """Get resource usage statistics."""
        if resource_type:
            stats = self._usage_stats[resource_type]
            rate_stats = self.rate_limiters.get(
                resource_type, self.rate_limiters["default"]
            ).get_stats()

            return {
                "usage": {
                    **stats,
                    "average_wait_time": (
                        stats["total_wait_time"] / max(1, stats["total_acquired"])
                    ),
                },
                "rate_limiting": rate_stats,
                "availability": self.get_availability(resource_type),
            }
        else:
            # Return stats for all resources
            all_stats = {}

            for res_type in set(
                list(self.semaphores.keys()) + list(self._usage_stats.keys())
            ):
                all_stats[res_type] = self.get_stats(res_type)

            return all_stats

    def reset_stats(self, resource_type: Optional[str] = None) -> None:
        """Reset usage statistics."""
        if resource_type:
            self._usage_stats[resource_type] = {
                "active": self._usage_stats[resource_type]["active"],
                "total_acquired": 0,
                "total_wait_time": 0.0,
                "max_concurrent": self._usage_stats[resource_type]["active"],
            }
        else:
            for res_type in self._usage_stats:
                self.reset_stats(res_type)

        logger.info("Resource statistics reset", resource=resource_type)


# Context manager for resource acquisition
class ResourceContext:
    """Context manager for automatic resource management."""

    def __init__(
        self, resource_manager: ResourceManager, resource_type: str, count: int = 1
    ):
        self.resource_manager = resource_manager
        self.resource_type = resource_type
        self.count = count
        self.acquired = 0

    async def __aenter__(self):
        """Acquire resources."""
        for _ in range(self.count):
            if await self.resource_manager.acquire(self.resource_type):
                self.acquired += 1
            else:
                # Failed to acquire all resources
                for _ in range(self.acquired):
                    self.resource_manager.release(self.resource_type)
                raise RuntimeError(
                    f"Failed to acquire {self.count} {self.resource_type} resources"
                )

        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Release resources."""
        for _ in range(self.acquired):
            self.resource_manager.release(self.resource_type)
