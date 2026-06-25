"""Publication-quality visualizations for Member 2 outputs."""

from __future__ import annotations

from pathlib import Path
from typing import Mapping, Sequence

import matplotlib

matplotlib.use("Agg")

import matplotlib.pyplot as plt
import numpy as np
from matplotlib.colors import BoundaryNorm, ListedColormap
from matplotlib.patches import Patch
from sklearn.metrics import ConfusionMatrixDisplay

try:
    from .utils import ensure_parent, format_class_labels
except ImportError:  # pragma: no cover - supports direct script execution.
    from utils import ensure_parent, format_class_labels


def plot_confusion_matrix(
    matrix: np.ndarray,
    labels: Sequence[int],
    output_path: str | Path,
    *,
    class_names: Mapping[int, str] | None = None,
    title: str = "Crop Type Classification Confusion Matrix",
) -> Path:
    """Save a confusion matrix plot."""

    output = Path(output_path)
    ensure_parent(output)
    display_labels = format_class_labels(labels, class_names)

    fig, ax = plt.subplots(figsize=(9, 7))
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
    ax.set_title(title, fontsize=13, weight="bold")
    ax.set_xlabel("Predicted crop class")
    ax.set_ylabel("Reference crop class")
    ax.tick_params(axis="x", rotation=35)
    fig.tight_layout()
    fig.savefig(output, dpi=220, bbox_inches="tight")
    plt.close(fig)
    return output


def plot_class_distribution(
    labels: np.ndarray,
    output_path: str | Path,
    *,
    class_names: Mapping[int, str] | None = None,
) -> Path:
    """Save a class-distribution bar chart."""

    output = Path(output_path)
    ensure_parent(output)

    class_ids, counts = np.unique(labels, return_counts=True)
    display_labels = format_class_labels(class_ids, class_names)

    fig, ax = plt.subplots(figsize=(10, 6))
    bars = ax.bar(display_labels, counts, color="#2f6f9f", edgecolor="#1f2933")
    ax.set_title("Training Class Distribution", fontsize=13, weight="bold")
    ax.set_xlabel("Crop class")
    ax.set_ylabel("Pixel count")
    ax.grid(axis="y", alpha=0.25)
    ax.tick_params(axis="x", rotation=35)

    for bar, count in zip(bars, counts, strict=True):
        ax.text(
            bar.get_x() + bar.get_width() / 2,
            bar.get_height(),
            f"{int(count):,}",
            ha="center",
            va="bottom",
            fontsize=9,
        )

    fig.tight_layout()
    fig.savefig(output, dpi=220, bbox_inches="tight")
    plt.close(fig)
    return output


def plot_feature_importance(
    model: object,
    feature_names: Sequence[str],
    output_path: str | Path,
    *,
    top_n: int = 25,
) -> Path:
    """Save a feature-importance plot for tree-based models."""

    output = Path(output_path)
    ensure_parent(output)

    estimator = _unwrap_estimator(model)
    importances = getattr(estimator, "feature_importances_", None)
    if importances is None:
        raise AttributeError("The fitted model does not expose feature_importances_.")

    importance_array = np.asarray(importances, dtype=np.float32)
    order = np.argsort(importance_array)[::-1][:top_n]
    ordered_names = np.asarray(feature_names)[order]
    ordered_values = importance_array[order]

    fig_height = max(5.0, 0.32 * len(order))
    fig, ax = plt.subplots(figsize=(10, fig_height))
    ax.barh(ordered_names[::-1], ordered_values[::-1], color="#3a7d44")
    ax.set_title("Feature Importance", fontsize=13, weight="bold")
    ax.set_xlabel("Mean decrease in impurity")
    ax.grid(axis="x", alpha=0.25)
    fig.tight_layout()
    fig.savefig(output, dpi=220, bbox_inches="tight")
    plt.close(fig)
    return output


def plot_crop_map(
    crop_map: np.ndarray,
    output_path: str | Path,
    *,
    class_names: Mapping[int, str] | None = None,
    nodata_value: int = 0,
) -> Path:
    """Save a PNG preview of a classified crop map."""

    output = Path(output_path)
    ensure_parent(output)

    labels = sorted(int(value) for value in np.unique(crop_map) if value != nodata_value)
    display = np.zeros_like(crop_map, dtype=np.int32)
    for index, label in enumerate(labels, start=1):
        display[crop_map == label] = index

    colors = ["#f2f2f2"] + [
        plt.cm.tab20(index % 20) for index in range(max(len(labels), 1))
    ]
    cmap = ListedColormap(colors)
    norm = BoundaryNorm(np.arange(len(labels) + 2) - 0.5, cmap.N)

    fig, ax = plt.subplots(figsize=(10, 10))
    ax.imshow(display, cmap=cmap, norm=norm, interpolation="nearest")
    ax.set_title("Predicted Crop Type Map", fontsize=13, weight="bold")
    ax.set_axis_off()

    legend_handles = [
        Patch(facecolor=colors[0], edgecolor="none", label="No prediction")
    ]
    for index, label in enumerate(labels, start=1):
        label_name = class_names.get(label, str(label)) if class_names else str(label)
        legend_handles.append(
            Patch(facecolor=colors[index], edgecolor="none", label=label_name)
        )

    ax.legend(
        handles=legend_handles,
        loc="lower center",
        bbox_to_anchor=(0.5, -0.04),
        ncol=min(4, max(1, len(legend_handles))),
        frameon=False,
    )
    fig.tight_layout()
    fig.savefig(output, dpi=220, bbox_inches="tight")
    plt.close(fig)
    return output


def _unwrap_estimator(model: object) -> object:
    """Return the final estimator from a pipeline-like object."""

    named_steps = getattr(model, "named_steps", None)
    if named_steps and "classifier" in named_steps:
        return named_steps["classifier"]
    return model

