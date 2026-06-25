"""
API Router: Map Tile URLs for Leaflet
GET /api/tiles/{layer}
GET /api/tiles
"""

import logging
from fastapi import APIRouter, HTTPException, Path
from enum import Enum

logger = logging.getLogger(__name__)

router = APIRouter()


class LayerName(str, Enum):
    ndvi     = "ndvi"
    ndwi     = "ndwi"
    evi      = "evi"
    vv       = "vv"
    vh       = "vh"
    stress   = "stress"
    rainfall = "rainfall"


VALID_LAYERS = [e.value for e in LayerName]

# CartoDB dark base tile — used as a fallback overlay when GEE is unavailable.
# This provides a clean dark satellite-style background for the map.
FALLBACK_TILE = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"


@router.get("/tiles/{layer}")
async def get_tile(layer: LayerName):
    """Returns a GEE tile URL for rendering on Leaflet."""
    # LayerName Enum handles validation automatically; 422 on invalid input
    layer_val = layer.value

    label_map = {
        "ndvi": "Sentinel-2 NDVI",
        "ndwi": "Sentinel-2 NDWI",
        "evi":  "Sentinel-2 EVI",
        "vv":   "Sentinel-1 VV Backscatter",
        "vh":   "Sentinel-1 VH Backscatter",
        "stress":   "VCI Stress Map",
        "rainfall": "CHIRPS Rainfall",
    }
    label = label_map.get(layer_val, layer_val.upper())

    try:
        if layer_val in ("ndvi", "ndwi", "evi"):
            try:
                from gee.sentinel2 import get_tile_url
            except ImportError:
                from project.gee.sentinel2 import get_tile_url
            tile_url = get_tile_url(band=layer_val.upper(), months_back=6)
        elif layer_val in ("vv", "vh"):
            try:
                from gee.sentinel1 import get_sar_tile_url
            except ImportError:
                from project.gee.sentinel1 import get_sar_tile_url
            tile_url = get_sar_tile_url(band=layer_val.upper(), months_back=6)
        elif layer_val == "stress":
            try:
                from project.ml.moisture_model import get_vci_tile_url
            except ImportError:
                from ml.moisture_model import get_vci_tile_url
            tile_url = get_vci_tile_url()
        elif layer_val == "rainfall":
            try:
                from gee.weather import get_rainfall_tile_url
            except ImportError:
                from project.gee.weather import get_rainfall_tile_url
            tile_url = get_rainfall_tile_url(months_back=6)

        return {
            "layer": layer_val,
            "label": label,
            "tile_url": tile_url,
            "source": "Google Earth Engine",
            "attribution": "Google Earth Engine | ESA Copernicus | UCSB CHIRPS",
        }

    except Exception as e:
        logger.warning("GEE tile fetch failed for layer '%s' (non-fatal): %s", layer_val, e)
        return {
            "layer": layer_val,
            "label": label,
            "tile_url": FALLBACK_TILE,
            "source": "Base Map (GEE auth required for satellite overlay)",
            "attribution": "© CartoDB | GEE auth required for satellite layer",
        }


@router.get("/tiles")
async def list_tiles():
    return {"available_layers": VALID_LAYERS}
