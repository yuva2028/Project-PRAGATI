"""Model evaluation utilities for crop type classification."""

from __future__ import annotations

import argparse
from pathlib import Path
from typing import Any, Mapping, Sequence

import numpy as np
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    cohen_kappa_score,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
)

try:
    from project.ml.crop.feature_engineering import validate_feature_dataframe
    from project.ml.crop.load_data import load_or_create_training_dataframe
    from project.ml.crop.utils import (
        get_path,
        get_random_seed,
        load_config,
        load_model_bundle,
        normalize_class_mapping,
        save_json,
        setup_logging,
        stratified_train_test_split,
    )
    from project.ml.crop.visualize import plot_confusion_matrix
except ImportError as e:  # pragma: no cover - supports local package execution.
    print(f"[WARN] Falling back to relative crop imports in evaluate: {e}")
    try:
        from .feature_engineering import validate_feature_dataframe
        from .load_data import load_or_create_training_dataframe
        from .utils import (
            get_path,
            get_random_seed,
            load_config,
            load_model_bundle,
            normalize_class_mapping,
            save_json,
            setup_logging,
            stratified_train_test_split,
        )
        from .visualize import plot_confusion_matrix
    except ImportError as fallback_error:  # pragma: no cover - supports direct script execution.
        print(f"[WARN] Falling back to script-local crop imports in evaluate: {fallback_error}")
        from feature_engineering import validate_feature_dataframe
        from load_data import load_or_create_training_dataframe
        from utils import (
            get_path,
            get_random_seed,
            load_config,
            load_model_bundle,
            normalize_class_mapping,
            save_json,
            setup_logging,
            stratified_train_test_split,
        )
        from visualize import plot_confusion_matrix


def compute_metrics(
    y_true: np.ndarray,
    y_pred: np.ndarray,
    *,
    labels: Sequence[int] | None = None,
    class_names: Mapping[int, str] | None = None,
) -> dict[str, Any]:
    """Compute overall, weighted, macro, and per-class metrics."""

    if labels is None:
        labels = sorted(np.unique(np.concatenate([y_true, y_pred])))
    metric_labels = np.asarray(labels)
    target_names = [
        class_names.get(int(label), str(int(label))) if class_names else str(int(label))
        for label in metric_labels
    ]

    report_dict = classification_report(
        y_true,
        y_pred,
        labels=metric_labels,
        target_names=target_names,
        output_dict=True,
        zero_division=0,
    )

    per_class = {
        target_name: {
            "precision": float(report_dict[target_name]["precision"]),
            "recall": float(report_dict[target_name]["recall"]),
            "f1_score": float(report_dict[target_name]["f1-score"]),
            "support": int(report_dict[target_name]["support"]),
        }
        for target_name in target_names
    }

    return {
        "overall_accuracy": float(accuracy_score(y_true, y_pred)),
        "cohen_kappa": float(cohen_kappa_score(y_true, y_pred, labels=metric_labels)),
        "precision_macro": float(
            precision_score(y_true, y_pred, average="macro", zero_division=0)
        ),
        "recall_macro": float(
            recall_score(y_true, y_pred, average="macro", zero_division=0)
        ),
        "f1_macro": float(f1_score(y_true, y_pred, average="macro", zero_division=0)),
        "precision_weighted": float(
            precision_score(y_true, y_pred, average="weighted", zero_division=0)
        ),
        "recall_weighted": float(
            recall_score(y_true, y_pred, average="weighted", zero_division=0)
        ),
        "f1_weighted": float(
            f1_score(y_true, y_pred, average="weighted", zero_division=0)
        ),
        "per_class": per_class,
    }


def classification_report_text(
    y_true: np.ndarray,
    y_pred: np.ndarray,
    *,
    labels: Sequence[int],
    class_names: Mapping[int, str] | None = None,
) -> str:
    """Return a human-readable classification report."""

    target_names = [
        class_names.get(int(label), str(int(label))) if class_names else str(int(label))
        for label in labels
    ]
    return classification_report(
        y_true,
        y_pred,
        labels=labels,
        target_names=target_names,
        zero_division=0,
    )


