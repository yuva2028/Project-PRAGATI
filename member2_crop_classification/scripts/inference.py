"""Full-raster inference and crop-map export for Member 2."""

from __future__ import annotations

import argparse
from pathlib import Path
from typing import Any, Mapping

import numpy as np
import rasterio

try:
    from .feature_engineering import build_feature_stack
    from .load_data import load_inference_inputs
    from .utils import (
        ensure_parent,
        get_path,
        load_config,
        load_model_bundle,
        normalize_class_mapping,
        save_json,
        setup_logging,
        timestamp_utc,
    )
    from .visualize import plot_crop_map
except ImportError:  # pragma: no cover - supports direct script execution.
    from feature_engineering import build_feature_stack
    from load_data import load_inference_inputs
    from utils import (
        ensure_parent,
        get_path,
        load_config,
        load_model_bundle,
        normalize_class_mapping,
        save_json,
        setup_logging,
        timestamp_utc,
    )
    from visualize import plot_crop_map


def run_inference(config_path: str | Path | None = None) -> dict[str, Path]:
    """Run full-raster crop classification and export artifacts."""

    config = load_config(config_path)
    logger = setup_logging(config)
    class_names = normalize_class_mapping(config)

    model_path = get_path(config, "model")
    if model_path is None:
        raise ValueError("paths.model must be configured.")

    bundle = load_model_bundle(model_path)
    model = bundle["model"]
    feature_names = list(bundle.get("feature_names", []))
    if not feature_names:
        raise ValueError("Model bundle does not contain feature_names.")

    bands, profile = load_inference_inputs(config, logger=logger)
    feature_config = dict(config.get("features", {}))
    feature_config["include_sentinel1_ratio"] = bool(
        config.get("sentinel1", {}).get("include_ratio", True)
    )
    feature_stack = build_feature_stack(bands, feature_config)
    missing_features = [
        feature_name
        for feature_name in feature_names
        if feature_name not in feature_stack.arrays
    ]
    if missing_features:
        raise ValueError(
            "Inference features do not match the trained model. "
            f"Missing: {missing_features}"
        )

    nodata_value = int(config.get("inference", {}).get("nodata_value", 0))
    crop_map = predict_raster(
        model,
        feature_stack.arrays,
        feature_stack.valid_mask,
        feature_names,
        chunk_size=int(config.get("inference", {}).get("prediction_chunk_size", 250000)),
        nodata_value=nodata_value,
        label_encoder=bundle.get("label_encoder"),
    )

    crop_map_path = get_path(config, "crop_map_tif")
    integration_path = get_path(config, "crop_predictions_tif")
    crop_png_path = get_path(config, "crop_map_png")
    statistics_path = get_path(config, "crop_statistics")

    if crop_map_path is None or integration_path is None:
        raise ValueError("Crop map output paths must be configured.")

    write_classified_geotiff(crop_map, profile, crop_map_path, nodata_value=nodata_value)
    write_classified_geotiff(crop_map, profile, integration_path, nodata_value=nodata_value)

    if crop_png_path is not None:
        plot_crop_map(
            crop_map,
            crop_png_path,
            class_names=class_names,
            nodata_value=nodata_value,
        )

    if statistics_path is not None:
        statistics = calculate_crop_statistics(
            crop_map,
            profile,
            class_names=class_names,
            nodata_value=nodata_value,
        )
        save_json(statistics, statistics_path)

    logger.info("Saved crop map: %s", crop_map_path)
    logger.info("Saved Member 3 integration raster: %s", integration_path)

    outputs = {
        "crop_map_tif": crop_map_path,
        "crop_predictions_tif": integration_path,
    }
    if crop_png_path is not None:
        outputs["crop_map_png"] = crop_png_path
    if statistics_path is not None:
        outputs["crop_statistics"] = statistics_path
    return outputs


def predict_raster(
    model: object,
    feature_arrays: Mapping[str, np.ndarray],
    valid_mask: np.ndarray,
    feature_names: list[str],
    *,
    chunk_size: int,
    nodata_value: int = 0,
    label_encoder: object | None = None,
) -> np.ndarray:
    """Predict crop classes for all valid raster pixels."""

    if chunk_size <= 0:
        raise ValueError("chunk_size must be positive.")

    rows, cols = valid_mask.shape
    flat_valid = valid_mask.reshape(-1)
    valid_indices = np.flatnonzero(flat_valid)
    prediction_flat = np.full(rows * cols, nodata_value, dtype=np.int32)

    feature_matrix = np.column_stack(
        [
            np.asarray(feature_arrays[name], dtype=np.float32).reshape(-1)[flat_valid]
            for name in feature_names
        ]
    )

    for start in range(0, len(valid_indices), chunk_size):
        end = min(start + chunk_size, len(valid_indices))
        chunk = feature_matrix[start:end]
        predictions = model.predict(chunk)
        if label_encoder is not None:
            predictions = label_encoder.inverse_transform(predictions.astype(int))
        prediction_flat[valid_indices[start:end]] = predictions.astype(np.int32)

    return prediction_flat.reshape(rows, cols)


def write_classified_geotiff(
    crop_map: np.ndarray,
    reference_profile: Mapping[str, Any],
    output_path: str | Path,
    *,
    nodata_value: int = 0,
) -> Path:
    """Write a classified crop raster using reference geospatial metadata."""

    output = Path(output_path)
    ensure_parent(output)

    profile = dict(reference_profile)
    profile.update(
        driver="GTiff",
        count=1,
        dtype=rasterio.int32,
        nodata=nodata_value,
        compress="lzw",
    )

    with rasterio.open(output, "w", **profile) as dst:
        dst.write(crop_map.astype(np.int32), 1)

    return output


def calculate_crop_statistics(
    crop_map: np.ndarray,
    reference_profile: Mapping[str, Any],
    *,
    class_names: Mapping[int, str] | None = None,
    nodata_value: int = 0,
) -> dict[str, Any]:
    """Create crop count and percentage statistics for integration."""

    valid_predictions = crop_map[crop_map != nodata_value]
    unique_labels, counts = np.unique(valid_predictions, return_counts=True)
    total = int(counts.sum()) if counts.size else 0

    crops: dict[str, dict[str, Any]] = {}
    for label, count in zip(unique_labels, counts, strict=True):
        label_int = int(label)
        percentage = (float(count) / total * 100.0) if total else 0.0
        crops[str(label_int)] = {
            "name": class_names.get(label_int, str(label_int)) if class_names else str(label_int),
            "count": int(count),
            "percentage": percentage,
        }

    transform = reference_profile.get("transform")
    transform_values = list(transform.to_gdal()) if transform is not None else None
    crs = reference_profile.get("crs")

    return {
        "generated_at": timestamp_utc(),
        "nodata_value": nodata_value,
        "total_predicted_pixels": total,
        "crop_counts": {key: value["count"] for key, value in crops.items()},
        "crop_percentages": {
            key: value["percentage"] for key, value in crops.items()
        },
        "crops": crops,
        "metadata": {
            "height": int(reference_profile.get("height", crop_map.shape[0])),
            "width": int(reference_profile.get("width", crop_map.shape[1])),
            "crs": str(crs) if crs is not None else None,
            "transform_gdal": transform_values,
        },
    }


def main() -> None:
    """CLI entrypoint for raster inference."""

    parser = argparse.ArgumentParser(description="Run Member 2 crop inference.")
    parser.add_argument("--config", default=None, help="Path to YAML config file.")
    args = parser.parse_args()
    run_inference(args.config)


if __name__ == "__main__":
    main()

