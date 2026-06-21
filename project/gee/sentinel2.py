"""
Sentinel-2 Data Collection and Preprocessing
Pilot Area: India
Fetches real optical satellite data from Google Earth Engine
"""

import ee
import json
from datetime import datetime, timedelta

# ──────────────────────────────────────────
# Region of Interest: India
# ──────────────────────────────────────────
INDIA_COORDS = [
    [68.1, 8.0],
    [97.4, 8.0],
    [97.4, 37.3],
    [68.1, 37.3],
    [68.1, 8.0]
]

def get_roi():
    return ee.Geometry.Polygon(INDIA_COORDS)

def get_date_range(months_back_start: int = 6, months_back_end: int = 0):
    """Returns (start_date, end_date) as YYYY-MM-DD strings."""
    end = datetime.now() - timedelta(days=30*months_back_end)
    start = datetime.now() - timedelta(days=30*months_back_start)
    return start.strftime('%Y-%m-%d'), end.strftime('%Y-%m-%d')

# ──────────────────────────────────────────
# Cloud Masking using QA60 band
# ──────────────────────────────────────────
def mask_s2_clouds(image):
    qa = image.select('QA60')
    cloud_bit_mask = 1 << 10
    cirrus_bit_mask = 1 << 11
    mask = qa.bitwiseAnd(cloud_bit_mask).eq(0).And(
        qa.bitwiseAnd(cirrus_bit_mask).eq(0)
    )
    # Use .set() to preserve system:time_start — .copyProperties() is unreliable
    # on server-side GEE execution when source has null properties
    return (
        image.updateMask(mask)
        .divide(10000)
        .set('system:time_start', image.get('system:time_start'))
        .set('system:index', image.get('system:index'))
    )

# ──────────────────────────────────────────
# Spectral Index Calculations
# ──────────────────────────────────────────
def add_ndvi(image):
    ndvi = image.normalizedDifference(['B8', 'B4']).rename('NDVI')
    return image.addBands(ndvi)

def add_ndwi(image):
    ndwi = image.normalizedDifference(['B8', 'B11']).rename('NDWI')
    return image.addBands(ndwi)

def add_evi(image):
    evi = image.expression(
        '2.5 * ((NIR - RED) / (NIR + 6 * RED - 7.5 * BLUE + 1))',
        {
            'NIR': image.select('B8'),
            'RED': image.select('B4'),
            'BLUE': image.select('B2')
        }
    ).rename('EVI')
    return image.addBands(evi)

# ──────────────────────────────────────────
# Main: Fetch Sentinel-2 Collection
# ──────────────────────────────────────────
def get_sentinel2_collection(months_back_start: int = 6, months_back_end: int = 0):
    roi = get_roi()
    start_date, end_date = get_date_range(months_back_start, months_back_end)

    collection = (
        ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
        .filterBounds(roi)
        .filterDate(start_date, end_date)
        .filter(ee.Filter.notNull(['system:time_start']))  # Exclude images missing date metadata
        .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20))
        .map(mask_s2_clouds)
        .map(add_ndvi)
        .map(add_ndwi)
        .map(add_evi)
    )

    return collection

def get_median_composite(months_back_start: int = 6, months_back_end: int = 0):
    """Returns a median composite image over the ROI and date range."""
    roi = get_roi()
    collection = get_sentinel2_collection(months_back_start, months_back_end)
    median = collection.median().clip(roi)
    return median

def get_multi_temporal_stack_s2():
    """Returns a stacked image of T1 (months 6 to 3) and T2 (months 3 to 0)."""
    t1 = get_median_composite(6, 3).select(['NDVI', 'NDWI', 'EVI', 'B4', 'B8', 'B11'])
    t1 = t1.rename(['NDVI_t1', 'NDWI_t1', 'EVI_t1', 'B4_t1', 'B8_t1', 'B11_t1'])
    
    t2 = get_median_composite(3, 0).select(['NDVI', 'NDWI', 'EVI', 'B4', 'B8', 'B11'])
    t2 = t2.rename(['NDVI_t2', 'NDWI_t2', 'EVI_t2', 'B4_t2', 'B8_t2', 'B11_t2'])
    
    return t1.addBands(t2)

def get_ndvi_time_series(months_back: int = 6):
    """Returns monthly NDVI mean values for time series chart."""
    roi = get_roi()
    collection = get_sentinel2_collection(months_back)

    def compute_monthly_ndvi(image):
        ndvi_mean = image.select('NDVI').reduceRegion(
            reducer=ee.Reducer.mean(),
            geometry=roi,
            scale=5000,
            maxPixels=1e9
        )
        return ee.Feature(None, {
            'date': image.date().format('YYYY-MM-dd'),
            'ndvi': ndvi_mean.get('NDVI')
        })

    fc = collection.map(compute_monthly_ndvi)
    return fc

def get_band_stats(band_name: str, months_back: int = 6):
    """Returns min/max/mean stats for a given band over the pilot area."""
    roi = get_roi()
    composite = get_median_composite(months_back)

    stats = composite.select(band_name).reduceRegion(
        reducer=ee.Reducer.minMax().combine(ee.Reducer.mean(), sharedInputs=True),
        geometry=roi,
        scale=5000,
        maxPixels=1e9
    )
    return stats.getInfo()

def get_tile_url(band: str = 'NDVI', months_back: int = 6):
    """Returns a GEE tile URL for frontend Leaflet visualization."""
    composite = get_median_composite(months_back)
    vis_params_map = {
        'NDVI': {'min': -0.2, 'max': 0.9, 'palette': ['#d73027', '#fee08b', '#1a9850']},
        'NDWI': {'min': -0.5, 'max': 0.5, 'palette': ['#d73027', '#ffffbf', '#4575b4']},
        'EVI':  {'min': -0.2, 'max': 0.8, 'palette': ['#d73027', '#ffffbf', '#1a9850']},
        'B4':   {'min': 0, 'max': 0.3, 'palette': ['black', 'white']},
        'B8':   {'min': 0, 'max': 0.5, 'palette': ['black', 'white']},
    }
    vis = vis_params_map.get(band, {'min': 0, 'max': 1})
    map_id = composite.select(band).getMapId(vis)
    return map_id['tile_fetcher'].url_format

if __name__ == '__main__':
    ee.Authenticate()
    ee.Initialize(project='your-gee-project-id')
    print("Sentinel-2 module loaded. Fetching composite for India...")
    composite = get_median_composite(months_back=6)
    print("NDVI Stats:", get_band_stats('NDVI'))
    print("NDWI Stats:", get_band_stats('NDWI'))
    print("Done.")
