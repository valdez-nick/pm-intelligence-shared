"""Multi-level cache implementation for performance optimization."""

import asyncio
import json
import time
from typing import Any, Dict, Optional, Union

import aiosqlite
import structlog
from cachetools import LRUCache, TTLCache

logger = structlog.get_logger(__name__)


class CacheStats:
    """Track cache statistics."""

    def __init__(self):
        self.hits = 0
        self.misses = 0
        self.evictions = 0
        self.promotions = 0

    @property
    def hit_rate(self) -> float:
        """Calculate cache hit rate."""
        total = self.hits + self.misses
        return self.hits / total if total > 0 else 0.0

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "hits": self.hits,
            "misses": self.misses,
            "evictions": self.evictions,
            "promotions": self.promotions,
            "hit_rate": self.hit_rate,
        }


class L1Cache:
    """In-memory LRU cache (fastest)."""

    def __init__(self, maxsize: int = 1000):
        self.cache = LRUCache(maxsize=maxsize)
        self.stats = CacheStats()

    async def get(self, key: str) -> Optional[Any]:
        """Get value from cache."""
        value = self.cache.get(key)
        if value is not None:
            self.stats.hits += 1
        else:
            self.stats.misses += 1
        return value

    async def set(self, key: str, value: Any) -> None:
        """Set value in cache."""
        # Check if we're evicting
        if len(self.cache) >= self.cache.maxsize and key not in self.cache:
            self.stats.evictions += 1

        self.cache[key] = value

    async def delete(self, key: str) -> None:
        """Delete value from cache."""
        self.cache.pop(key, None)

    async def clear(self) -> None:
        """Clear all cache entries."""
        self.cache.clear()

    def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics."""
        return {
            **self.stats.to_dict(),
            "size": len(self.cache),
            "maxsize": self.cache.maxsize,
        }


class L2Cache:
    """Redis cache (if available) - for distributed caching."""

    def __init__(self, redis_url: Optional[str] = None, ttl: int = 3600):
        self.redis_url = redis_url
        self.ttl = ttl
        self.stats = CacheStats()
        self.enabled = False

        # Try to import redis
        try:
            import redis.asyncio as redis

            self.redis = redis
            self.enabled = bool(redis_url)
        except ImportError:
            logger.warning("Redis not available, L2 cache disabled")
            self.redis = None

        self._client = None

    async def _get_client(self):
        """Get Redis client (lazy initialization)."""
        if not self.enabled or not self.redis:
            return None

        if self._client is None:
            self._client = await self.redis.from_url(self.redis_url)

        return self._client

    async def get(self, key: str) -> Optional[Any]:
        """Get value from cache."""
        client = await self._get_client()
        if not client:
            return None

        try:
            value = await client.get(f"pm_intel:{key}")
            if value:
                self.stats.hits += 1
                return json.loads(value)
            else:
                self.stats.misses += 1
                return None
        except Exception as e:
            logger.error("Redis get error", key=key, error=str(e))
            return None

    async def set(self, key: str, value: Any) -> None:
        """Set value in cache."""
        client = await self._get_client()
        if not client:
            return

        try:
            await client.setex(f"pm_intel:{key}", self.ttl, json.dumps(value))
        except Exception as e:
            logger.error("Redis set error", key=key, error=str(e))

    async def delete(self, key: str) -> None:
        """Delete value from cache."""
        client = await self._get_client()
        if not client:
            return

        try:
            await client.delete(f"pm_intel:{key}")
        except Exception as e:
            logger.error("Redis delete error", key=key, error=str(e))

    async def clear(self) -> None:
        """Clear all cache entries."""
        client = await self._get_client()
        if not client:
            return

        try:
            # Clear all pm_intel keys
            async for key in client.scan_iter(match="pm_intel:*"):
                await client.delete(key)
        except Exception as e:
            logger.error("Redis clear error", error=str(e))

    async def close(self) -> None:
        """Close Redis connection."""
        if self._client:
            await self._client.close()
            self._client = None

    def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics."""
        return {**self.stats.to_dict(), "enabled": self.enabled, "ttl": self.ttl}


class L3Cache:
    """SQLite cache (persistent)."""

    def __init__(self, db_path: str = "./data/cache.db"):
        self.db_path = db_path
        self.stats = CacheStats()
        self._db: Optional[aiosqlite.Connection] = None

    async def initialize(self) -> None:
        """Initialize database."""
        self._db = await aiosqlite.connect(self.db_path)

        # Create cache table
        await self._db.execute(
            """
            CREATE TABLE IF NOT EXISTS cache (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                expires_at INTEGER,
                created_at INTEGER NOT NULL
            )
        """
        )

        await self._db.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_expires_at 
            ON cache(expires_at)
        """
        )

        await self._db.commit()

    async def close(self) -> None:
        """Close database connection."""
        if self._db:
            await self._db.close()
            self._db = None

    async def get(self, key: str) -> Optional[Any]:
        """Get value from cache."""
        if not self._db:
            await self.initialize()

        # Clean expired entries
        await self._cleanup_expired()

        cursor = await self._db.execute(
            """
            SELECT value FROM cache 
            WHERE key = ? AND (expires_at IS NULL OR expires_at > ?)
        """,
            (key, int(time.time())),
        )

        row = await cursor.fetchone()

        if row:
            self.stats.hits += 1
            return json.loads(row[0])
        else:
            self.stats.misses += 1
            return None

    async def set(self, key: str, value: Any, ttl: Optional[int] = None) -> None:
        """Set value in cache."""
        if not self._db:
            await self.initialize()

        expires_at = int(time.time() + ttl) if ttl else None

        await self._db.execute(
            """
            INSERT OR REPLACE INTO cache (key, value, expires_at, created_at)
            VALUES (?, ?, ?, ?)
        """,
            (key, json.dumps(value), expires_at, int(time.time())),
        )

        await self._db.commit()

    async def delete(self, key: str) -> None:
        """Delete value from cache."""
        if not self._db:
            await self.initialize()

        await self._db.execute("DELETE FROM cache WHERE key = ?", (key,))
        await self._db.commit()

    async def clear(self) -> None:
        """Clear all cache entries."""
        if not self._db:
            await self.initialize()

        await self._db.execute("DELETE FROM cache")
        await self._db.commit()

    async def _cleanup_expired(self) -> None:
        """Remove expired entries."""
        cursor = await self._db.execute(
            """
            DELETE FROM cache 
            WHERE expires_at IS NOT NULL AND expires_at <= ?
        """,
            (int(time.time()),),
        )

        if cursor.rowcount > 0:
            self.stats.evictions += cursor.rowcount
            await self._db.commit()

    def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics."""
        return self.stats.to_dict()


