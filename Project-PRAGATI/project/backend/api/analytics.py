"""
API Router: Analytics & Time Series
GET /api/ndvi
GET /api/rainfall
GET /api/rainfall-series
GET /api/analytics
"""

from fastapi import APIRouter, HTTPException
from datetime import datetime, timedelta
import logging
import math

logger = logging.getLogger(__name__)

try:
    from project.backend.utils.ndvi_series import generate_synthetic_ndvi_series, get_phenology_metrics
except ImportError as e:
    logger.warning("Falling back to backend NDVI utility import: %s", e)
    from backend.utils.ndvi_series import generate_synthetic_ndvi_series, get_phenology_metrics

router = APIRouter()


@router.get("/ndvi")
async def get_ndvi_series(lat: float = None, lng: float = None):
    """Returns NDVI time series from Sentinel-2 via GEE."""
    try:
        from project.ml.moisture_model import get_ndvi_time_series_for_stress
    except ImportError as e:
        logger.warning("Falling back to local NDVI series import: %s", e)
        from ml.moisture_model import get_ndvi_time_series_for_stress
    
    try:
        import asyncio
        res = await asyncio.to_thread(get_ndvi_time_series_for_stress, lat, lng)
        if res.get("time_series"):
            return {
                "status": "success",
                "source": "Sentinel-2 via GEE",
                "data": res["time_series"],
                "metrics": res["metrics"],
            }
        else:
            raise ValueError("GEE returned empty NDVI series")
    except Exception as e:
        logger.warning("Live NDVI series unavailable, falling back to synthetic: %s", e)
        series = generate_synthetic_ndvi_series(lat, lng)
        metrics = get_phenology_metrics(series)
        return {
            "status": "success",
            "source": "Sentinel-2 | Karnataka Kharif Season Model (Fallback)",
            "data": series,
            "metrics": metrics,
        }


@router.get("/rainfall")
async def get_rainfall(lat: float = None, lng: float = None):
    """Returns CHIRPS rainfall stats via GEE."""
    try:
        from project.gee.weather import get_rainfall_stats
    except ImportError as e:
        logger.warning("Falling back to local rainfall import: %s", e)
        from gee.weather import get_rainfall_stats
        
    try:
        stats = get_rainfall_stats(months_back=6, lat=lat, lng=lng)
        p_sum  = stats.get("precipitation_sum")
        p_mean = stats.get("precipitation_mean") if stats else None
        if p_sum and p_sum > 0:
            return {
                "status": "success",
                "source": "CHIRPS Daily via GEE",
                "pilot_area": "Karnataka, India",
                "total_rainfall_mm": round(p_sum, 1),
                "avg_daily_rainfall_mm": round(p_mean, 2) if p_mean is not None else 0.0,
            }
        else:
            raise ValueError("GEE returned no rainfall stats")
    except Exception as e:
        logger.warning("Live rainfall stats unavailable, falling back: %s", e)
        return {
            "status": "success",
            "source": "CHIRPS Daily | Karnataka Pilot Baseline (Fallback)",
            "pilot_area": "Karnataka, India",
            "total_rainfall_mm": 450.2,
            "avg_daily_rainfall_mm": 2.45,
        }


@router.get("/rainfall-series")
async def get_rainfall_series(lat: float = None, lng: float = None):
    """
    Returns monthly CHIRPS rainfall time series for the past 6 months via GEE.
    """
    try:
        from project.gee.weather import get_monthly_rainfall_series
    except ImportError as e:
        logger.warning("Falling back to local rainfall-series import: %s", e)
        from gee.weather import get_monthly_rainfall_series
        
    try:
        series = get_monthly_rainfall_series(months_back=6, lat=lat, lng=lng)
        if series and len(series) > 0:
            return {
                "status": "success",
                "source": "CHIRPS Daily via GEE (monthly aggregation)",
                "pilot_area": "Karnataka, India",
                "data": series,
            }
        else:
            raise ValueError("GEE returned empty rainfall series")
    except Exception as e:
        logger.warning("Live rainfall series unavailable, falling back: %s", e)
        # Generate synthetic monthly series for past 6 months
        fallback_series = []
        now = datetime.utcnow()
        for i in range(5, -1, -1):
            month_date = now.replace(day=1) - timedelta(days=30 * i)
            fallback_series.append({
                "date": f"{month_date.year}-{month_date.month:02d}",
                "rainfall_mm": round(float(20.0 + (i % 3) * 50.0 + (month_date.month % 4) * 15.0), 1),
            })
        return {
            "status": "success",
            "source": "CHIRPS Daily | Karnataka Pilot Baseline (Fallback)",
            "pilot_area": "Karnataka, India",
            "data": fallback_series,
        }


@router.get("/analytics")
async def get_analytics(lat: float = None, lng: float = None):
    """Returns all analytics in one call."""
    try:
        ndvi_res = await get_ndvi_series(lat, lng)
        rainfall_res = await get_rainfall(lat, lng)
        
        # Calculate a simple trend from ndvi_series
        ndvi_data = ndvi_res.get("data", [])
        trend = "Stable"
        if len(ndvi_data) >= 2:
            first_val = ndvi_data[0].get("ndvi", 0)
            last_val = ndvi_data[-1].get("ndvi", 0)
            if last_val > first_val + 0.05:
                trend = "Increasing"
            elif last_val < first_val - 0.05:
                trend = "Decreasing"

        return {
            "status": "success",
            "ndvi_series": ndvi_res["data"],
            "phenology": ndvi_res["metrics"],
            "ndvi_trend": trend,
            "rainfall_stats": {
                "total_rainfall_mm": rainfall_res["total_rainfall_mm"],
                "avg_daily_rainfall_mm": rainfall_res["avg_daily_rainfall_mm"],
            },
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch analytics from GEE: {e}")
