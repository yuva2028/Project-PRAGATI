"""Raster loading utilities for Member 2 crop type classification.

This script focuses on the first prototype stage:

- Read Sentinel-2 GeoTIFF imagery.
- Read crop label rasters.
- Convert aligned raster pixels into a tabular dataset.

Unlabeled pixels with label value 0 are ignored so the model trains only on
known crop samples.
"""

from __future__ import annotations

from pathlib import Path
from typing import Iterable, Sequence

import numpy as np
import pandas as pd
import rasterio
from rasterio.transform import Affine


Array3D = np.ndarray
Array2D = np.ndarray


def load_sentinel2_geotiff(
    image_path: str | Path,
    band_indexes: Sequence[int] | None = None,
) -> tuple[Array3D, dict]:
    """Load Sentinel-2 image bands from a GeoTIFF file.

    Parameters
    ----------
    image_path:
        Path to a Sentinel-2 GeoTIFF. The file may contain one band or a stack
        of multiple bands.
    band_indexes:
        Optional 1-based raster band indexes to read. Rasterio uses 1-based
        band numbering, so ``[1, 2, 3]`` reads the first three bands.

    Returns
    -------
    tuple[np.ndarray, dict]
        A ``(bands, rows, cols)`` image array and the raster profile metadata.

    TODO: Replace example paths in downstream scripts with the actual ISRO
    Hackathon Sentinel-2 raster paths.
    """

    path = Path(image_path)
    if not path.exists():
        raise FileNotFoundError(f"Sentinel-2 GeoTIFF not found: {path}")

    with rasterio.open(path) as src:
        if band_indexes is None:
            image_bands = src.read()
        else:
            image_bands = src.read(list(band_indexes))

        profile = src.profile.copy()

    return image_bands, profile


def load_label_raster(label_path: str | Path, band_index: int = 1) -> tuple[Array2D, dict]:
    """Load a single-band crop label raster.

    Parameters
    ----------
    label_path:
        Path to the crop label GeoTIFF.
    band_index:
        1-based raster band index containing crop labels.

    Returns
    -------
    tuple[np.ndarray, dict]
        A ``(rows, cols)`` label array and the raster profile metadata.

    Notes
    -----
    Label value ``0`` is reserved for unlabeled pixels and will be ignored when
    creating a training table.

    TODO: Confirm the official crop class IDs and class names for the final
    dataset.
    """

    path = Path(label_path)
    if not path.exists():
        raise FileNotFoundError(f"Label raster not found: {path}")

    with rasterio.open(path) as src:
        labels = src.read(band_index)
        profile = src.profile.copy()

    return labels, profile


def validate_image_label_shapes(image_bands: Array3D, labels: Array2D) -> None:
    """Validate that image bands and labels share the same raster shape."""

    if image_bands.ndim != 3:
        raise ValueError(
            "Expected image_bands with shape (bands, rows, cols), "
            f"got shape {image_bands.shape}."
        )

    if labels.ndim != 2:
        raise ValueError(
            "Expected labels with shape (rows, cols), "
            f"got shape {labels.shape}."
        )

    if image_bands.shape[1:] != labels.shape:
        raise ValueError(
            "Image and label raster shapes do not match. "
            f"Image rows/cols: {image_bands.shape[1:]}; labels: {labels.shape}."
        )


def validate_raster_profiles(image_profile: dict, label_profile: dict) -> None:
    """Validate key geospatial metadata for aligned rasters.

    Matching shape, CRS, and transform are important because each image pixel
    must correspond to the same ground location as its label pixel.
    """

    checks = {
        "width": (image_profile.get("width"), label_profile.get("width")),
        "height": (image_profile.get("height"), label_profile.get("height")),
        "crs": (image_profile.get("crs"), label_profile.get("crs")),
        "transform": (image_profile.get("transform"), label_profile.get("transform")),
    }

    mismatches = [
        name for name, (image_value, label_value) in checks.items() if image_value != label_value
    ]

    if mismatches:
        details = ", ".join(mismatches)
        raise ValueError(f"Image and label rasters are not aligned. Mismatch: {details}.")


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
    """Convert image bands and labels into a tabular machine learning dataset.

    Parameters
    ----------
    image_bands:
        Image array with shape ``(bands, rows, cols)``.
    labels:
        Label array with shape ``(rows, cols)``.
    band_names:
        Optional names for each image band. If omitted, names are generated as
        ``band_1``, ``band_2``, and so on.
    unlabeled_value:
        Label value to ignore. The default is ``0``.
    nodata_values:
        Optional feature values that should be treated as invalid.
    include_coordinates:
        If ``True``, add ``x`` and ``y`` columns from the raster transform.
    transform:
        Raster affine transform. Required when ``include_coordinates=True``.

    Returns
    -------
    pandas.DataFrame
        A table containing one row per labeled pixel, feature columns for each
        band, and one target column named ``label``.
    """

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
            raise ValueError("A raster transform is required when include_coordinates=True.")
        x_coords, y_coords = _pixel_centers(rows, cols, transform)
        table.insert(0, "y", y_coords.reshape(rows * cols)[valid_mask])
        table.insert(0, "x", x_coords.reshape(rows * cols)[valid_mask])

    return table


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


if __name__ == "__main__":
    # TODO: Replace these placeholders with real hackathon data paths.
    sentinel2_path = Path("member2_crop_classification/data/sentinel2_stack.tif")
    label_path = Path("member2_crop_classification/data/crop_labels.tif")

    print("This script provides reusable functions for loading raster data.")
    print(f"Expected Sentinel-2 example path: {sentinel2_path}")
    print(f"Expected label raster example path: {label_path}")
