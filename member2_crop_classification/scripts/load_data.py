"""Raster loading and tabular dataset creation for Member 2."""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any, Iterable, Mapping, Sequence

import numpy as np
import pandas as pd
import rasterio
from rasterio.transform import Affine

try:
    from .feature_engineering import build_feature_stack, flatten_feature_stack
    from .utils import get_path
except ImportError:  # pragma: no cover - supports direct script execution.
    from feature_engineering import build_feature_stack, flatten_feature_stack
    from utils import get_path


Array2D = np.ndarray
Array3D = np.ndarray


def load_sentinel2_geotiff(
    image_path: str | Path,
    band_indexes: Sequence[int] | None = None,
) -> tuple[Array3D, dict[str, Any]]:
    """Load Sentinel-2 image bands from a GeoTIFF file."""

    path = Path(image_path)
    if not path.exists():
        raise FileNotFoundError(f"Sentinel-2 GeoTIFF not found: {path}")

    with rasterio.open(path) as src:
        image_bands = src.read(list(band_indexes)) if band_indexes else src.read()
        profile = src.profile.copy()

    return image_bands.astype(np.float32), profile


def load_label_raster(
    label_path: str | Path,
    band_index: int = 1,
) -> tuple[Array2D, dict[str, Any]]:
    """Load a single-band crop label raster."""

    path = Path(label_path)
    if not path.exists():
        raise FileNotFoundError(f"Label raster not found: {path}")

    with rasterio.open(path) as src:
        labels = src.read(band_index)
        profile = src.profile.copy()

    return labels, profile


def load_raster_bands(
    raster_path: str | Path,
    band_mapping: Mapping[str, int],
    *,
    scale_factor: float | None = None,
    nodata_values: Iterable[float | int] | None = None,
) -> tuple[dict[str, Array2D], dict[str, Any]]:
    """Load selected 1-based raster bands into a named dictionary."""

    path = Path(raster_path)
    if not path.exists():
        raise FileNotFoundError(f"Raster file not found: {path}")

    if not band_mapping:
        raise ValueError("Band mapping cannot be empty.")

    bands: dict[str, Array2D] = {}
    with rasterio.open(path) as src:
        profile = src.profile.copy()
        nodata_candidates = list(nodata_values or [])
        if src.nodata is not None:
            nodata_candidates.append(src.nodata)

        for band_name, band_index in band_mapping.items():
            _validate_band_index(src.count, band_index, band_name, path)
            band = src.read(int(band_index)).astype(np.float32)
            band = _apply_nodata_to_nan(band, nodata_candidates)
            if scale_factor not in (None, 0, 1, 1.0):
                band = band / float(scale_factor)
            bands[str(band_name).lower()] = band

    return bands, profile


def load_training_inputs(
    config: Mapping[str, Any],
    logger: logging.Logger | None = None,
) -> tuple[dict[str, Array2D], Array2D, dict[str, Any]]:
    """Load Sentinel imagery and labels required for training."""

    log = logger or logging.getLogger(__name__)
    s2_path = get_path(config, "sentinel2")
    label_path = get_path(config, "labels")
    if s2_path is None:
        raise ValueError("paths.sentinel2 must be configured.")
    if label_path is None:
        raise ValueError("paths.labels must be configured for training.")

    raster_config = config.get("raster", {})
    s2_config = config.get("sentinel2", {})
    s2_bands, s2_profile = load_raster_bands(
        s2_path,
        s2_config.get("band_indexes", {}),
        scale_factor=raster_config.get("reflectance_scale"),
        nodata_values=raster_config.get("nodata_values", []),
    )
    log.info("Loaded Sentinel-2 bands: %s", sorted(s2_bands))

    labels, label_profile = load_label_raster(
        label_path,
        int(raster_config.get("label_band", 1)),
    )
    validate_raster_profiles(s2_profile, label_profile, "labels")

    s1_bands = load_optional_sentinel1(config, s2_profile, logger=log)
    return {**s2_bands, **s1_bands}, labels, s2_profile


