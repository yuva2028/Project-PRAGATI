"""
API Router: Map Tile URLs for Leaflet
GET /api/tiles/{layer}
GET /api/tiles
"""

from fastapi import APIRouter, HTTPException, Path

router = APIRouter()

VALID_LAYERS = ["ndvi", "ndwi", "evi", "vv", "vh", "stress", "rainfall"]

# CartoDB dark base tile — used as a fallback overlay when GEE is unavailable.
# This provides a clean dark satellite-style background for the map.
FALLBACK_TILE = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"


@router.get("/tiles/{layer}")
async def get_tile(layer: str = Path(...)):
    """Returns a GEE tile URL for rendering on Leaflet."""
    layer = layer.lower()
    if layer not in VALID_LAYERS:
        raise HTTPException(status_code=400, detail=f"Invalid layer. Must be one of: {VALID_LAYERS}")

    label_map = {
        "ndvi": "Sentinel-2 NDVI",
        "ndwi": "Sentinel-2 NDWI",
        "evi":  "Sentinel-2 EVI",
        "vv":   "Sentinel-1 VV Backscatter",
        "vh":   "Sentinel-1 VH Backscatter",
        "stress":   "VCI Stress Map",
        "rainfall": "CHIRPS Rainfall",
    }
    label = label_map.get(layer, layer.upper())

    try:
        if layer in ("ndvi", "ndwi", "evi"):
            from gee.sentinel2 import get_tile_url
            tile_url = get_tile_url(band=layer.upper(), months_back=6)
        elif layer in ("vv", "vh"):
            from gee.sentinel1 import get_sar_tile_url
            tile_url = get_sar_tile_url(band=layer.upper(), months_back=6)
        elif layer == "stress":
            from ml.moisture_model import get_vci_tile_url
            tile_url = get_vci_tile_url()
        elif layer == "rainfall":
            from gee.weather import get_rainfall_tile_url
            tile_url = get_rainfall_tile_url(months_back=6)

        return {
            "layer": layer,
            "label": label,
            "tile_url": tile_url,
            "source": "Google Earth Engine",
            "attribution": "Google Earth Engine | ESA Copernicus | UCSB CHIRPS",
        }

    except Exception as e:
        print(f"GEE tile fetch failed for layer '{layer}' (non-fatal): {e}")
        return {
            "layer": layer,
            "label": label,
            "tile_url": FALLBACK_TILE,
            "source": "Base Map (GEE auth required for satellite overlay)",
            "attribution": "© CartoDB | GEE auth required for satellite layer",
        }


@router.get("/tiles")
async def list_tiles():
    return {"available_layers": VALID_LAYERS}
