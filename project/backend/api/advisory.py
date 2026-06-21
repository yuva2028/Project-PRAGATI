"""
API Router: Irrigation Advisory
GET /api/advisory
POST /api/advisory/field
GET /api/advisory/summary
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from ml.advisory_engine import (
    generate_bulk_advisories, generate_advisory, get_summary_stats,
    compute_water_deficit, ADVISORY_RULES
)
from ml.moisture_model import get_stress_category

router = APIRouter()

# Sample fields (in production, loaded from PostGIS database)
SAMPLE_FIELDS = [
    {"field_id": "F001", "crop": "Rice",      "vci": 12, "stage": "Vegetative", "rainfall_mm": 5,  "lat": 30.9, "lng": 75.8}, # Punjab
    {"field_id": "F002", "crop": "Maize",     "vci": 28, "stage": "Flowering",  "rainfall_mm": 15, "lat": 26.8, "lng": 80.9}, # UP
    {"field_id": "F003", "crop": "Sugarcane", "vci": 45, "stage": "Vegetative", "rainfall_mm": 30, "lat": 19.7, "lng": 75.7}, # Maharashtra
    {"field_id": "F004", "crop": "Rice",      "vci": 65, "stage": "Maturity",   "rainfall_mm": 50, "lat": 22.9, "lng": 87.8}, # WB
    {"field_id": "F005", "crop": "Maize",     "vci": 18, "stage": "Sowing",     "rainfall_mm": 3,  "lat": 23.2, "lng": 77.4}, # MP
    {"field_id": "F006", "crop": "Sugarcane", "vci": 82, "stage": "Maturity",   "rainfall_mm": 70, "lat": 15.9, "lng": 79.9}, # AP
    {"field_id": "F007", "crop": "Others",    "vci": 35, "stage": "Vegetative", "rainfall_mm": 20, "lat": 22.2, "lng": 71.1}, # Gujarat
    {"field_id": "F008", "crop": "Rice",      "vci": 90, "stage": "Flowering",  "rainfall_mm": 80, "lat": 15.3, "lng": 75.7}, # Karnataka
]


@router.get("/advisory")
async def get_advisory():
    """Returns field-level irrigation advisories for all registered fields."""
    try:
        advisories = generate_bulk_advisories(SAMPLE_FIELDS)
        # Add coordinates for map visualization
        field_coords = {f["field_id"]: {"lat": f["lat"], "lng": f["lng"]} for f in SAMPLE_FIELDS}
        for a in advisories:
            coords = field_coords.get(a["field_id"], {})
            a["lat"] = coords.get("lat")
            a["lng"] = coords.get("lng")

        return {
            "status": "success",
            "pilot_area": "India",
            "total_fields": len(advisories),
            "advisories": advisories,
            "advisory_rules": ADVISORY_RULES
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/advisory/summary")
async def get_advisory_summary():
    """Returns summary statistics for the home dashboard."""
    try:
        advisories = generate_bulk_advisories(SAMPLE_FIELDS)
        summary = get_summary_stats(advisories)
        return {"status": "success", **summary}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class FieldInput(BaseModel):
    field_id: str
    crop: str
    vci: float
    stage: str
    rainfall_mm: float

@router.post("/advisory/field")
async def get_field_advisory(field: FieldInput):
    """Generate advisory for a single custom field."""
    try:
        from ml.advisory_engine import get_regional_et0
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
        return {"status": "success", "advisory": advisory}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
