"""
API Router: Irrigation Advisory
GET /api/advisory
POST /api/advisory/field
GET /api/advisory/summary
"""

from fastapi import APIRouter, HTTPException, Request
from fastapi_cache.decorator import cache
from pydantic import BaseModel, Field as PydField
from typing import Literal, Dict, Any, List
import logging
import time as _time

from backend.api.cache_utils import spatial_key_builder

logger = logging.getLogger(__name__)

from ml.advisory_engine import (
    ADVISORY_RULES,
    generate_advisory,
    generate_bulk_advisories,
    get_command_area_advisories,
    get_regional_et0,
    get_summary_stats,
    compute_crop_water_requirement,
    compute_water_deficit,
)
from ml.moisture_model import get_stress_category

router = APIRouter()

# Advisory cache — 5-minute TTL to avoid recomputing on every request
_ADVISORY_CACHE: dict = {}
_ADVISORY_TTL = 300  # seconds

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

def generate_synthetic_fields_at_coords(lat: float, lng: float) -> List[Dict]:
    import random
    # Seed with coords for reproducibility
    random.seed(int((abs(lat) + abs(lng)) * 10000))
    crops = ["Rice", "Maize", "Sugarcane", "Others"]
    stages = ["Sowing", "Vegetative", "Flowering", "Maturity"]
    fields = []
    for i in range(12):
        offset_lat = lat + random.uniform(-0.05, 0.05)
        offset_lng = lng + random.uniform(-0.05, 0.05)
        vci = random.uniform(5.0, 95.0)
        rainfall = random.uniform(0.0, 100.0)
        crop = crops[i % len(crops)]
        stage = random.choice(stages)
        fields.append({
            "field_id": f"SIM-{i+1:03d}",
            "crop": crop,
            "stage": stage,
            "vci": round(vci, 1),
            "rainfall_mm": round(rainfall, 1),
            "lat": offset_lat,
            "lng": offset_lng
        })
    return fields

async def get_fields_for_coords(lat: float = None, lng: float = None) -> List[Dict]:
    if lat is None or lng is None:
        return SAMPLE_FIELDS
    
    try:
        from project.ml.crop_classifier import get_inference_samples_from_gee
        from project.ml.moisture_model import compute_pixel_stress
        from project.gee.weather import get_rainfall_stats
    except ImportError:
        from ml.crop_classifier import get_inference_samples_from_gee
        from ml.moisture_model import compute_pixel_stress
        from gee.weather import get_rainfall_stats

    import asyncio
    try:
        # Try GEE
        df_live = await asyncio.to_thread(get_inference_samples_from_gee, lat, lng, 15)
        if df_live.empty:
            raise ValueError("No pixels found from Earth Engine.")
            
        r_stats = get_rainfall_stats(months_back=1)
        rain_mm = r_stats.get("precipitation_sum", 0) if r_stats else 0
        if rain_mm <= 0:
            rain_mm = 5.0
            
        fields_to_use = []
        for i, row in df_live.iterrows():
            ndvi_current = float(row.get('NDVI_t1', 0.5))
            ndvi_t2 = float(row.get('NDVI_t2', 0.5))
            ndvi_min = min(ndvi_current, ndvi_t2) - 0.1
            ndvi_max = max(ndvi_current, ndvi_t2) + 0.1
            ndwi = float(row.get('NDWI_t1', 0))
            vv = float(row.get('VV_t1', -15.0))
            vh = float(row.get('VH_t1', -20.0))
            
            stress = compute_pixel_stress(ndvi_current, ndvi_min, ndvi_max, ndwi, vv, vh)
            
            fields_to_use.append({
                "field_id": f"GEE-{i+1:03d}",
                "crop": "Unknown",
                "stage": stress["phenology_stage"],
                "vci": stress["vci"],
                "rainfall_mm": round(rain_mm * (1.0 + float(i % 3) * 0.1), 1),
                "lat": float(row["latitude"]),
                "lng": float(row["longitude"]),
            })
        return fields_to_use
    except Exception as e:
        logger.warning("Failed to fetch live GEE fields, using synthetic: %s", e)
        return generate_synthetic_fields_at_coords(lat, lng)




