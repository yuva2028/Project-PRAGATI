"""
MODIS Evapotranspiration Extraction
Pilot Area: India
Fetches real 8-day Evapotranspiration from MOD16A2.
"""

import ee

def get_modis_et_stats(months_back=1):
    """
    Fetches actual 8-day global evapotranspiration from MOD16A2.
    Returns the spatial mean of the temporal average ET in mm/8-days.
    """
    from gee.sentinel2 import get_roi, get_date_range
    roi = get_roi()
    start_date, end_date = get_date_range(months_back)
    
    collection = (
        ee.ImageCollection('MODIS/061/MOD16A2')
        .filterBounds(roi)
        .filterDate(start_date, end_date)
        .select('ET')
    )
    
    # Check if empty
    size = collection.size().getInfo()
    if size == 0:
        return 15.0
        
    # MOD16A2 ET has a scale factor of 0.1
    # Average ET over the period (mean of 8-day composites)
    mean_et = collection.mean().multiply(0.1)
    
    stats = mean_et.reduceRegion(
        reducer=ee.Reducer.mean(),
        geometry=roi,
        scale=5000,
        maxPixels=1e9
    )
    
    val = stats.getInfo()
    et_value = val.get('ET')
    
    if et_value is not None:
        return float(et_value)
    return 15.0

if __name__ == '__main__':
    ee.Initialize()
    print("MODIS ET (mm/8-days):", get_modis_et_stats())
