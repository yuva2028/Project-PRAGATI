"""Feature engineering for Sentinel-2 crop type classification.

The first prototype includes simple, explainable spectral indices commonly
used in vegetation and water-sensitive crop analysis.
"""

from __future__ import annotations

from typing import Mapping

import numpy as np
import pandas as pd


EPSILON = 1e-10


def calculate_ndvi(red: np.ndarray, nir: np.ndarray) -> np.ndarray:
    """Calculate Normalized Difference Vegetation Index.

    NDVI = (NIR - Red) / (NIR + Red)

    Sentinel-2 commonly uses:
    - Red: B04
    - NIR: B08
    """

    return _safe_normalized_difference(nir, red)


def calculate_ndwi(green: np.ndarray, nir: np.ndarray) -> np.ndarray:
    """Calculate Normalized Difference Water Index.

    NDWI = (Green - NIR) / (Green + NIR)

    Sentinel-2 commonly uses:
    - Green: B03
    - NIR: B08
    """

    return _safe_normalized_difference(green, nir)


def calculate_evi_placeholder(
    blue: np.ndarray,
    red: np.ndarray,
    nir: np.ndarray,
) -> np.ndarray:
    """Placeholder for Enhanced Vegetation Index.

    TODO: Implement EVI after confirming Sentinel-2 reflectance scaling and
    preprocessing level for the final dataset.

    Standard EVI formula:
    EVI = 2.5 * (NIR - Red) / (NIR + 6 * Red - 7.5 * Blue + 1)
    """

    _ = (blue, red, nir)
    raise NotImplementedError(
        "EVI is intentionally left as a TODO until band scaling and "
        "preprocessing are confirmed."
    )


def build_feature_matrix_from_arrays(
    bands: Mapping[str, np.ndarray],
    *,
    include_raw_bands: bool = True,
    include_ndvi: bool = True,
    include_ndwi: bool = True,
) -> tuple[np.ndarray, list[str]]:
    """Build a machine-learning feature matrix from named 1D band arrays.

    Parameters
    ----------
    bands:
        Mapping of band names to arrays. Expected keys for the current
        prototype are ``green``, ``red``, and ``nir``.
    include_raw_bands:
        Include original band values as model features.
    include_ndvi:
        Add NDVI when ``red`` and ``nir`` are available.
    include_ndwi:
        Add NDWI when ``green`` and ``nir`` are available.

    Returns
    -------
    tuple[np.ndarray, list[str]]
        Feature matrix with shape ``(samples, features)`` and the feature names.

    TODO: Confirm final Sentinel-2 band naming convention for the hackathon
    dataset before connecting this function to production data paths.
    """

    _validate_band_arrays(bands)

    feature_columns: list[np.ndarray] = []
    feature_names: list[str] = []

    if include_raw_bands:
        for name in bands:
            feature_columns.append(np.asarray(bands[name]).reshape(-1))
            feature_names.append(name)

    if include_ndvi:
        _require_bands(bands, ["red", "nir"], "NDVI")
        feature_columns.append(calculate_ndvi(bands["red"], bands["nir"]).reshape(-1))
        feature_names.append("ndvi")

    if include_ndwi:
        _require_bands(bands, ["green", "nir"], "NDWI")
        feature_columns.append(calculate_ndwi(bands["green"], bands["nir"]).reshape(-1))
        feature_names.append("ndwi")

    if not feature_columns:
        raise ValueError("No features were selected.")

    feature_matrix = np.column_stack(feature_columns)
    valid_mask = np.all(np.isfinite(feature_matrix), axis=1)

    return feature_matrix[valid_mask], feature_names


def add_indices_to_dataframe(
    dataframe: pd.DataFrame,
    *,
    green_col: str = "green",
    red_col: str = "red",
    nir_col: str = "nir",
) -> pd.DataFrame:
    """Return a copy of a pixel table with NDVI and NDWI columns added.

    This helper is convenient after using ``raster_to_tabular_dataset`` from
    ``load_data.py``.
    """

    required = [green_col, red_col, nir_col]
    missing = [column for column in required if column not in dataframe.columns]
    if missing:
        raise ValueError(f"Missing required columns for feature engineering: {missing}")

    engineered = dataframe.copy()
    engineered["ndvi"] = calculate_ndvi(
        engineered[red_col].to_numpy(),
        engineered[nir_col].to_numpy(),
    )
    engineered["ndwi"] = calculate_ndwi(
        engineered[green_col].to_numpy(),
        engineered[nir_col].to_numpy(),
    )
    return engineered


def split_features_and_target(
    dataframe: pd.DataFrame,
    target_col: str = "label",
) -> tuple[np.ndarray, np.ndarray, list[str]]:
    """Split an engineered DataFrame into model-ready X and y arrays."""

    if target_col not in dataframe.columns:
        raise ValueError(f"Target column not found: {target_col}")

    feature_names = [column for column in dataframe.columns if column != target_col]
    features = dataframe[feature_names].to_numpy(dtype=np.float32)
    target = dataframe[target_col].to_numpy(dtype=np.int32)

    valid_mask = np.all(np.isfinite(features), axis=1)
    return features[valid_mask], target[valid_mask], feature_names


def _safe_normalized_difference(
    band_a: np.ndarray,
    band_b: np.ndarray,
    epsilon: float = EPSILON,
) -> np.ndarray:
    """Calculate ``(band_a - band_b) / (band_a + band_b)`` safely."""

    band_a = np.asarray(band_a, dtype=np.float32)
    band_b = np.asarray(band_b, dtype=np.float32)
    denominator = band_a + band_b

    return np.divide(
        band_a - band_b,
        denominator,
        out=np.zeros_like(denominator, dtype=np.float32),
        where=np.abs(denominator) > epsilon,
    )


def _validate_band_arrays(bands: Mapping[str, np.ndarray]) -> None:
    """Ensure all supplied band arrays have the same number of samples."""

    if not bands:
        raise ValueError("At least one band array is required.")

    lengths = {name: np.asarray(values).reshape(-1).shape[0] for name, values in bands.items()}
    unique_lengths = set(lengths.values())

    if len(unique_lengths) != 1:
        raise ValueError(f"All band arrays must have the same length. Got: {lengths}")


def _require_bands(
    bands: Mapping[str, np.ndarray],
    required_names: list[str],
    feature_name: str,
) -> None:
    """Raise a helpful error if a spectral index is missing required bands."""

    missing = [name for name in required_names if name not in bands]
    if missing:
        raise ValueError(f"{feature_name} requires missing band(s): {missing}")


if __name__ == "__main__":
    print("Feature engineering helpers loaded.")
    print("TODO: Connect these helpers to the final Sentinel-2 band mapping.")

