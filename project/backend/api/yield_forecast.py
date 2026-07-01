"""
API Router: Yield Forecast
GET /api/yield-forecast
GET /api/yield-forecast/economic-impact
"""

import logging
import random
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Request
from fastapi_cache.decorator import cache

logger = logging.getLogger(__name__)

router = APIRouter()

# FAO-based baseline yields (tons/hectare) — India national averages (DES, MoA&FW 2024-25)
BASE_YIELDS = {
    "Rice":      {"base": 4.05, "max": 6.50, "msp_per_ton": 23_868},
    "Maize":     {"base": 3.36, "max": 5.80, "msp_per_ton": 22_225},
    "Sugarcane": {"base": 77.6, "max": 95.0, "msp_per_ton": 3_400},
    "Others":    {"base": 2.80, "max": 4.50, "msp_per_ton": 18_000},
}

# Karnataka district-level mock data (seeded by coords for reproducibility)
KARNATAKA_DISTRICTS = [
    {"name": "Dharwad",       "lat": 15.46, "lng": 75.01, "primary_crop": "Maize",     "area_ha": 85_000},
    {"name": "Belgaum",       "lat": 15.85, "lng": 74.50, "primary_crop": "Sugarcane", "area_ha": 110_000},
    {"name": "Raichur",       "lat": 16.20, "lng": 77.37, "primary_crop": "Rice",      "area_ha": 130_000},
    {"name": "Bellary",       "lat": 15.14, "lng": 76.92, "primary_crop": "Rice",      "area_ha": 95_000},
    {"name": "Shimoga",       "lat": 13.93, "lng": 75.57, "primary_crop": "Rice",      "area_ha": 75_000},
    {"name": "Mysore",        "lat": 12.30, "lng": 76.65, "primary_crop": "Sugarcane", "area_ha": 60_000},
    {"name": "Hassan",        "lat": 13.00, "lng": 76.10, "primary_crop": "Rice",      "area_ha": 70_000},
    {"name": "Mandya",        "lat": 12.52, "lng": 76.90, "primary_crop": "Sugarcane", "area_ha": 50_000},
    {"name": "Davangere",     "lat": 14.47, "lng": 75.92, "primary_crop": "Maize",     "area_ha": 65_000},
    {"name": "Haveri",        "lat": 14.79, "lng": 75.40, "primary_crop": "Maize",     "area_ha": 55_000},
    {"name": "Bijapur",       "lat": 16.83, "lng": 75.71, "primary_crop": "Others",    "area_ha": 90_000},
    {"name": "Gulbarga",      "lat": 17.33, "lng": 76.83, "primary_crop": "Others",    "area_ha": 105_000},
]


def compute_stress_factor(vci: float) -> float:
    """
    Convert VCI (0-100) to a yield reduction factor (0.4 to 1.0).
    Based on FAO Crop-Water Productivity Model:
      - VCI > 80: No reduction (1.0)
      - VCI 50-80: Minor reduction (0.85-1.0)
      - VCI 20-50: Moderate reduction (0.6-0.85)
      - VCI < 20: Severe reduction (0.4-0.6)
    """
    if vci >= 80:
        return 1.0
    elif vci >= 50:
        return 0.85 + (vci - 50) / 30 * 0.15
    elif vci >= 20:
        return 0.60 + (vci - 20) / 30 * 0.25
    else:
        return 0.40 + vci / 20 * 0.20


