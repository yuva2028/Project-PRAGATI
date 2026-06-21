"""
Weather & Ancillary Data from GEE
Sources: CHIRPS Rainfall, ERA5 Temperature, FAO Evapotranspiration
"""

import ee
from gee.sentinel2 import get_roi, get_date_range

def get_chirps_rainfall(months_back: int = 6):
    """Fetch CHIRPS daily rainfall and compute total over period."""
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

def get_rainfall_stats(months_back: int = 6):
    roi = get_roi()
    rainfall = get_chirps_rainfall(months_back)
    stats = rainfall.reduceRegion(
        reducer=ee.Reducer.mean().combine(ee.Reducer.sum(), sharedInputs=True),
        geometry=roi,
        scale=5500,
        maxPixels=1e10
    )
    return stats.getInfo()

def get_monthly_rainfall_series(months_back: int = 6):
    """Returns monthly aggregate rainfall for time-series charts."""
    roi = get_roi()
    start_date, end_date = get_date_range(months_back)

    chirps = (
        ee.ImageCollection('UCSB-CHG/CHIRPS/DAILY')
        .filterBounds(roi)
        .filterDate(start_date, end_date)
        .select('precipitation')
    )

    def monthly_mean(image):
        val = image.reduceRegion(
            reducer=ee.Reducer.mean(),
            geometry=roi,
            scale=5500,
            maxPixels=1e10
        )
        return ee.Feature(None, {
            'date': image.date().format('YYYY-MM-dd'),
            'rainfall_mm': val.get('precipitation')
        })

    return chirps.map(monthly_mean)

if __name__ == '__main__':
    ee.Initialize(project='your-gee-project-id')
    print("Rainfall Stats:", get_rainfall_stats())