class AdvisoryItem(BaseModel):
    field_id: str
    crop: str
    growth_stage: str
    stress_level: str
    vci: float
    rainfall_mm: float
    crop_water_requirement_mm: float
    water_deficit_mm: float
    water_to_apply_mm: float
    urgency: str
    recommendation: str
    explanation: str
    confidence_score: float
    within_days: Any
    priority: str
    advisory_color: str
    lat: float = None
    lng: float = None

class AdvisoryResponse(BaseModel):
    status: str
    pilot_area: str
    total_fields: int
    advisories: List[AdvisoryItem]
    advisory_rules: Dict[str, Any]

@router.get("/advisory", response_model=AdvisoryResponse)
@cache(expire=3600, key_builder=spatial_key_builder)
async def get_advisory(request: Request, lat: float = None, lng: float = None):
    """Returns field-level irrigation advisories for actual fields."""
    try:
        fields_to_use = await get_fields_for_coords(lat, lng)
        advisories = generate_bulk_advisories(fields_to_use, lat, lng)
        
        result = {
            "status": "success",
            "pilot_area": "Karnataka, India",
            "total_fields": len(advisories),
            "advisories": advisories,
            "advisory_rules": ADVISORY_RULES
        }
        return result
    except Exception as e:
        logger.warning("Advisory generation failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


class SummaryResponse(BaseModel):
    status: str
    pilot_area: str
    total_fields: int
    critical_alerts: int
    high_alerts: int
    healthy_fields: int
    total_water_required_mm: float
    average_vci: float

@router.get("/advisory/summary", response_model=SummaryResponse)
@cache(expire=300)
async def get_advisory_summary(lat: float = None, lng: float = None):
    """Returns summary statistics for the home dashboard."""
    try:
        fields_to_use = await get_fields_for_coords(lat, lng)
        advisories = generate_bulk_advisories(fields_to_use, lat, lng)
        summary = get_summary_stats(advisories)
        result = {"status": "success", "pilot_area": "Karnataka, India", **summary}
        return result
    except Exception as e:
        logger.warning("Advisory summary generation failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e))



class FieldInput(BaseModel):
    field_id:    str   = PydField(..., min_length=1, max_length=30, pattern=r"^[A-Za-z0-9_\-]+$")
    crop:        Literal["Rice", "Maize", "Sugarcane", "Others"]
    vci:         float = PydField(..., ge=0.0, le=100.0)
    stage:       Literal["Sowing", "Vegetative", "Flowering", "Maturity"]
    rainfall_mm: float = PydField(..., ge=0.0, le=2000.0)


class FieldAdvisoryResponse(BaseModel):
    status: str
    pilot_area: str
    advisory: AdvisoryItem

@router.post("/advisory/field", response_model=FieldAdvisoryResponse)
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
        logger.warning("Field advisory generation failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


class CommandSummaryItem(BaseModel):
    command_area: str
    total_fields_monitored: int
    critical_fields: int
    high_stress_fields: int
    moderate_stress_fields: int
    average_vci: float
    total_crop_demand_mm: float
    total_rainfall_mm: float
    total_deficit_mm: float
    discharge_recommendation: str
    gate_action: str
    color: str
    water_deficit_ratio: float

class CommandSummaryResponse(BaseModel):
    status: str
    pilot_area: str
    total_command_distributaries: int
    command_areas: List[CommandSummaryItem]

@router.get("/advisory/command-summary", response_model=CommandSummaryResponse)
async def get_command_summary(lat: float = None, lng: float = None):
    """Returns aggregated command-area canal distributary water release strategies."""
    try:
        fields_to_use = await get_fields_for_coords(lat, lng)
        advisories = generate_bulk_advisories(fields_to_use, lat, lng)
        command_summaries = get_command_area_advisories(advisories)
        
        return {
            "status": "success",
            "pilot_area": "Karnataka, India",
            "total_command_distributaries": len(command_summaries),
            "command_areas": command_summaries
        }
    except Exception as e:
        logger.warning("Command summary generation failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e))
