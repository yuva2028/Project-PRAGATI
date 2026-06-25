"""Random Forest training pipeline for crop type classification."""

from __future__ import annotations

import argparse
import time
from pathlib import Path
from typing import Any, Mapping

import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import GridSearchCV
from sklearn.pipeline import Pipeline

try:
    from .evaluate import evaluate_predictions
    from .feature_engineering import validate_feature_dataframe
    from .load_data import load_or_create_training_dataframe
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
    from .visualize import plot_class_distribution, plot_feature_importance
except ImportError:  # pragma: no cover - supports direct script execution.
    from evaluate import evaluate_predictions
    from feature_engineering import validate_feature_dataframe
    from load_data import load_or_create_training_dataframe
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
    from visualize import plot_class_distribution, plot_feature_importance


def create_random_forest_pipeline(
    model_config: Mapping[str, Any] | None = None,
) -> Pipeline:
    """Create the configured RandomForestClassifier pipeline."""

    config = model_config or {}
    classifier = RandomForestClassifier(
        n_estimators=int(config.get("n_estimators", 500)),
        max_depth=config.get("max_depth"),
        min_samples_leaf=int(config.get("min_samples_leaf", 2)),
        class_weight=config.get("class_weight", "balanced"),
        n_jobs=int(config.get("n_jobs", -1)),
        random_state=int(config.get("random_state", 42)),
    )
    return Pipeline(steps=[("classifier", classifier)])


def run_grid_search(
    pipeline: Pipeline,
    x_train: np.ndarray,
    y_train: np.ndarray,
    grid_config: Mapping[str, Any],
) -> GridSearchCV:
    """Run GridSearchCV for Random Forest hyperparameters."""

    raw_grid = grid_config.get("param_grid", {})
    param_grid = {
        f"classifier__{param_name}": values
        for param_name, values in raw_grid.items()
    }
    if not param_grid:
        raise ValueError("Grid search is enabled but param_grid is empty.")

    cv_folds = _resolve_cv_folds(y_train, int(grid_config.get("cv", 3)))
    search = GridSearchCV(
        estimator=pipeline,
        param_grid=param_grid,
        scoring=str(grid_config.get("scoring", "f1_weighted")),
        cv=cv_folds,
        n_jobs=int(grid_config.get("n_jobs", -1)),
        refit=True,
        return_train_score=True,
    )
    search.fit(x_train, y_train)
    return search


def train_random_forest(config_path: str | Path | None = None) -> dict[str, Any]:
    """Train, tune, evaluate, and save the Random Forest crop classifier."""

    config = load_config(config_path)
    ensure_project_directories(config)
    logger = setup_logging(config)
    seed = get_random_seed(config)
    set_random_seed(seed)

    logger.info("Starting Random Forest training pipeline.")
    start_time = time.perf_counter()

    dataframe = load_or_create_training_dataframe(config, logger=logger)
    target_column = str(config.get("training", {}).get("target_column", "label"))
    features, target, feature_names = validate_feature_dataframe(
        dataframe,
        target_column=target_column,
    )
    labels = sorted(np.unique(target).astype(int).tolist())

    logger.info("Dataset size: %d samples, %d features.", features.shape[0], features.shape[1])
    logger.info("Class distribution: %s", _class_distribution(target))

    x_train, x_test, y_train, y_test = stratified_train_test_split(
        features,
        target,
        test_size=float(config.get("training", {}).get("test_size", 0.2)),
        random_state=seed,
    )

    model_config = config.get("model", {}).get("random_forest", {})
    grid_config = config.get("model", {}).get("grid_search", {})
    pipeline = create_random_forest_pipeline(model_config)
    best_params: dict[str, Any] = {}

    if bool(grid_config.get("enabled", True)):
        logger.info("Running Random Forest GridSearchCV.")
        search = run_grid_search(pipeline, x_train, y_train, grid_config)
        model = search.best_estimator_
        best_params = {
            key.replace("classifier__", ""): value
            for key, value in search.best_params_.items()
        }
        logger.info("Best parameters: %s", best_params)
    else:
        logger.info("Grid search disabled; fitting configured Random Forest.")
        model = pipeline.fit(x_train, y_train)

    predictions = model.predict(x_test)
    class_names = normalize_class_mapping(config)
    evaluation = evaluate_predictions(
        y_test,
        predictions,
        labels=labels,
        class_names=class_names,
        confusion_matrix_path=get_path(config, "confusion_matrix"),
        report_path=get_path(config, "classification_report"),
        metrics_path=get_path(config, "metrics_json"),
    )

    plot_class_distribution(
        target,
        get_path(config, "class_distribution"),
        class_names=class_names,
    )
    plot_feature_importance(
        model,
        feature_names,
        get_path(config, "feature_importance"),
    )

    training_seconds = time.perf_counter() - start_time
    metrics = evaluation["metrics"]
    logger.info("Training time: %.2f seconds.", training_seconds)
    logger.info("Accuracy: %.6f", metrics["overall_accuracy"])

    model_path = get_path(config, "model")
    if model_path is None:
        raise ValueError("paths.model must be configured.")
    saved_model = save_model_bundle(
        {
            "model": model,
            "model_type": "random_forest",
            "feature_names": feature_names,
            "class_names": class_names,
            "labels": labels,
            "best_params": best_params,
            "metrics": metrics,
            "trained_at": timestamp_utc(),
            "config": config,
        },
        model_path,
    )
    logger.info("Saved best model: %s", saved_model)

    return {
        "model": model,
        "model_path": saved_model,
        "metrics": metrics,
        "best_params": best_params,
        "feature_names": feature_names,
    }


def _class_distribution(target: np.ndarray) -> dict[int, int]:
    """Return class counts as a JSON-friendly dictionary."""

    labels, counts = np.unique(target, return_counts=True)
    return {
        int(label): int(count)
        for label, count in zip(labels, counts, strict=True)
    }


def _resolve_cv_folds(target: np.ndarray, requested_cv: int) -> int:
    """Return a valid stratified CV fold count for the training labels."""

    if requested_cv < 2:
        raise ValueError("GridSearchCV requires at least 2 CV folds.")

    _labels, counts = np.unique(target, return_counts=True)
    min_class_count = int(np.min(counts))
    cv_folds = min(requested_cv, min_class_count)
    if cv_folds < 2:
        raise ValueError(
            "GridSearchCV requires at least two training samples per class. "
            f"Minimum class count: {min_class_count}."
        )
    return cv_folds


def main() -> None:
    """CLI entrypoint for Random Forest training."""

    parser = argparse.ArgumentParser(description="Train Member 2 Random Forest model.")
    parser.add_argument("--config", default=None, help="Path to YAML config file.")
    args = parser.parse_args()
    train_random_forest(args.config)


if __name__ == "__main__":
    main()