def load_inference_inputs(
    config: Mapping[str, Any],
    logger: logging.Logger | None = None,
) -> tuple[dict[str, Array2D], dict[str, Any]]:
    """Load Sentinel imagery required for full-raster inference."""

    log = logger or logging.getLogger(__name__)
    s2_path = get_path(config, "sentinel2")
    if s2_path is None:
        raise ValueError("paths.sentinel2 must be configured.")

    raster_config = config.get("raster", {})
    s2_config = config.get("sentinel2", {})
    s2_bands, s2_profile = load_raster_bands(
        s2_path,
        s2_config.get("band_indexes", {}),
        scale_factor=raster_config.get("reflectance_scale"),
        nodata_values=raster_config.get("nodata_values", []),
    )
    s1_bands = load_optional_sentinel1(config, s2_profile, logger=log)
    return {**s2_bands, **s1_bands}, s2_profile


def load_optional_sentinel1(
    config: Mapping[str, Any],
    reference_profile: Mapping[str, Any],
    *,
    logger: logging.Logger | None = None,
) -> dict[str, Array2D]:
    """Load optional Sentinel-1 VV/VH bands if configured and available."""

    log = logger or logging.getLogger(__name__)
    s1_config = config.get("sentinel1", {})
    if not bool(s1_config.get("enabled", False)):
        log.info("Sentinel-1 support disabled; continuing with optical features.")
        return {}

    s1_path = get_path(config, "sentinel1")
    if s1_path is None or not s1_path.exists():
        log.warning(
            "Sentinel-1 was enabled but the raster is unavailable. "
            "Continuing without VV/VH features."
        )
        return {}

    s1_bands, s1_profile = load_raster_bands(
        s1_path,
        s1_config.get("band_indexes", {}),
        scale_factor=None,
        nodata_values=config.get("raster", {}).get("nodata_values", []),
    )
    validate_raster_profiles(reference_profile, s1_profile, "sentinel1")
    log.info("Loaded Sentinel-1 bands: %s", sorted(s1_bands))
    return s1_bands


def create_training_dataframe(
    config: Mapping[str, Any],
    logger: logging.Logger | None = None,
) -> pd.DataFrame:
    """Create a labeled pixel table from rasters and engineered features."""

    log = logger or logging.getLogger(__name__)
    bands, labels, _profile = load_training_inputs(config, logger=log)

    feature_config = dict(config.get("features", {}))
    feature_config["include_sentinel1_ratio"] = bool(
        config.get("sentinel1", {}).get("include_ratio", True)
    )
    feature_stack = build_feature_stack(bands, feature_config)

    unlabeled_value = int(config.get("raster", {}).get("unlabeled_value", 0))
    label_mask = np.isfinite(labels) & (labels != unlabeled_value)
    feature_table = flatten_feature_stack(feature_stack, mask=label_mask)
    feature_table[str(config.get("training", {}).get("target_column", "label"))] = (
        labels.reshape(-1)[(feature_stack.valid_mask & label_mask).reshape(-1)]
        .astype(np.int32)
    )

    log.info(
        "Created training dataframe with %d samples and %d feature columns.",
        len(feature_table),
        len(feature_stack.feature_names),
    )
    return feature_table


def load_or_create_training_dataframe(
    config: Mapping[str, Any],
    logger: logging.Logger | None = None,
) -> pd.DataFrame:
    """Load an existing table or build one from configured raster inputs."""

    log = logger or logging.getLogger(__name__)
    table_path = get_path(config, "training_table")
    training_config = config.get("training", {})

    if (
        bool(training_config.get("load_existing_table", False))
        and table_path is not None
        and table_path.exists()
    ):
        log.info("Loading existing training table: %s", table_path)
        return pd.read_csv(table_path)

    dataframe = create_training_dataframe(config, logger=log)

    if bool(training_config.get("save_training_table", True)) and table_path is not None:
        table_path.parent.mkdir(parents=True, exist_ok=True)
        dataframe.to_csv(table_path, index=False)
        log.info("Saved training table: %s", table_path)

    return dataframe


def validate_image_label_shapes(image_bands: Array3D, labels: Array2D) -> None:
    """Validate that image bands and labels share the same raster shape."""

    if image_bands.ndim != 3:
        raise ValueError(
            "Expected image_bands with shape (bands, rows, cols), "
            f"got {image_bands.shape}."
        )
    if labels.ndim != 2:
        raise ValueError(f"Expected labels with shape (rows, cols), got {labels.shape}.")
    if image_bands.shape[1:] != labels.shape:
        raise ValueError(
            "Image and label raster shapes do not match. "
            f"Image rows/cols: {image_bands.shape[1:]}; labels: {labels.shape}."
        )