class CacheManager:
    """
    Multi-level caching with:
    - L1: In-memory cache (LRU, 1000 items)
    - L2: Redis cache (optional, for distributed)
    - L3: SQLite cache (persistent)
    """

    def __init__(
        self,
        l1_size: int = 1000,
        l2_redis_url: Optional[str] = None,
        l2_ttl: int = 3600,
        l3_db_path: str = "./data/cache.db",
    ):
        self.l1_cache = L1Cache(maxsize=l1_size)
        self.l2_cache = L2Cache(redis_url=l2_redis_url, ttl=l2_ttl)
        self.l3_cache = L3Cache(db_path=l3_db_path)

        self._initialized = False

    async def initialize(self) -> None:
        """Initialize cache manager."""
        if self._initialized:
            return

        await self.l3_cache.initialize()
        self._initialized = True

        logger.info(
            "Cache manager initialized",
            l1_size=self.l1_cache.cache.maxsize,
            l2_enabled=self.l2_cache.enabled,
            l3_path=self.l3_cache.db_path,
        )

    async def close(self) -> None:
        """Close all cache connections."""
        await self.l2_cache.close()
        await self.l3_cache.close()

    async def get(self, key: str) -> Optional[Any]:
        """
        Get value from cache.
        Checks L1 -> L2 -> L3 in order.
        """
        # Try L1 cache first
        value = await self.l1_cache.get(key)
        if value is not None:
            return value

        # Try L2 cache
        value = await self.l2_cache.get(key)
        if value is not None:
            # Promote to L1
            await self._promote(key, value, to_level=1)
            return value

        # Try L3 cache
        value = await self.l3_cache.get(key)
        if value is not None:
            # Promote to L1 and L2
            await self._promote(key, value, to_level=2)
            return value

        return None

    async def set(
        self,
        key: str,
        value: Any,
        ttl: Optional[int] = None,
        levels: Optional[list] = None,
    ) -> None:
        """
        Set value in cache.

        Args:
            key: Cache key
            value: Value to cache
            ttl: Time to live in seconds
            levels: Which cache levels to set (default: all)
        """
        if levels is None:
            levels = [1, 2, 3]

        # Set in specified levels
        if 1 in levels:
            await self.l1_cache.set(key, value)

        if 2 in levels:
            await self.l2_cache.set(key, value)

        if 3 in levels:
            await self.l3_cache.set(key, value, ttl=ttl)

    async def delete(self, key: str) -> None:
        """Delete value from all cache levels."""
        await self.l1_cache.delete(key)
        await self.l2_cache.delete(key)
        await self.l3_cache.delete(key)

    async def clear(self, levels: Optional[list] = None) -> None:
        """
        Clear cache.

        Args:
            levels: Which cache levels to clear (default: all)
        """
        if levels is None:
            levels = [1, 2, 3]

        if 1 in levels:
            await self.l1_cache.clear()

        if 2 in levels:
            await self.l2_cache.clear()

        if 3 in levels:
            await self.l3_cache.clear()

    async def _promote(self, key: str, value: Any, to_level: int) -> None:
        """Promote value to higher cache levels."""
        if to_level >= 1:
            await self.l1_cache.set(key, value)
            self.l1_cache.stats.promotions += 1

        if to_level >= 2 and self.l2_cache.enabled:
            await self.l2_cache.set(key, value)
            self.l2_cache.stats.promotions += 1

    def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics for all levels."""
        return {
            "l1": self.l1_cache.get_stats(),
            "l2": self.l2_cache.get_stats(),
            "l3": self.l3_cache.get_stats(),
            "overall": {
                "total_hits": (
                    self.l1_cache.stats.hits
                    + self.l2_cache.stats.hits
                    + self.l3_cache.stats.hits
                ),
                "total_misses": (
                    self.l1_cache.stats.misses
                    + self.l2_cache.stats.misses
                    + self.l3_cache.stats.misses
                ),
                "overall_hit_rate": self._calculate_overall_hit_rate(),
            },
        }

    def _calculate_overall_hit_rate(self) -> float:
        """Calculate overall cache hit rate."""
        total_hits = (
            self.l1_cache.stats.hits
            + self.l2_cache.stats.hits
            + self.l3_cache.stats.hits
        )

        # Only count L1 misses as true misses (since L2/L3 are fallbacks)
        total_requests = self.l1_cache.stats.hits + self.l1_cache.stats.misses

        return total_hits / total_requests if total_requests > 0 else 0.0

    async def warm_cache(self, keys_values: Dict[str, Any]) -> None:
        """Pre-populate cache with known values."""
        for key, value in keys_values.items():
            await self.set(key, value)

        logger.info("Cache warmed", count=len(keys_values))
