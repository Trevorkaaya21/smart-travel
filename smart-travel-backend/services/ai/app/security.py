"""
Security utilities for ML service.
Rate limiting, API key validation, and input sanitization.
"""

import time
import logging
from collections import defaultdict
from fastapi import HTTPException

logger = logging.getLogger("smart-travel-ml")


class RateLimiter:
    """
    In-memory sliding window rate limiter.
    Thread-safe for single-process async (FastAPI default).
    """

    def __init__(self, max_requests: int = 120, window_seconds: int = 60):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._requests: dict[str, list[float]] = defaultdict(list)

    def check(self, client_id: str):
        """Raise 429 if rate limit exceeded."""
        now = time.time()
        window_start = now - self.window_seconds

        # Clean old entries
        self._requests[client_id] = [
            t for t in self._requests[client_id] if t > window_start
        ]

        if len(self._requests[client_id]) >= self.max_requests:
            logger.warning(f"Rate limit exceeded for {client_id}")
            raise HTTPException(
                status_code=429,
                detail="Too many requests. Please try again later.",
                headers={"Retry-After": str(self.window_seconds)},
            )

        self._requests[client_id].append(now)

        # Periodic cleanup of old clients
        if len(self._requests) > 10000:
            self._cleanup()

    def _cleanup(self):
        """Remove stale entries."""
        now = time.time()
        cutoff = now - self.window_seconds * 2
        stale = [k for k, v in self._requests.items() if not v or v[-1] < cutoff]
        for k in stale:
            del self._requests[k]


def validate_api_key(api_key: str | None, expected: str | None) -> bool:
    """Constant-time API key comparison."""
    if not expected:
        return True
    if not api_key:
        return False

    import hmac
    return hmac.compare_digest(api_key.encode(), expected.encode())


def sanitize_input(text: str, max_length: int = 500) -> str:
    """Sanitize user input: strip, truncate, remove control characters."""
    if not text:
        return ""
    cleaned = "".join(c for c in text if c.isprintable() or c in ("\n", "\t"))
    return cleaned.strip()[:max_length]
