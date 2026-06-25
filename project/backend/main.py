"""
FastAPI Backend - Main Application
Project PRAGATI: AI-Driven Agriculture Dashboard
"""

import os
import sys
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

# Ensure project root is in path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

GEE_PROJECT = os.getenv("GEE_PROJECT", "pragati-hackathon")
gee_ready = False

@asynccontextmanager
async def lifespan(app: FastAPI):
    global gee_ready
    """Initialize GEE on startup - non-blocking so server always starts."""
    try:
        import ee
        service_account = os.getenv("GEE_SERVICE_ACCOUNT", "")
        key_file = os.getenv("GEE_KEY_FILE", "")

        if service_account and key_file and os.path.exists(key_file):
            credentials = ee.ServiceAccountCredentials(email=service_account, key_file=key_file)
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

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ──────────────────────────────────────
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
        "pilot_area": "Karnataka State",
        "status": "running",
        "gee_authenticated": gee_ready,
        "docs": "/docs"
    }

@app.get("/health")
def health():
    return {"status": "ok", "gee": gee_ready}
