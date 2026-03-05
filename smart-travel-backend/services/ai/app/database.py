"""
Database connector for ML service.
Reads from the same Supabase/Postgres database as the Node.js API.
"""

import asyncpg
import logging
from typing import Any

logger = logging.getLogger("smart-travel-ml")


class Database:
    def __init__(self, database_url: str):
        self.database_url = database_url
        self.pool: asyncpg.Pool | None = None

    async def connect(self):
        if not self.database_url:
            logger.warning("No DATABASE_URL set. ML service will run without database.")
            return
        try:
            self.pool = await asyncpg.create_pool(
                self.database_url,
                min_size=2,
                max_size=10,
                command_timeout=30,
            )
            logger.info("Connected to database")
        except Exception as e:
            logger.error(f"Database connection failed: {e}")
            self.pool = None

    async def disconnect(self):
        if self.pool:
            await self.pool.close()
            logger.info("Database connection closed")

    async def get_all_places(self) -> list[dict[str, Any]]:
        """Load all places for building the search index."""
        if not self.pool:
            return []
        try:
            rows = await self.pool.fetch(
                "SELECT id, name, category, rating, lat, lng, photo, photo_credit FROM places ORDER BY name"
            )
            return [dict(r) for r in rows]
        except Exception as e:
            logger.error(f"Failed to load places: {e}")
            return []

    async def get_user_favorites(self, email: str) -> list[dict[str, Any]]:
        """Get a user's favorited places."""
        if not self.pool:
            return []
        try:
            rows = await self.pool.fetch(
                """
                SELECT p.id, p.name, p.category, p.rating, p.lat, p.lng
                FROM favorites f
                JOIN places p ON p.id = f.place_id
                WHERE f.user_email = $1
                """,
                email.lower(),
            )
            return [dict(r) for r in rows]
        except Exception as e:
            logger.error(f"Failed to load user favorites: {e}")
            return []

    async def get_user_trip_places(self, email: str) -> list[dict[str, Any]]:
        """Get all places from a user's trips."""
        if not self.pool:
            return []
        try:
            rows = await self.pool.fetch(
                """
                SELECT DISTINCT p.id, p.name, p.category, p.rating, p.lat, p.lng
                FROM trip_items ti
                JOIN trips t ON t.id = ti.trip_id
                JOIN places p ON p.id = ti.place_id
                WHERE t.owner_email = $1
                """,
                email.lower(),
            )
            return [dict(r) for r in rows]
        except Exception as e:
            logger.error(f"Failed to load user trip places: {e}")
            return []

    async def get_recent_activity(self, days: int = 7) -> list[dict[str, Any]]:
        """Get recent favorites and trip additions for trending detection."""
        if not self.pool:
            return []
        try:
            rows = await self.pool.fetch(
                """
                SELECT place_id, created_at, 'favorite' as activity_type
                FROM favorites
                WHERE created_at > NOW() - INTERVAL '1 day' * $1
                UNION ALL
                SELECT place_id, created_at, 'trip_add' as activity_type
                FROM trip_items
                WHERE created_at > NOW() - INTERVAL '1 day' * $1
                ORDER BY created_at DESC
                LIMIT 500
                """,
                days,
            )
            return [dict(r) for r in rows]
        except Exception as e:
            logger.error(f"Failed to load recent activity: {e}")
            return []
