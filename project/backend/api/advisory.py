"""
API Router: Irrigation Advisory
GET /api/advisory
POST /api/advisory/field
GET /api/advisory/summary
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field as PydField
from typing import Literal
import time as _time
try:
    from project.ml.advisory_engine import (
        ADVISORY_RULES,
        generate_advisory,
        generate_bulk_advisories,
        get_command_area_advisories,
        get_regional_et0,
        get_summary_stats,
    )
    from project.ml.moisture_model import get_stress_category
except ImportError as e:
    print(f"[WARN] Falling back to local advisory imports: {e}")
    from ml.advisory_engine import (
        ADVISORY_RULES,
        generate_advisory,
        generate_bulk_advisories,
        get_command_area_advisories,
        get_regional_et0,
        get_summary_stats,
    )
    from ml.moisture_model import get_stress_category

router = APIRouter()

# Advisory cache — 5-minute TTL to avoid recomputing on every request
_ADVISORY_CACHE: dict = {}
_ADVISORY_TTL = 300  # seconds

# Sample fields — Karnataka-only (pilot area consistency)
SAMPLE_FIELDS = [
    {"field_id": "KAR-F001", "crop": "Rice",      "vci": 12,  "stage": "Vegetative", "rainfall_mm": 5,  "lat": 15.30, "lng": 75.71},
    {"field_id": "KAR-F002", "crop": "Sugarcane", "vci": 28,  "stage": "Flowering",  "rainfall_mm": 15, "lat": 15.45, "lng": 76.10},
    {"field_id": "KAR-F003", "crop": "Rice",      "vci": 45,  "stage": "Vegetative", "rainfall_mm": 30, "lat": 14.67, "lng": 76.82},
    {"field_id": "KAR-F004", "crop": "Maize",     "vci": 65,  "stage": "Maturity",   "rainfall_mm": 50, "lat": 13.00, "lng": 77.57},
    {"field_id": "KAR-F005", "crop": "Sugarcane", "vci": 18,  "stage": "Sowing",     "rainfall_mm": 3,  "lat": 15.85, "lng": 74.50},
    {"field_id": "KAR-F006", "crop": "Rice",      "vci": 82,  "stage": "Maturity",   "rainfall_mm": 70, "lat": 12.97, "lng": 77.59},
    {"field_id": "KAR-F007", "crop": "Others",    "vci": 35,  "stage": "Vegetative", "rainfall_mm": 20, "lat": 15.34, "lng": 75.13},
    {"field_id": "KAR-F008", "crop": "Maize",     "vci": 90,  "stage": "Flowering",  "rainfall_mm": 80, "lat": 16.83, "lng": 74.49},
    {"field_id": "KAR-F009", "crop": "Rice",      "vci": 22,  "stage": "Vegetative", "rainfall_mm": 8,  "lat": 14.22, "lng": 76.40},
    {"field_id": "KAR-F010", "crop": "Sugarcane", "vci": 55,  "stage": "Vegetative", "rainfall_mm": 35, "lat": 16.20, "lng": 74.78},
    {"field_id": "KAR-F011", "crop": "Maize",     "vci": 7,   "stage": "Flowering",  "rainfall_mm": 2,  "lat": 13.34, "lng": 77.10},
    {"field_id": "KAR-F012", "crop": "Rice",      "vci": 72,  "stage": "Maturity",   "rainfall_mm": 60, "lat": 12.30, "lng": 76.65},
]


@router.get("/advisory")
async def get_advisory():
    """Returns field-level irrigation advisories for all registered fields."""
    try:
        # Serve from cache when fresh
        cached = _ADVISORY_CACHE.get("advisories")
        if cached and (_time.time() - _ADVISORY_CACHE.get("ts", 0)) < _ADVISORY_TTL:
            return cached

        advisories = generate_bulk_advisories(SAMPLE_FIELDS)
        # Add coordinates for map visualization
        field_coords = {f["field_id"]: {"lat": f["lat"], "lng": f["lng"]} for f in SAMPLE_FIELDS}
        for a in advisories:
            coords = field_coords.get(a["field_id"], {})
            a["lat"] = coords.get("lat")
            a["lng"] = coords.get("lng")

        result = {
            "status": "success",
            "pilot_area": "Karnataka, India",
            "total_fields": len(advisories),
            "advisories": advisories,
            "advisory_rules": ADVISORY_RULES
        }
        _ADVISORY_CACHE["advisories"] = result
        _ADVISORY_CACHE["ts"] = _time.time()
        return result
    except Exception as e:
        print(f"[WARN] Advisory generation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/advisory/summary")
async def get_advisory_summary():
    """Returns summary statistics for the home dashboard."""
    try:
        cached_summary = _ADVISORY_CACHE.get("summary")
        if cached_summary and (_time.time() - _ADVISORY_CACHE.get("summary_ts", 0)) < _ADVISORY_TTL:
            return cached_summary

        # Reuse cached advisories if available
        cached = _ADVISORY_CACHE.get("advisories")
        if cached and (_time.time() - _ADVISORY_CACHE.get("ts", 0)) < _ADVISORY_TTL:
            advisories = cached["advisories"]
        else:
            advisories = generate_bulk_advisories(SAMPLE_FIELDS)
        summary = get_summary_stats(advisories)
        result = {"status": "success", "pilot_area": "Karnataka, India", **summary}
        _ADVISORY_CACHE["summary"] = result
        _ADVISORY_CACHE["summary_ts"] = _time.time()
        return result
    except Exception as e:
        print(f"[WARN] Advisory summary generation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))



class FieldInput(BaseModel):
    field_id:    str   = PydField(..., min_length=1, max_length=30, pattern=r"^[A-Za-z0-9_\-]+$")
    crop:        Literal["Rice", "Maize", "Sugarcane", "Others"]
    vci:         float = PydField(..., ge=0.0, le=100.0)
    stage:       Literal["Sowing", "Vegetative", "Flowering", "Maturity"]
    rainfall_mm: float = PydField(..., ge=0.0, le=2000.0)


@router.post("/advisory/field")
async def get_field_advisory(field: FieldInput):
    """Generate advisory for a single custom field."""
    try:
        regional_et0 = get_regional_et0(period_days=8)
        stress_cat = get_stress_category(field.vci)
        advisory = generate_advisory(
            field_id=field.field_id,
            crop=field.crop,
            stress_label=stress_cat["label"],
            vci=field.vci,
            stage=field.stage,
            rainfall_mm=field.rainfall_mm,
            regional_et0=regional_et0,
        )
        return {"status": "success", "pilot_area": "Karnataka, India", "advisory": advisory}
    except Exception as e:
        print(f"[WARN] Field advisory generation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/advisory/command-summary")
async def get_command_summary():
    """Returns aggregated command-area canal distributary water release strategies."""
    try:
        advisories = generate_bulk_advisories(SAMPLE_FIELDS)
        command_summaries = get_command_area_advisories(advisories)
        
        return {
            "status": "success",
            "pilot_area": "Karnataka, India",
            "total_command_distributaries": len(command_summaries),
            "command_areas": command_summaries
        }
    except Exception as e:
        print(f"[WARN] Command summary generation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
