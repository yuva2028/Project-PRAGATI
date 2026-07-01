"""
FastAPI Backend - Main Application
Project PRAGATI: AI-Driven Agriculture Dashboard
"""

import os
import logging
import sys
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
load_dotenv(Path(__file__).resolve().parent / ".env")
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from prometheus_fastapi_instrumentator import Instrumentator
from fastapi_cache import FastAPICache
from fastapi_cache.backends.inmemory import InMemoryBackend
from fastapi_cache.backends.redis import RedisBackend
from redis import asyncio as aioredis

_log = logging.getLogger(__name__)

BACKEND_DIR = Path(__file__).resolve().parent
PROJECT_DIR = BACKEND_DIR.parent
REPO_ROOT = PROJECT_DIR.parent

for path in (REPO_ROOT, PROJECT_DIR):
    path_str = str(path)
    if path_str not in sys.path:
        sys.path.insert(0, path_str)

GEE_PROJECT = os.getenv("GEE_PROJECT", "pragati-hackathon")

# Initialize Database
from backend.database import engine
from backend.models import user
user.Base.metadata.create_all(bind=engine)

import asyncio
from backend.api.cache_utils import spatial_key_builder

async def warmup_cache_worker(app: FastAPI):
    """Background task to pre-fetch and warm up the GEE cache for Karnataka."""
    await asyncio.sleep(5)  # Wait for server to fully start
    _log.info("Starting background cache warmup for Karnataka (15.3, 75.7)")
    
    # Karnataka default coordinates
    lat, lng = 15.3, 75.7
    
    while True:
        try:
            if getattr(app.state, "gee_ready", False):
                from backend.api.crop import get_crop_geojson
                from backend.api.stress import get_stress_geojson
                from backend.api.advisory import get_advisory
                from starlette.requests import Request
                
                # Mock a request object for the spatial_key_builder
                class MockRequest:
                    query_params = {"lat": lat, "lng": lng}
                mock_req = MockRequest()
                
                # We simply call the underlying functions to trigger the GEE extraction 
                # (which itself might be cached or the cache decorator catches it if we hit the endpoint)
                # Wait, calling the function directly bypasses HTTP but triggers the @cache decorator!
                _log.info("Warming up crop-geojson cache...")
                await get_crop_geojson(mock_req, lat=lat, lng=lng)
                
                _log.info("Warming up stress-geojson cache...")
                await get_stress_geojson(mock_req, lat=lat, lng=lng)
                
                _log.info("Warming up advisory cache...")
                await get_advisory(mock_req, lat=lat, lng=lng)
                
                _log.info("Cache warmup complete.")
                
            # Sleep for 12 hours before refreshing the cache
            await asyncio.sleep(12 * 3600)
        except Exception as e:
            _log.warning("Background cache warmup failed: %s", e)
            await asyncio.sleep(3600)  # Retry in an hour

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize GEE on startup - non-blocking so server always starts."""
    try:
        import ee
        service_account = os.getenv("GEE_SERVICE_ACCOUNT", "")
        key_file = os.getenv("GEE_KEY_FILE", "")
        from pathlib import Path as _P

        key_path = _P(key_file).resolve() if key_file else _P(".")
        _allowed_key_dir = _P(
            os.getenv("GEE_KEY_DIR", str(_P(__file__).resolve().parent))
        ).resolve()
        try:
            key_path.resolve().relative_to(_allowed_key_dir)
            _key_in_allowed_dir = True
        except ValueError:
            _key_in_allowed_dir = False

        if (
            service_account and key_file
            and key_path.exists()
            and key_path.suffix == ".json"
            and _key_in_allowed_dir
        ):
            credentials = ee.ServiceAccountCredentials(
                email=service_account,
                key_file=str(key_path),
            )
            ee.Initialize(credentials=credentials, project=GEE_PROJECT)
        else:
            ee.Initialize(project=GEE_PROJECT)

        app.state.gee_ready = True
        _log.info("Google Earth Engine initialized successfully")
    except Exception as e:
        app.state.gee_ready = False
        _log.warning("GEE not initialized (run 'earthengine authenticate'): %s", e)

    # Initialize FastAPICache
    redis_url = os.getenv("REDIS_URL")
    if redis_url:
        try:
            redis = aioredis.from_url(redis_url)
            # Try to ping redis to ensure connection is actually alive
            await redis.ping()
            FastAPICache.init(RedisBackend(redis), prefix="fastapi-cache")
            _log.info("FastAPICache initialized (RedisBackend)")
        except Exception as e:
            _log.warning(f"Redis initialization failed: {e}. Falling back to SQLiteCacheBackend.")
            try:
                from backend.api.cache_utils import SQLiteCacheBackend
                FastAPICache.init(SQLiteCacheBackend(), prefix="fastapi-cache")
                _log.info("FastAPICache initialized (SQLiteCacheBackend)")
            except Exception as ex:
                _log.warning(f"SQLiteCacheBackend failed: {ex}. Falling back to InMemoryBackend.")
                FastAPICache.init(InMemoryBackend(), prefix="fastapi-cache")
                _log.info("FastAPICache initialized (InMemoryBackend)")
    else:
        try:
            from backend.api.cache_utils import SQLiteCacheBackend
            FastAPICache.init(SQLiteCacheBackend(), prefix="fastapi-cache")
            _log.info("FastAPICache initialized (SQLiteCacheBackend)")
        except Exception as ex:
            _log.warning(f"SQLiteCacheBackend failed: {ex}. Falling back to InMemoryBackend.")
            FastAPICache.init(InMemoryBackend(), prefix="fastapi-cache")
            _log.info("FastAPICache initialized (InMemoryBackend)")

    # Start background cache warmer
    bg_task = asyncio.create_task(warmup_cache_worker(app))

    yield
    
    bg_task.cancel()

# ── FastAPI App ─────────────────────────────────
app = FastAPI(
    title="Project PRAGATI API",
    description="AI-Driven Crop Classification, Moisture Stress & Irrigation Advisory System",
    version="1.0.0",
    lifespan=lifespan
)

_origins = os.getenv("FRONTEND_URL", "http://localhost:5173")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[_origins, "http://localhost:3000", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Instrument FastAPI with Prometheus
Instrumentator().instrument(app).expose(app)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    _log.error(f"Global exception: {exc}")
    return JSONResponse(
        status_code=500,
        content={"detail": "An internal server error occurred.", "error": str(exc)},
    )

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
    )

try:
    from backend.api import advisory, crop, stress, analytics, tiles, auth, chatbot
    from backend.api import yield_forecast, weather_forecast, alerts
except ImportError as e:
    _log.warning("Falling back to project backend router imports: %s", e)
    from project.backend.api import advisory, crop, stress, analytics, tiles, auth, chatbot
    from project.backend.api import yield_forecast, weather_forecast, alerts

app.include_router(auth.router,              prefix="/api/auth", tags=["Authentication"])
app.include_router(crop.router,              prefix="/api", tags=["Crop Classification"])
app.include_router(stress.router,            prefix="/api", tags=["Moisture Stress"])
app.include_router(advisory.router,          prefix="/api", tags=["Irrigation Advisory"])
app.include_router(analytics.router,         prefix="/api", tags=["Analytics"])
app.include_router(tiles.router,             prefix="/api", tags=["Map Tiles"])
app.include_router(chatbot.router,           prefix="/api", tags=["AI Chatbot"])
app.include_router(yield_forecast.router,    prefix="/api", tags=["Yield Forecast"])
app.include_router(weather_forecast.router,  prefix="/api", tags=["Weather Forecast"])
app.include_router(alerts.router,            prefix="/api", tags=["Alert Center"])


@app.get("/")
def root(request: Request):
    return {
        "project": "PRAGATI",
        "description": "AI-Driven Agriculture Monitoring System",
        "pilot_area": "Karnataka, India",
        "status": "running",
        "gee_authenticated": getattr(request.app.state, "gee_ready", False),
        "docs": "/docs"
    }

@app.get("/health")
def health(request: Request):
    return {"status": "ok", "gee": getattr(request.app.state, "gee_ready", False)}
