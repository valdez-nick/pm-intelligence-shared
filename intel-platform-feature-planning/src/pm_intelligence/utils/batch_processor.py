"""Intelligent batch processing for optimized MCP operations."""

import asyncio
import time
from collections import defaultdict
from dataclasses import dataclass
from typing import Any, Callable, Dict, List, Optional

import structlog

logger = structlog.get_logger(__name__)


@dataclass
class BatchItem:
    """Individual item in a batch."""

    id: str
    operation: str
    params: Dict[str, Any]
    future: asyncio.Future
    timestamp: float
    retry_count: int = 0


class BatchProcessor:
    """
    Intelligent batching for MCP operations.
    Groups similar operations and executes them efficiently.
    """

    def __init__(
        self,
        batch_size: int = 50,
        wait_time: float = 0.5,
        max_retries: int = 3,
        adaptive: bool = True,
    ):
        self.batch_size = batch_size
        self.wait_time = wait_time
        self.max_retries = max_retries
        self.adaptive = adaptive

        # Pending items by operation type
        self.pending: Dict[str, List[BatchItem]] = defaultdict(list)

        # Batch processors by operation type
        self.processors: Dict[str, Callable] = {}

        # Timers for batch flushing
        self._timers: Dict[str, asyncio.Task] = {}

        # Lock for thread safety
        self._lock = asyncio.Lock()

        # Statistics
        self._stats = {
            "total_items": 0,
            "total_batches": 0,
            "total_failures": 0,
            "avg_batch_size": 0.0,
            "avg_wait_time": 0.0,
        }

        # Adaptive parameters
        self._adaptive_params = {
            "batch_sizes": defaultdict(lambda: self.batch_size),
            "wait_times": defaultdict(lambda: self.wait_time),
            "success_rates": defaultdict(lambda: 1.0),
        }

    def register_processor(
        self, operation: str, processor: Callable[[List[BatchItem]], Any]
    ) -> None:
        """Register a batch processor for an operation type."""
        self.processors[operation] = processor
        logger.debug("Registered batch processor", operation=operation)

    async def add(
        self, operation: str, params: Dict[str, Any], item_id: Optional[str] = None
    ) -> Any:
        """
        Add item to batch and wait for result.

        Returns the result when the batch is processed.
        """
        if operation not in self.processors:
            raise ValueError(f"No processor registered for operation: {operation}")

        # Create batch item
        future = asyncio.Future()
        item = BatchItem(
            id=item_id or f"{operation}_{time.time()}",
            operation=operation,
            params=params,
            future=future,
            timestamp=time.time(),
        )

        async with self._lock:
            self.pending[operation].append(item)
            self._stats["total_items"] += 1

            # Start timer if not already running
            if operation not in self._timers:
                wait_time = self._get_wait_time(operation)
                self._timers[operation] = asyncio.create_task(
                    self._flush_after_delay(operation, wait_time)
                )

            # Check if we should flush immediately
            batch_size = self._get_batch_size(operation)
            if len(self.pending[operation]) >= batch_size:
                asyncio.create_task(self._flush_batch(operation))

        # Wait for result
        return await future

    async def _flush_after_delay(self, operation: str, wait_time: float) -> None:
        """Flush batch after wait time expires."""
        await asyncio.sleep(wait_time)
        await self._flush_batch(operation)

    async def _flush_batch(self, operation: str) -> None:
        """Flush all pending items for an operation."""
        async with self._lock:
            if operation not in self.pending:
                return

            # Get items to process
            items = self.pending.pop(operation, [])

            # Cancel timer
            if operation in self._timers:
                self._timers[operation].cancel()
                del self._timers[operation]

        if not items:
            return

        # Process batch
        self._stats["total_batches"] += 1

        # Update average batch size
        current_avg = self._stats["avg_batch_size"]
        total_batches = self._stats["total_batches"]
        self._stats["avg_batch_size"] = (
            current_avg * (total_batches - 1) + len(items)
        ) / total_batches

        # Execute processor
        processor = self.processors[operation]
        start_time = time.time()

        try:
            await processor(items)

            # Update success rate if adaptive
            if self.adaptive:
                self._update_success_rate(operation, 1.0)
                self._adapt_parameters(operation, len(items), time.time() - start_time)

        except Exception as e:
            logger.error(
                "Batch processing failed",
                operation=operation,
                batch_size=len(items),
                error=str(e),
            )

            # Update failure stats
            self._stats["total_failures"] += len(items)

            # Update success rate if adaptive
            if self.adaptive:
                self._update_success_rate(operation, 0.0)

            # Handle retries
            await self._handle_failed_batch(items, e)

    async def _handle_failed_batch(
        self, items: List[BatchItem], error: Exception
    ) -> None:
        """Handle failed batch items."""
        retry_items = []

        for item in items:
            if item.retry_count < self.max_retries:
                # Retry item
                item.retry_count += 1
                retry_items.append(item)
            else:
                # Max retries exceeded
                item.future.set_exception(error)

        # Re-queue retry items
        if retry_items:
            async with self._lock:
                for item in retry_items:
                    self.pending[item.operation].append(item)

            # Schedule retry with exponential backoff
            for operation in set(item.operation for item in retry_items):
                wait_time = self._get_wait_time(operation) * (
                    2 ** retry_items[0].retry_count
                )

                if operation not in self._timers:
                    self._timers[operation] = asyncio.create_task(
                        self._flush_after_delay(operation, wait_time)
                    )

    def _get_batch_size(self, operation: str) -> int:
        """Get adaptive batch size for operation."""
        if self.adaptive:
            return int(self._adaptive_params["batch_sizes"][operation])
        return self.batch_size

    def _get_wait_time(self, operation: str) -> float:
        """Get adaptive wait time for operation."""
        if self.adaptive:
            return self._adaptive_params["wait_times"][operation]
        return self.wait_time

    def _update_success_rate(self, operation: str, success: float) -> None:
        """Update success rate for operation."""
        current_rate = self._adaptive_params["success_rates"][operation]
        # Exponential moving average
        alpha = 0.1
        self._adaptive_params["success_rates"][operation] = (
            alpha * success + (1 - alpha) * current_rate
        )

    def _adapt_parameters(
        self, operation: str, batch_size: int, processing_time: float
    ) -> None:
        """Adapt batch size and wait time based on performance."""
        success_rate = self._adaptive_params["success_rates"][operation]

        # Adapt batch size
        current_batch_size = self._adaptive_params["batch_sizes"][operation]

        if success_rate > 0.95:
            # High success rate - increase batch size
            new_batch_size = min(current_batch_size * 1.1, self.batch_size * 2)
        elif success_rate < 0.8:
            # Low success rate - decrease batch size
            new_batch_size = max(current_batch_size * 0.9, 1)
        else:
            new_batch_size = current_batch_size

        self._adaptive_params["batch_sizes"][operation] = int(new_batch_size)

        # Adapt wait time based on processing time
        items_per_second = (
            batch_size / processing_time if processing_time > 0 else batch_size
        )

        if items_per_second > 100:
            # Fast processing - can wait longer for larger batches
            new_wait_time = min(self.wait_time * 1.2, 2.0)
        elif items_per_second < 10:
            # Slow processing - flush more frequently
            new_wait_time = max(self.wait_time * 0.8, 0.1)
        else:
            new_wait_time = self.wait_time

        self._adaptive_params["wait_times"][operation] = new_wait_time

        logger.debug(
            "Adapted batch parameters",
            operation=operation,
            batch_size=int(new_batch_size),
            wait_time=new_wait_time,
            success_rate=success_rate,
        )

    async def flush_all(self) -> None:
        """Flush all pending batches."""
        operations = list(self.pending.keys())

        for operation in operations:
            await self._flush_batch(operation)

    def get_stats(self) -> Dict[str, Any]:
        """Get batch processor statistics."""
        return {
            **self._stats,
            "pending_items": sum(len(items) for items in self.pending.values()),
            "active_timers": len(self._timers),
            "adaptive_params": {
                operation: {
                    "batch_size": int(self._adaptive_params["batch_sizes"][operation]),
                    "wait_time": self._adaptive_params["wait_times"][operation],
                    "success_rate": self._adaptive_params["success_rates"][operation],
                }
                for operation in self._adaptive_params["batch_sizes"].keys()
            },
        }

    async def shutdown(self) -> None:
        """Shutdown batch processor gracefully."""
        # Cancel all timers
        for timer in self._timers.values():
            timer.cancel()
        self._timers.clear()

        # Flush all pending batches
        await self.flush_all()

        logger.info("Batch processor shutdown", stats=self.get_stats())
