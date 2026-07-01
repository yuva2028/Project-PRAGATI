"""
Weather & Ancillary Data from GEE
Sources: CHIRPS Rainfall, ERA5 Temperature, FAO Evapotranspiration
"""

import ee
from gee.sentinel2 import get_roi, get_date_range

def get_chirps_rainfall(months_back: int = 6, roi = None):
    """Fetch CHIRPS daily rainfall and compute total over period."""
    if roi is None:
        roi = get_roi()
    start_date, end_date = get_date_range(months_back)

    chirps = (
        ee.ImageCollection('UCSB-CHG/CHIRPS/DAILY')
        .filterBounds(roi)
        .filterDate(start_date, end_date)
        .select('precipitation')
    )

    # Total rainfall over period
    total_rainfall = chirps.sum().clip(roi)
    return total_rainfall

def get_era5_temperature(months_back: int = 6):
    """Fetch ERA5 mean 2m temperature over period (in Kelvin, convert to Celsius)."""
    roi = get_roi()
    start_date, end_date = get_date_range(months_back)

    era5 = (
        ee.ImageCollection('ECMWF/ERA5/DAILY')
        .filterBounds(roi)
        .filterDate(start_date, end_date)
        .select('mean_2m_air_temperature')
    )

    mean_temp_k = era5.mean().clip(roi)
    mean_temp_c = mean_temp_k.subtract(273.15).rename('temperature_celsius')
    return mean_temp_c

def get_et0(months_back: int = 6):
    """Fetch reference evapotranspiration from MODIS MOD16."""
    roi = get_roi()
    start_date, end_date = get_date_range(months_back)

    mod16 = (
        ee.ImageCollection('MODIS/006/MOD16A2')
        .filterBounds(roi)
        .filterDate(start_date, end_date)
        .select('ET')
    )

    mean_et = mod16.mean().multiply(0.1).clip(roi)  # Scale factor
    return mean_et

def get_rainfall_tile_url(months_back: int = 6):
    rainfall = get_chirps_rainfall(months_back)
    vis = {'min': 0, 'max': 500, 'palette': ['#ffffcc', '#41b6c4', '#0c2c84']}
    map_id = rainfall.getMapId(vis)
    return map_id['tile_fetcher'].url_format

def get_rainfall_stats(months_back: int = 6, lat: float = None, lng: float = None):
    if lat is not None and lng is not None:
        roi = ee.Geometry.Point([lng, lat]).buffer(10000)
    else:
        roi = get_roi()
    rainfall = get_chirps_rainfall(months_back, roi)
    stats = rainfall.reduceRegion(
        reducer=ee.Reducer.mean().combine(ee.Reducer.sum(), sharedInputs=True),
        geometry=roi,
        scale=5500,
        maxPixels=1e10
    )
    return stats.getInfo()

def get_monthly_rainfall_series(months_back: int = 6, lat: float = None, lng: float = None):
    """
    Returns monthly aggregate rainfall (mm/month) for the past N months.
    Aggregates CHIRPS daily data into calendar-month totals via ee.List loop.
    Returns a list of dicts: [{ 'date': 'YYYY-MM', 'rainfall_mm': float }, ...]
    """
    if lat is not None and lng is not None:
        roi = ee.Geometry.Point([lng, lat]).buffer(10000)
    else:
        roi = get_roi()
    from datetime import datetime, timedelta

    results = []
    now = datetime.utcnow()

    for i in range(months_back - 1, -1, -1):
        # Compute first and last day of month (i months ago)
        month_date = now.replace(day=1) - timedelta(days=30 * i)
        year = month_date.year
        month = month_date.month

        if month == 12:
            next_year, next_month = year + 1, 1
        else:
            next_year, next_month = year, month + 1

        start_str = f"{year}-{month:02d}-01"
        end_str   = f"{next_year}-{next_month:02d}-01"

        chirps_month = (
            ee.ImageCollection("UCSB-CHG/CHIRPS/DAILY")
            .filterBounds(roi)
            .filterDate(start_str, end_str)
            .select("precipitation")
        )

        # Total rainfall for this month (sum of daily)
        monthly_total = chirps_month.sum()
        stats = monthly_total.reduceRegion(
            reducer=ee.Reducer.mean(),
            geometry=roi,
            scale=5500,
            maxPixels=1e10,
        ).getInfo()

        mm = stats.get("precipitation")
        if mm is not None:
            results.append({
                "date": f"{year}-{month:02d}",
                "rainfall_mm": round(float(mm), 1),
            })

    return results

if __name__ == '__main__':
    ee.Initialize(project='your-gee-project-id')
    print("Rainfall Stats:", get_rainfall_stats())