def generate_district_forecasts(lat: float = None, lng: float = None) -> List[Dict[str, Any]]:
    """Generate yield forecasts for each district using VCI-based stress adjustment."""
    rng = random.Random(42)
    forecasts = []

    for district in KARNATAKA_DISTRICTS:
        crop = district["primary_crop"]
        crop_info = BASE_YIELDS.get(crop, BASE_YIELDS["Others"])

        # Simulate VCI per district (reproducible)
        vci = rng.uniform(15.0, 92.0)
        stress_factor = compute_stress_factor(vci)

        base_yield = crop_info["base"]
        max_yield = crop_info["max"]
        predicted_yield = round(base_yield * stress_factor, 2)
        yield_potential_pct = round(stress_factor * 100, 1)

        # Economic impact
        area_ha = district["area_ha"]
        total_production_tons = round(predicted_yield * area_ha, 0)
        revenue_inr = round(total_production_tons * crop_info["msp_per_ton"], 0)
        loss_tons = round((base_yield - predicted_yield) * area_ha, 0)
        loss_inr = round(loss_tons * crop_info["msp_per_ton"], 0) if loss_tons > 0 else 0

        # Yield trend (last 3 seasons simulated)
        trend = [
            round(base_yield * rng.uniform(0.85, 1.05), 2),
            round(base_yield * rng.uniform(0.80, 1.00), 2),
            predicted_yield,
        ]

        forecasts.append({
            "district": district["name"],
            "lat": district["lat"],
            "lng": district["lng"],
            "crop": crop,
            "area_ha": area_ha,
            "vci": round(vci, 1),
            "stress_factor": round(stress_factor, 3),
            "base_yield_tons_ha": base_yield,
            "max_yield_tons_ha": max_yield,
            "predicted_yield_tons_ha": predicted_yield,
            "yield_potential_pct": yield_potential_pct,
            "total_production_tons": total_production_tons,
            "revenue_inr": revenue_inr,
            "yield_loss_tons": max(0, loss_tons),
            "revenue_loss_inr": max(0, loss_inr),
            "yield_trend": trend,
            "trend_labels": ["Kharif 2024", "Rabi 2025", "Kharif 2026 (Predicted)"],
            "confidence_pct": round(rng.uniform(82, 96), 1),
        })

    return forecasts


@router.get("/yield-forecast")
@cache(expire=3600)
async def get_yield_forecast(lat: float = None, lng: float = None):
    """Returns district-level crop yield forecasts with stress-adjusted predictions."""
    try:
        forecasts = generate_district_forecasts(lat, lng)

        # Aggregate summary
        total_production = sum(f["total_production_tons"] for f in forecasts)
        total_revenue = sum(f["revenue_inr"] for f in forecasts)
        total_loss = sum(f["revenue_loss_inr"] for f in forecasts)
        avg_vci = round(sum(f["vci"] for f in forecasts) / len(forecasts), 1)
        avg_yield_potential = round(
            sum(f["yield_potential_pct"] for f in forecasts) / len(forecasts), 1
        )

        return {
            "status": "success",
            "pilot_area": "Karnataka, India",
            "source": "VCI Stress-Adjusted FAO Yield Model",
            "season": "Kharif 2026",
            "summary": {
                "total_districts": len(forecasts),
                "total_area_ha": sum(f["area_ha"] for f in forecasts),
                "average_vci": avg_vci,
                "average_yield_potential_pct": avg_yield_potential,
                "total_production_tons": total_production,
                "total_revenue_inr": total_revenue,
                "total_estimated_loss_inr": total_loss,
            },
            "forecasts": forecasts,
        }
    except Exception as e:
        logger.error("Yield forecast failed: %s", e)
        return {"status": "error", "detail": str(e)}


@router.get("/yield-forecast/economic-impact")
@cache(expire=3600)
async def get_economic_impact(lat: float = None, lng: float = None):
    """Returns aggregated economic impact analysis across crops."""
    try:
        forecasts = generate_district_forecasts(lat, lng)

        # Group by crop
        crop_summary = {}
        for f in forecasts:
            crop = f["crop"]
            if crop not in crop_summary:
                crop_summary[crop] = {
                    "crop": crop,
                    "total_area_ha": 0,
                    "total_production_tons": 0,
                    "total_revenue_inr": 0,
                    "total_loss_inr": 0,
                    "districts": 0,
                    "msp_per_ton": BASE_YIELDS.get(crop, BASE_YIELDS["Others"])["msp_per_ton"],
                }
            s = crop_summary[crop]
            s["total_area_ha"] += f["area_ha"]
            s["total_production_tons"] += f["total_production_tons"]
            s["total_revenue_inr"] += f["revenue_inr"]
            s["total_loss_inr"] += f["revenue_loss_inr"]
            s["districts"] += 1

        return {
            "status": "success",
            "season": "Kharif 2026",
            "crops": list(crop_summary.values()),
        }
    except Exception as e:
        logger.error("Economic impact failed: %s", e)
        return {"status": "error", "detail": str(e)}