def validate_raster_profiles(
    image_profile: Mapping[str, Any],
    label_profile: Mapping[str, Any],
    source_name: str = "raster",
) -> None:
    """Validate key metadata for rasters expected to be pixel-aligned."""

    checks = {
        "width": (image_profile.get("width"), label_profile.get("width")),
        "height": (image_profile.get("height"), label_profile.get("height")),
        "crs": (image_profile.get("crs"), label_profile.get("crs")),
        "transform": (image_profile.get("transform"), label_profile.get("transform")),
    }
    mismatches = [
        name
        for name, (image_value, label_value) in checks.items()
        if image_value != label_value
    ]
    if mismatches:
        raise ValueError(
            f"Reference raster and {source_name} are not aligned. "
            f"Mismatch: {', '.join(mismatches)}."
        )


def raster_to_tabular_dataset(
    image_bands: Array3D,
    labels: Array2D,
    band_names: Sequence[str] | None = None,
    *,
    unlabeled_value: int = 0,
    nodata_values: Iterable[float | int] | None = None,
    include_coordinates: bool = False,
    transform: Affine | None = None,
) -> pd.DataFrame:
    """Convert aligned image bands and labels into a pixel table."""

    validate_image_label_shapes(image_bands, labels)

    band_count, rows, cols = image_bands.shape
    names = _resolve_band_names(band_count, band_names)
    features = image_bands.reshape(band_count, rows * cols).T
    flat_labels = labels.reshape(rows * cols)

    valid_mask = flat_labels != unlabeled_value
    valid_mask &= np.all(np.isfinite(features), axis=1)

    if nodata_values is not None:
        nodata_array = np.array(list(nodata_values))
        if nodata_array.size:
            valid_mask &= ~np.any(np.isin(features, nodata_array), axis=1)

    table = pd.DataFrame(features[valid_mask], columns=names)
    table["label"] = flat_labels[valid_mask].astype(int)

    if include_coordinates:
        if transform is None:
            raise ValueError("A transform is required when include_coordinates=True.")
        x_coords, y_coords = _pixel_centers(rows, cols, transform)
        table.insert(0, "y", y_coords.reshape(rows * cols)[valid_mask])
        table.insert(0, "x", x_coords.reshape(rows * cols)[valid_mask])

    return table


def _validate_band_index(
    band_count: int,
    band_index: int,
    band_name: str,
    path: Path,
) -> None:
    """Validate a 1-based raster band index."""

    if not 1 <= int(band_index) <= band_count:
        raise ValueError(
            f"Band '{band_name}' requested index {band_index}, but {path} "
            f"contains {band_count} band(s)."
        )


def _apply_nodata_to_nan(
    band: Array2D,
    nodata_values: Iterable[float | int],
) -> Array2D:
    """Replace configured nodata values with NaN."""

    cleaned = band.astype(np.float32, copy=True)
    for nodata_value in nodata_values:
        cleaned[np.isclose(cleaned, float(nodata_value), equal_nan=True)] = np.nan
    return cleaned


def _resolve_band_names(
    band_count: int,
    band_names: Sequence[str] | None,
) -> list[str]:
    """Return validated band names for a raster stack."""

    if band_names is None:
        return [f"band_{index}" for index in range(1, band_count + 1)]

    names = list(band_names)
    if len(names) != band_count:
        raise ValueError(
            f"Expected {band_count} band names, received {len(names)} names."
        )
    if len(set(names)) != len(names):
        raise ValueError("Band names must be unique.")
    return names


def _pixel_centers(rows: int, cols: int, transform: Affine) -> tuple[Array2D, Array2D]:
    """Return x/y coordinates for raster pixel centers."""

    row_indices, col_indices = np.indices((rows, cols))
    x_coords = (
        transform.c
        + (col_indices + 0.5) * transform.a
        + (row_indices + 0.5) * transform.b
    )
    y_coords = (
        transform.f
        + (col_indices + 0.5) * transform.d
        + (row_indices + 0.5) * transform.e
    )
    return x_coords, y_coords
