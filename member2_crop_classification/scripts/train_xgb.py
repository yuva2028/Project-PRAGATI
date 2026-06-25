"""Optional XGBoost training and RF-vs-XGB comparison for Member 2."""

from __future__ import annotations

import argparse
import time
from pathlib import Path
from typing import Any

import pandas as pd
from sklearn.preprocessing import LabelEncoder

try:
    from .evaluate import compute_metrics
    from .feature_engineering import validate_feature_dataframe
    from .load_data import load_or_create_training_dataframe
    from .train_rf import create_random_forest_pipeline
    from .utils import (
        ensure_project_directories,
        get_path,
        get_random_seed,
        load_config,
        normalize_class_mapping,
        save_model_bundle,
        set_random_seed,
        setup_logging,
        stratified_train_test_split,
        timestamp_utc,
    )
except ImportError:  # pragma: no cover - supports direct script execution.
    from evaluate import compute_metrics
    from feature_engineering import validate_feature_dataframe
    from load_data import load_or_create_training_dataframe
    from train_rf import create_random_forest_pipeline
    from utils import (
        ensure_project_directories,
        get_path,
        get_random_seed,
        load_config,
        normalize_class_mapping,
        save_model_bundle,
        set_random_seed,
        setup_logging,
        stratified_train_test_split,
        timestamp_utc,
    )


def train_xgboost(config_path: str | Path | None = None) -> pd.DataFrame:
    """Train optional XGBoost and save a comparison table with Random Forest."""

    try:
        from xgboost import XGBClassifier
    except ImportError as exc:
        raise ImportError(
            "XGBoost is optional and is not installed. Install it with "
            "`pip install xgboost` to run scripts/train_xgb.py."
        ) from exc

    config = load_config(config_path)
    ensure_project_directories(config)
    logger = setup_logging(config)
    seed = get_random_seed(config)
    set_random_seed(seed)
    class_names = normalize_class_mapping(config)

    dataframe = load_or_create_training_dataframe(config, logger=logger)
    target_column = str(config.get("training", {}).get("target_column", "label"))
    features, target, feature_names = validate_feature_dataframe(
        dataframe,
        target_column=target_column,
    )

    x_train, x_test, y_train, y_test = stratified_train_test_split(
        features,
        target,
        test_size=float(config.get("training", {}).get("test_size", 0.2)),
        random_state=seed,
    )

    comparison_rows: list[dict[str, Any]] = []

    rf_start = time.perf_counter()
    rf_model = create_random_forest_pipeline(config.get("model", {}).get("random_forest", {}))
    rf_model.fit(x_train, y_train)
    rf_predictions = rf_model.predict(x_test)
    comparison_rows.append(
        _comparison_row(
            "Random Forest",
            compute_metrics(y_test, rf_predictions, class_names=class_names),
            time.perf_counter() - rf_start,
        )
    )

    label_encoder = LabelEncoder()
    y_train_encoded = label_encoder.fit_transform(y_train)

    xgb_config = dict(config.get("model", {}).get("xgboost", {}))
    xgb_config.pop("enabled", None)
    xgb_config.setdefault("random_state", seed)

    xgb_start = time.perf_counter()
    xgb_model = XGBClassifier(**xgb_config)
    xgb_model.fit(x_train, y_train_encoded)
    xgb_predictions_encoded = xgb_model.predict(x_test)
    xgb_predictions = label_encoder.inverse_transform(
        xgb_predictions_encoded.astype(int)
    )
    xgb_metrics = compute_metrics(y_test, xgb_predictions, class_names=class_names)
    comparison_rows.append(
        _comparison_row("XGBoost", xgb_metrics, time.perf_counter() - xgb_start)
    )

    xgb_model_path = get_path(config, "xgboost_model")
    if xgb_model_path is None:
        raise ValueError("paths.xgboost_model must be configured.")
    save_model_bundle(
        {
            "model": xgb_model,
            "model_type": "xgboost",
            "label_encoder": label_encoder,
            "feature_names": feature_names,
            "class_names": class_names,
            "metrics": xgb_metrics,
            "trained_at": timestamp_utc(),
            "config": config,
        },
        xgb_model_path,
    )

    comparison = pd.DataFrame(comparison_rows)
    comparison_path = get_path(config, "model_comparison")
    if comparison_path is not None:
        comparison_path.parent.mkdir(parents=True, exist_ok=True)
        comparison.to_csv(comparison_path, index=False)
        logger.info("Saved model comparison table: %s", comparison_path)

    logger.info("Saved optional XGBoost model: %s", xgb_model_path)
    return comparison


def _comparison_row(
    model_name: str,
    metrics: dict[str, Any],
    training_seconds: float,
) -> dict[str, Any]:
    """Create one model-comparison row."""

    return {
        "model": model_name,
        "overall_accuracy": metrics["overall_accuracy"],
        "cohen_kappa": metrics["cohen_kappa"],
        "precision_weighted": metrics["precision_weighted"],
        "recall_weighted": metrics["recall_weighted"],
        "f1_weighted": metrics["f1_weighted"],
        "training_seconds": training_seconds,
    }


def main() -> None:
    """CLI entrypoint for optional XGBoost training."""

    parser = argparse.ArgumentParser(
        description="Train optional XGBoost and compare with Random Forest."
    )
    parser.add_argument("--config", default=None, help="Path to YAML config file.")
    args = parser.parse_args()
    train_xgboost(args.config)


if __name__ == "__main__":
    main()

