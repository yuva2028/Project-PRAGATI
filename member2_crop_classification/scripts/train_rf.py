"""Random Forest baseline for Member 2 crop type classification.

This script provides a clean training function for the first hackathon
prototype. It expects a tabular dataset where each row is a labeled pixel and
the target column contains crop class IDs.
"""

from __future__ import annotations

from pathlib import Path
from typing import Iterable

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import ConfusionMatrixDisplay, accuracy_score, confusion_matrix
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline


DEFAULT_OUTPUT_DIR = Path("member2_crop_classification/outputs")
DEFAULT_CONFUSION_MATRIX_PATH = DEFAULT_OUTPUT_DIR / "confusion_matrix.png"


def create_random_forest_pipeline(
    *,
    n_estimators: int = 300,
    random_state: int = 42,
    class_weight: str | None = "balanced",
) -> Pipeline:
    """Create a RandomForestClassifier pipeline.

    A pipeline is used even though Random Forest does not need feature scaling.
    This keeps the training interface ready for future preprocessing steps.
    """

    classifier = RandomForestClassifier(
        n_estimators=n_estimators,
        random_state=random_state,
        class_weight=class_weight,
        n_jobs=-1,
        max_features="sqrt",
    )

    return Pipeline(steps=[("classifier", classifier)])


def train_random_forest(
    dataframe: pd.DataFrame,
    *,
    target_col: str = "label",
    test_size: float = 0.2,
    random_state: int = 42,
    output_path: str | Path = DEFAULT_CONFUSION_MATRIX_PATH,
    class_names: dict[int, str] | None = None,
) -> dict[str, object]:
    """Train and evaluate a Random Forest classifier.

    Parameters
    ----------
    dataframe:
        Training table containing numeric feature columns and one target column.
    target_col:
        Name of the target label column.
    test_size:
        Fraction of data reserved for testing.
    random_state:
        Seed for reproducible train/test split and model training.
    output_path:
        Path where the confusion matrix image will be saved.
    class_names:
        Optional mapping from numeric class ID to crop name.

    Returns
    -------
    dict[str, object]
        Dictionary containing the trained model, accuracy, confusion matrix,
        train/test arrays, and feature names.

    TODO: Replace class_names with the official crop class mapping when the
    final dataset is available.
    """

    features, target, feature_names = _prepare_training_arrays(dataframe, target_col)
    labels = np.array(sorted(np.unique(target)))

    stratify = target if _can_stratify(target, test_size) else None

    x_train, x_test, y_train, y_test = train_test_split(
        features,
        target,
        test_size=test_size,
        random_state=random_state,
        stratify=stratify,
    )

    model = create_random_forest_pipeline(random_state=random_state)
    model.fit(x_train, y_train)

    predictions = model.predict(x_test)
    accuracy = accuracy_score(y_test, predictions)
    matrix = confusion_matrix(y_test, predictions, labels=labels)

    save_confusion_matrix(
        matrix,
        labels=labels,
        output_path=output_path,
        class_names=class_names,
    )

    return {
        "model": model,
        "accuracy": accuracy,
        "confusion_matrix": matrix,
        "labels": labels,
        "feature_names": feature_names,
        "x_train": x_train,
        "x_test": x_test,
        "y_train": y_train,
        "y_test": y_test,
        "predictions": predictions,
    }


def save_confusion_matrix(
    matrix: np.ndarray,
    *,
    labels: Iterable[int],
    output_path: str | Path = DEFAULT_CONFUSION_MATRIX_PATH,
    class_names: dict[int, str] | None = None,
) -> Path:
    """Save a confusion matrix image to disk."""

    output = Path(output_path)
    output.parent.mkdir(parents=True, exist_ok=True)

    labels = list(labels)
    display_labels = [
        class_names.get(int(label), str(label)) if class_names else str(label)
        for label in labels
    ]

    fig, ax = plt.subplots(figsize=(8, 6))
    display = ConfusionMatrixDisplay(
        confusion_matrix=matrix,
        display_labels=display_labels,
    )
    display.plot(
        ax=ax,
        cmap="Blues",
        values_format="d",
        colorbar=False,
    )
    ax.set_title("Crop Type Classification Confusion Matrix")
    ax.set_xlabel("Predicted crop class")
    ax.set_ylabel("Actual crop class")
    fig.tight_layout()
    fig.savefig(output, dpi=200)
    plt.close(fig)

    return output


def _prepare_training_arrays(
    dataframe: pd.DataFrame,
    target_col: str,
) -> tuple[np.ndarray, np.ndarray, list[str]]:
    """Extract clean feature and target arrays from a DataFrame."""

    if target_col not in dataframe.columns:
        raise ValueError(f"Target column not found: {target_col}")

    feature_names = [column for column in dataframe.columns if column != target_col]
    if not feature_names:
        raise ValueError("At least one feature column is required for training.")

    features = dataframe[feature_names].to_numpy(dtype=np.float32)
    target = dataframe[target_col].to_numpy(dtype=np.int32)

    valid_mask = np.all(np.isfinite(features), axis=1)
    features = features[valid_mask]
    target = target[valid_mask]

    if len(np.unique(target)) < 2:
        raise ValueError("Training requires at least two crop classes.")

    return features, target, feature_names


def _can_stratify(target: np.ndarray, test_size: float) -> bool:
    """Check whether stratified splitting is safe for the current class counts."""

    labels, counts = np.unique(target, return_counts=True)
    test_count = int(np.ceil(len(target) * test_size))
    train_count = len(target) - test_count

    return (
        len(labels) > 1
        and np.all(counts >= 2)
        and test_count >= len(labels)
        and train_count >= len(labels)
    )


if __name__ == "__main__":
    # TODO: Replace this placeholder with a real engineered training CSV path.
    dataset_path = Path("member2_crop_classification/data/training_pixels.csv")

    if not dataset_path.exists():
        print("Training CSV not found.")
        print(f"Expected placeholder path: {dataset_path}")
        print("Create this file after raster loading and feature engineering are connected.")
    else:
        training_data = pd.read_csv(dataset_path)

        # TODO: Replace with official crop class names.
        crop_class_names = {
            1: "Crop_1",
            2: "Crop_2",
            3: "Crop_3",
        }

        results = train_random_forest(
            training_data,
            class_names=crop_class_names,
        )
        print(f"Accuracy: {results['accuracy']:.4f}")
        print(f"Confusion matrix saved to: {DEFAULT_CONFUSION_MATRIX_PATH}")

