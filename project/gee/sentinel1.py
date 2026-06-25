"""
Sentinel-1 SAR Data Collection and Preprocessing
Pilot Area: India
Fetches real microwave satellite data from Google Earth Engine
"""

import ee
from gee.sentinel2 import get_roi, get_date_range

# ──────────────────────────────────────────
# Speckle Filtering (Lee Filter approximation using GEE)
# ──────────────────────────────────────────
def apply_speckle_filter(image):
    """
    Applies a standard Lee Filter for SAR speckle reduction.
    Uses local statistics (mean and variance) to smooth homogeneous areas while preserving edges.
    """
    bandNames = image.bandNames()
    
    # Set up 5x5 kernel for local stats
    weights = ee.List.repeat(ee.List.repeat(1, 5), 5)
    kernel = ee.Kernel.fixed(5, 5, weights, 2, 2, False)
    
    # Compute local mean and variance
    mean = image.reduceNeighborhood(ee.Reducer.mean(), kernel)
    variance = image.reduceNeighborhood(ee.Reducer.variance(), kernel)
    
    # Estimate noise variance using ENL (Equivalent Number of Looks) ~ 4.4 for S1 GRD
    enl = 4.4
    noiseVariance = mean.pow(2).divide(enl)
    
    # Calculate Lee filter weights: b = max(0, (variance - noiseVariance) / variance)
    b = variance.subtract(noiseVariance).divide(variance).max(0)
    
    # Filtered value: mean + b * (pixel - mean)
    filtered = mean.add(b.multiply(image.subtract(mean)))
    
    return filtered.rename(bandNames)

# ──────────────────────────────────────────
# Compute VH/VV Ratio
# ──────────────────────────────────────────
def add_vh_vv_ratio(image):
    ratio = image.select('VH').divide(image.select('VV')).rename('VH_VV_ratio')
    return image.addBands(ratio)

# ──────────────────────────────────────────
# SAR Texture Features (GLCM)
# ──────────────────────────────────────────
def add_glcm_texture(image):
    """
    Computes Gray Level Co-occurrence Matrix (GLCM) texture features.
    GLCM requires integer bands, so we scale VV and cast to int32.
    """
    # Scale VV from roughly [-30, 10] to [0, 255]
    vv_scaled = image.select('VV').add(30).multiply(255/40).clamp(0, 255).toInt32()
    # Compute GLCM with 3x3 neighborhood
    glcm = vv_scaled.glcmTexture(size=3)
    
    # Extract contrast and entropy
    contrast = glcm.select('VV_contrast')
    entropy = glcm.select('VV_ent').rename('VV_entropy')
    
    return image.addBands(contrast).addBands(entropy)

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

# ──────────────────────────────────────────
# Main: Fetch Sentinel-1 Collection (IW, ASCENDING)
# ──────────────────────────────────────────
def get_sentinel1_collection(months_back_start: int = 6, months_back_end: int = 0):
    roi = get_roi()
    from gee.sentinel2 import get_date_range
    start_date, end_date = get_date_range(months_back_start, months_back_end)

    collection = (
        ee.ImageCollection('COPERNICUS/S1_GRD')
        .filterBounds(roi)
        .filterDate(start_date, end_date)
        .filter(ee.Filter.eq('instrumentMode', 'IW'))
        .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VV'))
        .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VH'))
        .filter(ee.Filter.eq('orbitProperties_pass', 'ASCENDING'))
        .select(['VV', 'VH'])
        .map(apply_speckle_filter)
        .map(add_vh_vv_ratio)
        .map(add_glcm_texture)
    )

    return collection

def get_sar_median_composite(months_back_start: int = 6, months_back_end: int = 0):
    roi = get_roi()
    collection = get_sentinel1_collection(months_back_start, months_back_end)
    median = collection.median().clip(roi)
    return median

def get_multi_temporal_stack_s1():
    """Returns a stacked image of T1 (months 6 to 3) and T2 (months 3 to 0)."""
    bands = ['VV', 'VH', 'VH_VV_ratio', 'VV_contrast', 'VV_entropy']
    t1 = get_sar_median_composite(6, 3).select(bands)
    t1 = t1.rename([b + '_t1' for b in bands])
    
    t2 = get_sar_median_composite(3, 0).select(bands)
    t2 = t2.rename([b + '_t2' for b in bands])
    
    return t1.addBands(t2)

def get_sar_tile_url(band: str = 'VV', months_back: int = 6):
    """Returns a GEE tile URL for Leaflet SAR visualization."""
    composite = get_sar_median_composite(months_back)
    vis_params_map = {
        'VV': {'min': -25, 'max': 5, 'palette': ['black', 'white']},
        'VH': {'min': -30, 'max': 0, 'palette': ['black', 'white']},
        'VH_VV_ratio': {'min': -2, 'max': 0, 'palette': ['#d73027', '#ffffbf', '#1a9850']},
    }
    vis = vis_params_map.get(band, {'min': -25, 'max': 5})
    map_id = composite.select(band).getMapId(vis)
    return map_id['tile_fetcher'].url_format

def get_sar_stats(band: str = 'VV', months_back: int = 6):
    roi = get_roi()
    composite = get_sar_median_composite(months_back)
    stats = composite.select(band).reduceRegion(
        reducer=ee.Reducer.minMax().combine(ee.Reducer.mean(), sharedInputs=True),
        geometry=roi,
        scale=5000,
        maxPixels=1e9
    )
    return stats.getInfo()

if __name__ == '__main__':
    ee.Initialize(project='your-gee-project-id')
    print("Sentinel-1 composite stats (VV):", get_sar_stats('VV'))
    print("Sentinel-1 composite stats (VH):", get_sar_stats('VH'))
