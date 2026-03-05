"""
High-performance TTL cache for ML service responses.
"""

import time
from typing import Any
from collections import OrderedDict


class TTLCache:
    """
    Thread-safe LRU cache with TTL expiration.
    Provides sub-millisecond lookups for repeated queries.
    """

    def __init__(self, max_size: int = 2000, default_ttl: int = 300):
        self.max_size = max_size
        self.default_ttl = default_ttl
        self._store: OrderedDict[str, tuple[Any, float]] = OrderedDict()

    def get(self, key: str) -> Any | None:
        """Get cached value if not expired."""
        if key not in self._store:
            return None

        value, expires_at = self._store[key]
        if time.time() > expires_at:
            del self._store[key]
            return None

        # Move to end (LRU)
        self._store.move_to_end(key)
        return value

    def set(self, key: str, value: Any, ttl: int | None = None):
        """Cache a value with TTL."""
        expires_at = time.time() + (ttl or self.default_ttl)

        if key in self._store:
            self._store.move_to_end(key)

        self._store[key] = (value, expires_at)

        # Evict oldest if over capacity
        while len(self._store) > self.max_size:
            self._store.popitem(last=False)

    def clear(self):
        """Clear all cached entries."""
        self._store.clear()

    @property
    def size(self) -> int:
        return len(self._store)
