from starlette.requests import Request
from starlette.responses import Response
import sqlite3
import time
from pathlib import Path
from fastapi_cache.backends import Backend

class SQLiteCacheBackend(Backend):
    """
    Persistent SQLite-based cache backend for FastAPICache.
    Prevents Google Earth Engine latency on server restarts during local demos.
    """
    def __init__(self, db_path: str = None):
        if db_path is None:
            db_dir = Path(__file__).resolve().parent.parent / "database"
            db_dir.mkdir(parents=True, exist_ok=True)
            db_path = str(db_dir / "cache.db")
        self.db_path = db_path
        self._init_db()

    def _init_db(self):
        with sqlite3.connect(self.db_path) as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS cache (
                    key TEXT PRIMARY KEY,
                    value TEXT,
                    expires_at REAL
                )
                """
            )
            # Clean up expired items on startup
            conn.execute("DELETE FROM cache WHERE expires_at < ?", (time.time(),))
            conn.commit()

    async def get(self, key: str) -> str | None:
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute("SELECT value, expires_at FROM cache WHERE key = ?", (key,))
            row = cursor.fetchone()
            if row:
                value, expires_at = row
                if expires_at > time.time():
                    return value
                else:
                    conn.execute("DELETE FROM cache WHERE key = ?", (key,))
                    conn.commit()
        return None

    async def set(self, key: str, value: str, expire: int = None) -> None:
        expires_at = time.time() + (expire or 3600)
        with sqlite3.connect(self.db_path) as conn:
            conn.execute(
                "INSERT OR REPLACE INTO cache (key, value, expires_at) VALUES (?, ?, ?)",
                (key, value, expires_at),
            )
            conn.commit()

    async def clear(self, namespace: str = None, key: str = None) -> int:
        count = 0
        with sqlite3.connect(self.db_path) as conn:
            if key:
                cursor = conn.execute("DELETE FROM cache WHERE key = ?", (key,))
                count = cursor.rowcount
            elif namespace:
                cursor = conn.execute("DELETE FROM cache WHERE key LIKE ?", (f"{namespace}%",))
                count = cursor.rowcount
            else:
                cursor = conn.execute("DELETE FROM cache")
                count = cursor.rowcount
            conn.commit()
        return count


def spatial_key_builder(
    func,
    namespace: str = "",
    request: Request = None,
    response: Response = None,
    *args,
    **kwargs,
):
    """
    Custom cache key builder for geospatial endpoints.
    Rounds latitude and longitude to 1 decimal place (~11km grid).
    This ensures that minor map pans hit the cache instead of triggering
    expensive Google Earth Engine recalculations.
    """
    # Try to get lat/lng from kwargs
    lat = kwargs.get("lat")
    lng = kwargs.get("lng")
    
    # Fallback to query params if available
    if request:
        if lat is None:
            lat = request.query_params.get("lat")
        if lng is None:
            lng = request.query_params.get("lng")
            
    if lat is not None and lng is not None:
        try:
            # Round to 1 decimal place (~11km grid)
            rounded_lat = round(float(lat), 1)
            rounded_lng = round(float(lng), 1)
            cache_key = f"{func.__module__}:{func.__name__}:{rounded_lat}:{rounded_lng}"
        except (ValueError, TypeError):
            # Fallback if casting fails
            cache_key = f"{func.__module__}:{func.__name__}:invalid_coords"
    else:
        cache_key = f"{func.__module__}:{func.__name__}:default"
        
    return f"{namespace}:{cache_key}"