def save_classification_report(
    report_text: str,
    metrics: Mapping[str, Any],
    output_path: str | Path,
) -> Path:
    """Save the text report and headline metrics."""

    output = Path(output_path)
    output.parent.mkdir(parents=True, exist_ok=True)

    with output.open("w", encoding="utf-8") as file:
        file.write("Crop Type Classification Report\n")
        file.write("================================\n\n")
        file.write(report_text)
        file.write("\n\nHeadline Metrics\n")
        file.write("----------------\n")
        for key in (
            "overall_accuracy",
            "cohen_kappa",
            "precision_weighted",
            "recall_weighted",
            "f1_weighted",
        ):
            file.write(f"{key}: {metrics[key]:.6f}\n")

    return output


def evaluate_predictions(
    y_true: np.ndarray,
    y_pred: np.ndarray,
    *,
    labels: Sequence[int],
    class_names: Mapping[int, str],
    confusion_matrix_path: str | Path,
    report_path: str | Path,
    metrics_path: str | Path | None = None,
) -> dict[str, Any]:
    """Generate metrics, report, and confusion matrix artifacts."""

    matrix = confusion_matrix(y_true, y_pred, labels=labels)
    metrics = compute_metrics(
        y_true,
        y_pred,
        labels=labels,
        class_names=class_names,
    )
    report_text = classification_report_text(
        y_true,
        y_pred,
        labels=labels,
        class_names=class_names,
    )

    plot_confusion_matrix(
        matrix,
        labels,
        confusion_matrix_path,
        class_names=class_names,
    )
    save_classification_report(report_text, metrics, report_path)

    if metrics_path is not None:
        save_json(metrics, metrics_path)

    return {"metrics": metrics, "confusion_matrix": matrix}


def evaluate_saved_model(config_path: str | Path | None = None) -> dict[str, Any]:
    """Evaluate a saved model using the configured dataset split."""

    config = load_config(config_path)
    logger = setup_logging(config)
    class_names = normalize_class_mapping(config)

    model_path = get_path(config, "model")
    if model_path is None:
        raise ValueError("paths.model must be configured.")
    bundle = load_model_bundle(model_path)
    model = bundle["model"]

    dataframe = load_or_create_training_dataframe(config, logger=logger)
    target_column = str(config.get("training", {}).get("target_column", "label"))
    features, target, feature_names = validate_feature_dataframe(
        dataframe,
        target_column=target_column,
    )

    expected_features = bundle.get("feature_names", feature_names)
    missing_features = [
        feature_name
        for feature_name in expected_features
        if feature_name not in dataframe.columns
    ]
    if missing_features:
        raise ValueError(
            "Dataset is missing features required by the saved model: "
            f"{missing_features}"
        )

    dataframe = dataframe[[*expected_features, target_column]]
    features, target, _ = validate_feature_dataframe(dataframe, target_column=target_column)

    _x_train, x_test, _y_train, y_test = stratified_train_test_split(
        features,
        target,
        test_size=float(config.get("training", {}).get("test_size", 0.2)),
        random_state=get_random_seed(config),
    )
    predictions = model.predict(x_test)
    labels = sorted(np.unique(target).astype(int).tolist())

    logger.info("Evaluating saved model from %s", model_path)
    return evaluate_predictions(
        y_test,
        predictions,
        labels=labels,
        class_names=class_names,
        confusion_matrix_path=get_path(config, "confusion_matrix"),
        report_path=get_path(config, "classification_report"),
        metrics_path=get_path(config, "metrics_json"),
    )


def main() -> None:
    """CLI entrypoint for saved-model evaluation."""

    parser = argparse.ArgumentParser(description="Evaluate Member 2 crop model.")
    parser.add_argument("--config", default=None, help="Path to YAML config file.")
    args = parser.parse_args()
    evaluate_saved_model(args.config)


if __name__ == "__main__":
    main()
