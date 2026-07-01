"""
Shared NDVI/VCI time-series utilities for Project PRAGATI backend.
Eliminates duplicate phenology fallback logic in analytics.py and stress.py.
"""
import math
from datetime import datetime, timedelta

PHENOLOGY_MAP = [
    (0.0, 0.2, "Sowing"),
    (0.2, 0.5, "Vegetative"),
    (0.5, 0.7, "Flowering"),
    (0.7, 1.0, "Maturity"),
]


def get_phenology_stage(ndvi: float) -> str:
    """Map an NDVI value to the corresponding crop phenology stage name."""
    for lo, hi, name in PHENOLOGY_MAP:
        if lo <= ndvi < hi:
            return name
    return "Maturity"


# Realistic Kharif/Rabi NDVI pattern for Karnataka (Sentinel-2 seasonal composites)
NDVI_PATTERN = [
    0.18, 0.20, 0.22, 0.21, 0.24, 0.27, 0.31, 0.35, 0.38,
    0.42, 0.47, 0.52, 0.57, 0.62, 0.65, 0.68, 0.70, 0.72,
    0.71, 0.69, 0.65, 0.61, 0.57, 0.53, 0.48, 0.43, 0.38,
    0.34, 0.31, 0.28, 0.25, 0.23, 0.22, 0.21, 0.20, 0.19,
]


def generate_synthetic_ndvi_series(lat: float = None, lng: float = None) -> list[dict]:
    """Realistic Karnataka Kharif/Rabi NDVI time series in a 6-month window.

    Returns a list of dicts with keys: date, ndvi, phenology_stage, vci.
    Based on published MODIS/Sentinel-2 seasonal studies for Indian crops.
    """
    # Create a deterministic but coordinate-dependent offset
    offset = 0.0
    days_shift = 0
    if lat is not None and lng is not None:
        # Deterministic variation using sine/cosine of coordinates
        offset = (math.sin(lat * 50.0) + math.cos(lng * 50.0)) * 0.05
        days_shift = int((lat * 10.0 + lng * 10.0) % 15) - 7

    base_date = datetime.now() - timedelta(days=180 + days_shift)
    results = []
    for i, ndvi in enumerate(NDVI_PATTERN):
        date     = base_date + timedelta(days=i * (180 // len(NDVI_PATTERN)))
        # Apply coordinate offset and small periodic noise
        ndvi_val = round(max(0.12, min(0.85, ndvi + offset + (math.sin(i * 0.3) * 0.01))), 4)
        vci      = round(max(0.0, min(100.0, (ndvi_val - 0.18) / (0.72 - 0.18) * 100.0)), 1)
        results.append({
            "date":            date.strftime("%Y-%m-%d"),
            "ndvi":            ndvi_val,
            "phenology_stage": get_phenology_stage(ndvi_val),
            "vci":             vci,
        })
    return sorted(results, key=lambda x: x["date"])


def get_phenology_metrics(series: list[dict]) -> dict:
    """Compute start-of-season, peak-growth-date, and length-of-growing-period.

    Parameters
    ----------
    series:
        Output of generate_synthetic_ndvi_series() or equivalent GEE data.

    Returns
    -------
    dict with keys: start_of_season, peak_growth_date,
    length_of_growing_period_days
    """
    if len(series) < 3:
        return {}
    ndvis    = [r["ndvi"] for r in series]
    peak_idx = int(max(range(len(ndvis)), key=lambda i: ndvis[i]))
    sos_idx  = int(min(range(peak_idx + 1), key=lambda i: ndvis[i])) if peak_idx > 0 else 0
    try:
        sos_dt   = datetime.strptime(series[sos_idx]["date"], "%Y-%m-%d")
        peak_dt  = datetime.strptime(series[peak_idx]["date"], "%Y-%m-%d")
        lgp_days = (peak_dt - sos_dt).days + 30
    except Exception as e:
        print(f"[WARN] Phenology date parsing failed: {e}")
        lgp_days = 120
    return {
        "start_of_season":               series[sos_idx]["date"],
        "peak_growth_date":              series[peak_idx]["date"],
        "length_of_growing_period_days": lgp_days,
    }
