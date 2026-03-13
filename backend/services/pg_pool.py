"""
PostgreSQL connection pool for focus-web-app.
Uses asyncpg for async access to shared PostgreSQL database.
"""
import asyncpg
import logging
from config import POSTGRES_URL

logger = logging.getLogger(__name__)

_pool: asyncpg.Pool | None = None


async def init_pg_pool():
    """Initialize the PostgreSQL connection pool."""
    global _pool
    if not POSTGRES_URL:
        logger.warning("POSTGRES_URL not set — PostgreSQL features disabled")
        return
    try:
        _pool = await asyncpg.create_pool(POSTGRES_URL, min_size=1, max_size=5)
        logger.info("PostgreSQL pool initialized")
    except Exception as e:
        logger.error(f"Failed to init PostgreSQL pool: {e}")
        _pool = None


async def close_pg_pool():
    """Close the PostgreSQL connection pool."""
    global _pool
    if _pool:
        await _pool.close()
        _pool = None
        logger.info("PostgreSQL pool closed")


def get_pg_pool() -> asyncpg.Pool:
    """Return the current pool. Raises if not initialized."""
    if _pool is None:
        raise RuntimeError("PostgreSQL pool not initialized")
    return _pool
