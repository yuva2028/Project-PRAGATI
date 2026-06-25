"""
FastAPI Backend - Main Application
Project PRAGATI: AI-Driven Agriculture Dashboard
"""

import sys
from pathlib import Path
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

BACKEND_DIR = Path(__file__).resolve().parent
PROJECT_DIR = BACKEND_DIR.parent
REPO_ROOT = PROJECT_DIR.parent

for path in (REPO_ROOT, PROJECT_DIR):
    path_str = str(path)
    if path_str not in sys.path:
        sys.path.insert(0, path_str)

GEE_PROJECT = os.getenv("GEE_PROJECT", "pragati-hackathon")
gee_ready = False

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize GEE on startup - non-blocking so server always starts."""

    global gee_ready
    try:
        import ee
        service_account = os.getenv("GEE_SERVICE_ACCOUNT", "")
        key_file = os.getenv("GEE_KEY_FILE", "")
        from pathlib import Path as _Path
        key_path = _Path(key_file).resolve() if key_file else None

        if (
            service_account and key_path
            and key_path.exists()
            and key_path.suffix == ".json"
            and str(key_path).startswith(str(_Path.cwd()))
        ):
            credentials = ee.ServiceAccountCredentials(
                email=service_account,
                key_file=str(key_path),
            )
            ee.Initialize(credentials=credentials, project=GEE_PROJECT)
        else:
            ee.Initialize(project=GEE_PROJECT)

        gee_ready = True
        print("[OK] Google Earth Engine initialized successfully")
    except Exception as e:
        gee_ready = False
        print(f"[WARN] GEE not initialized (run 'earthengine authenticate'): {e}")
    yield

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
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ──────────────────────────────────────
try:
    from project.backend.api import advisory, crop, stress, analytics, tiles
except ImportError as e:
    print(f"[WARN] Falling back to backend router imports: {e}")
    from backend.api import advisory, crop, stress, analytics, tiles

app.include_router(crop.router,      prefix="/api", tags=["Crop Classification"])
app.include_router(stress.router,    prefix="/api", tags=["Moisture Stress"])
app.include_router(advisory.router,  prefix="/api", tags=["Irrigation Advisory"])
app.include_router(analytics.router, prefix="/api", tags=["Analytics"])
app.include_router(tiles.router,     prefix="/api", tags=["Map Tiles"])

@app.get("/")
def root():
    return {
        "project": "PRAGATI",
        "description": "AI-Driven Agriculture Monitoring System",
        "pilot_area": "Karnataka State, India",
        "status": "running",
        "gee_authenticated": gee_ready,
        "docs": "/docs"
    }

@app.get("/health")
def health():
    return {"status": "ok", "gee": gee_ready}
