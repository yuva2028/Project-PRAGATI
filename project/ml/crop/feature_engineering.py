"""Vectorized feature engineering for crop type classification."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Mapping

import numpy as np
import pandas as pd


EPSILON = 1e-10


@dataclass(frozen=True)
class FeatureStack:
    """Container for raster feature arrays and their common valid mask."""

    arrays: dict[str, np.ndarray]
    valid_mask: np.ndarray
    feature_names: list[str]


def safe_divide(
    numerator: np.ndarray,
    denominator: np.ndarray,
    *,
    fill_value: float = 0.0,
    epsilon: float = EPSILON,
) -> np.ndarray:
    """Safely divide arrays while avoiding zero, NaN, and infinite outputs."""

    numerator_array = np.asarray(numerator, dtype=np.float32)
    denominator_array = np.asarray(denominator, dtype=np.float32)
    valid = (
        np.isfinite(numerator_array)
        & np.isfinite(denominator_array)
        & (np.abs(denominator_array) > epsilon)
    )

    result = np.full_like(numerator_array, fill_value, dtype=np.float32)
    np.divide(
        numerator_array,
        denominator_array,
        out=result,
        where=valid,
    )
    return result


def calculate_ndvi(red: np.ndarray, nir: np.ndarray) -> np.ndarray:
    """Calculate Normalized Difference Vegetation Index."""

    red_array = np.asarray(red, dtype=np.float32)
    nir_array = np.asarray(nir, dtype=np.float32)
    return safe_divide(nir_array - red_array, nir_array + red_array)


def calculate_ndwi(green: np.ndarray, nir: np.ndarray) -> np.ndarray:
    """Calculate Normalized Difference Water Index."""

    green_array = np.asarray(green, dtype=np.float32)
    nir_array = np.asarray(nir, dtype=np.float32)
    return safe_divide(green_array - nir_array, green_array + nir_array)


def calculate_evi(
    blue: np.ndarray,
    red: np.ndarray,
    nir: np.ndarray,
    *,
    gain: float = 2.5,
    c1: float = 6.0,
    c2: float = 7.5,
    canopy_background: float = 1.0,
) -> np.ndarray:
    """
    Calculate Enhanced Vegetation Index.

    EVI = 2.5 * (NIR - Red) / (NIR + 6*Red - 7.5*Blue + 1).
    Sentinel-2 mapping: B2=blue, B4=red, B8=nir.
    """

    blue_array = np.asarray(blue, dtype=np.float32)
    red_array = np.asarray(red, dtype=np.float32)
    nir_array = np.asarray(nir, dtype=np.float32)
    denominator = (
        nir_array
        + c1 * red_array
        - c2 * blue_array
        + canopy_background
    )
    with np.errstate(divide="ignore", invalid="ignore"):
        result = np.where(
            np.abs(denominator) > EPSILON,
            gain * (nir_array - red_array) / denominator,
            0.0,
        )
    return np.clip(result, -1.0, 1.0).astype(np.float32)


def calculate_savi(
    red: np.ndarray,
    nir: np.ndarray,
    *,
    soil_brightness_factor: float = 0.5,
) -> np.ndarray:
    """Calculate Soil Adjusted Vegetation Index."""

    red_array = np.asarray(red, dtype=np.float32)
    nir_array = np.asarray(nir, dtype=np.float32)
    numerator = (nir_array - red_array) * (1.0 + soil_brightness_factor)
    denominator = nir_array + red_array + soil_brightness_factor
    return safe_divide(numerator, denominator)


def calculate_vh_vv_ratio(vh: np.ndarray, vv: np.ndarray) -> np.ndarray:
    """Calculate Sentinel-1 VH/VV ratio when SAR bands are available."""

    return safe_divide(np.asarray(vh, dtype=np.float32), np.asarray(vv, dtype=np.float32))


def build_feature_stack(
    bands: Mapping[str, np.ndarray],
    feature_config: Mapping[str, Any] | None = None,
) -> FeatureStack:
    """Create raw-band and spectral-index features from named raster bands."""

    config = feature_config or {}
    _validate_band_shapes(bands)
    source_valid_mask = _combined_valid_mask(
        {
            band_name: np.asarray(band_array, dtype=np.float32)
            for band_name, band_array in bands.items()
        }
    )

    include_raw_bands = bool(config.get("include_raw_bands", True))
    requested_indices = [
        str(index_name).lower() for index_name in config.get("indices", [])
    ]
    include_s1_ratio = bool(config.get("include_sentinel1_ratio", True))

    features: dict[str, np.ndarray] = {}
    if include_raw_bands:
        for band_name, band_array in bands.items():
            features[band_name] = np.asarray(band_array, dtype=np.float32)

    if "ndvi" in requested_indices:
        _require_bands(bands, ("red", "nir"), "NDVI")
        features["ndvi"] = calculate_ndvi(bands["red"], bands["nir"])

    if "ndwi" in requested_indices:
        _require_bands(bands, ("green", "nir"), "NDWI")
        features["ndwi"] = calculate_ndwi(bands["green"], bands["nir"])

    if "evi" in requested_indices:
        _require_bands(bands, ("blue", "red", "nir"), "EVI")
        evi_config = config.get("evi", {})
        features["evi"] = calculate_evi(
            bands["blue"],
            bands["red"],
            bands["nir"],
            gain=float(evi_config.get("gain", 2.5)),
            c1=float(evi_config.get("c1", 6.0)),
            c2=float(evi_config.get("c2", 7.5)),
            canopy_background=float(evi_config.get("canopy_background", 1.0)),
        )

    if "savi" in requested_indices:
        _require_bands(bands, ("red", "nir"), "SAVI")
        features["savi"] = calculate_savi(
            bands["red"],
            bands["nir"],
            soil_brightness_factor=float(config.get("savi_l", 0.5)),
        )

    if include_s1_ratio and {"vh", "vv"}.issubset(bands):
        features["vh_vv_ratio"] = calculate_vh_vv_ratio(bands["vh"], bands["vv"])

    if not features:
        raise ValueError("No features were created. Check feature configuration.")

    valid_mask = source_valid_mask & _combined_valid_mask(features)
    _validate_feature_stack(features, valid_mask)
    return FeatureStack(
        arrays=features,
        valid_mask=valid_mask,
        feature_names=list(features.keys()),
    )


def flatten_feature_stack(
    feature_stack: FeatureStack,
    *,
    mask: np.ndarray | None = None,
) -> pd.DataFrame:
    """Flatten a raster feature stack to a row-wise DataFrame."""

    combined_mask = feature_stack.valid_mask
    if mask is not None:
        if mask.shape != combined_mask.shape:
            raise ValueError(
                f"Mask shape {mask.shape} does not match feature shape "
                f"{combined_mask.shape}."
            )
        combined_mask = combined_mask & mask

    flat_mask = combined_mask.reshape(-1)
    data = {
        name: array.reshape(-1)[flat_mask]
        for name, array in feature_stack.arrays.items()
    }
    return pd.DataFrame(data, columns=feature_stack.feature_names)


def validate_feature_dataframe(
    dataframe: pd.DataFrame,
    *,
    target_column: str | None = None,
) -> tuple[np.ndarray, np.ndarray | None, list[str]]:
    """Validate numeric model features and return clean arrays."""

    if dataframe.empty:
        raise ValueError("Training dataframe is empty.")

    if target_column is not None and target_column not in dataframe.columns:
        raise ValueError(f"Target column not found: {target_column}")

    feature_names = [
        column for column in dataframe.columns if column != target_column
    ]
    if not feature_names:
        raise ValueError("At least one feature column is required.")

    non_numeric = [
        column
        for column in feature_names
        if not pd.api.types.is_numeric_dtype(dataframe[column])
    ]
    if non_numeric:
        raise TypeError(f"Non-numeric feature columns found: {non_numeric}")

    features = dataframe[feature_names].to_numpy(dtype=np.float32)
    valid_mask = np.all(np.isfinite(features), axis=1)

    if not np.any(valid_mask):
        raise ValueError("No valid finite feature rows found.")

    target = None
    if target_column is not None:
        target = dataframe[target_column].to_numpy(dtype=np.int32)[valid_mask]
        if len(np.unique(target)) < 2:
            raise ValueError("Training requires at least two crop classes.")

    return features[valid_mask], target, feature_names


def build_feature_matrix_from_arrays(
    bands: Mapping[str, np.ndarray],
    *,
    include_raw_bands: bool = True,
    include_ndvi: bool = True,
    include_ndwi: bool = True,
    include_evi: bool = True,
    include_savi: bool = False,
) -> tuple[np.ndarray, list[str]]:
    """
    Build a row-wise feature matrix from named raster arrays.

    Parameters mirror the earlier Member 2 helper. When ``include_evi`` is
    true, the input must include ``blue``, ``red``, and ``nir`` bands and the
    resulting feature list includes an ``evi`` column.
    """

    indices: list[str] = []
    if include_ndvi:
        indices.append("ndvi")
    if include_ndwi:
        indices.append("ndwi")
    if include_evi:
        indices.append("evi")
    if include_savi:
        indices.append("savi")

    feature_stack = build_feature_stack(
        bands,
        {
            "include_raw_bands": include_raw_bands,
            "indices": indices,
        },
    )
    dataframe = flatten_feature_stack(feature_stack)
    return dataframe.to_numpy(dtype=np.float32), list(dataframe.columns)


def add_indices_to_dataframe(
    dataframe: pd.DataFrame,
    *,
    red_col: str = "red",
    nir_col: str = "nir",
    green_col: str = "green",
    blue_col: str = "blue",
) -> pd.DataFrame:
    """
    Add NDVI/NDWI/EVI columns to a tabular feature dataframe when bands exist.

    EVI is added only when ``blue_col`` is present, so callers with older
    red/nir/green-only tables continue to work.
    """

    result = dataframe.copy()
    if {red_col, nir_col}.issubset(result.columns):
        result["ndvi"] = calculate_ndvi(result[red_col], result[nir_col])
        result["savi"] = calculate_savi(result[red_col], result[nir_col])
    if {green_col, nir_col}.issubset(result.columns):
        result["ndwi"] = calculate_ndwi(result[green_col], result[nir_col])
    if {blue_col, red_col, nir_col}.issubset(result.columns):
        result["evi"] = calculate_evi(
            result[blue_col],
            result[red_col],
            result[nir_col],
        )
    return result


def _validate_band_shapes(bands: Mapping[str, np.ndarray]) -> None:
    """Validate that all band arrays have the same raster shape."""

    if not bands:
        raise ValueError("At least one raster band is required.")

    shapes = {
        band_name: np.asarray(band_array).shape
        for band_name, band_array in bands.items()
    }
    unique_shapes = set(shapes.values())
    if len(unique_shapes) != 1:
        raise ValueError(f"All bands must share one shape. Got: {shapes}")


def _require_bands(
    bands: Mapping[str, np.ndarray],
    required_names: tuple[str, ...],
    feature_name: str,
) -> None:
    """Raise a useful error if an index is missing required bands."""

    missing = [name for name in required_names if name not in bands]
    if missing:
        raise ValueError(f"{feature_name} requires missing band(s): {missing}")


def _combined_valid_mask(features: Mapping[str, np.ndarray]) -> np.ndarray:
    """Return pixels where all feature arrays are finite."""

    masks = [np.isfinite(array) for array in features.values()]
    return np.logical_and.reduce(masks)


def _validate_feature_stack(
    features: Mapping[str, np.ndarray],
    valid_mask: np.ndarray,
) -> None:
    """Validate the final feature stack before ML use."""

    if not np.any(valid_mask):
        raise ValueError("No valid pixels remain after feature engineering.")

    for name, array in features.items():
        if array.shape != valid_mask.shape:
            raise ValueError(
                f"Feature {name} has shape {array.shape}, expected "
                f"{valid_mask.shape}."
            )
