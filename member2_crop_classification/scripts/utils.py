"""Shared utilities for Member 2 crop type classification."""

from __future__ import annotations

import json
import logging
import random
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable, Mapping

import joblib
import numpy as np
import yaml
from sklearn.model_selection import train_test_split


MODULE_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CONFIG_PATH = MODULE_ROOT / "config" / "config.yaml"


def resolve_config_path(config_path: str | Path | None = None) -> Path:
    """Return an absolute config path."""

    if config_path is None:
        return DEFAULT_CONFIG_PATH

    path = Path(config_path)
    if path.is_absolute():
        return path

    if path.exists():
        return path.resolve()

    return (MODULE_ROOT / path).resolve()


def load_config(config_path: str | Path | None = None) -> dict[str, Any]:
    """Load YAML configuration for the Member 2 pipeline."""

    resolved_path = resolve_config_path(config_path)
    if not resolved_path.exists():
        raise FileNotFoundError(f"Config file not found: {resolved_path}")

    with resolved_path.open("r", encoding="utf-8") as file:
        config = yaml.safe_load(file) or {}

    config["_config_path"] = str(resolved_path)
    return config


def resolve_path(path_value: str | Path | None) -> Path | None:
    """Resolve a config path relative to ``member2_crop_classification``."""

    if path_value in (None, ""):
        return None

    path = Path(path_value)
    if path.is_absolute():
        return path

    return (MODULE_ROOT / path).resolve()


def get_path(config: Mapping[str, Any], key: str) -> Path | None:
    """Return a resolved path from the top-level ``paths`` config section."""

    return resolve_path(config.get("paths", {}).get(key))


def ensure_directory(path: Path | None) -> None:
    """Create a directory if the path is not ``None``."""

    if path is not None:
        path.mkdir(parents=True, exist_ok=True)


def ensure_parent(path: Path | None) -> None:
    """Create a file parent directory if the path is not ``None``."""

    if path is not None:
        path.parent.mkdir(parents=True, exist_ok=True)


def ensure_project_directories(config: Mapping[str, Any]) -> None:
    """Create configured output, model, and log directories."""

    for key in ("outputs_dir", "logs_dir"):
        ensure_directory(get_path(config, key))

    for key in (
        "model",
        "xgboost_model",
        "confusion_matrix",
        "classification_report",
        "feature_importance",
        "class_distribution",
        "crop_map_tif",
        "crop_predictions_tif",
        "crop_map_png",
        "crop_statistics",
        "metrics_json",
        "model_comparison",
        "training_table",
    ):
        ensure_parent(get_path(config, key))


def setup_logging(
    config: Mapping[str, Any],
    *,
    logger_name: str = "member2_crop_classification",
) -> logging.Logger:
    """Configure console and file logging for the pipeline."""

    logging_config = config.get("logging", {})
    log_level_name = str(logging_config.get("level", "INFO")).upper()
    log_level = getattr(logging, log_level_name, logging.INFO)

    logs_dir = get_path(config, "logs_dir") or (MODULE_ROOT / "logs")
    logs_dir.mkdir(parents=True, exist_ok=True)
    log_file = logs_dir / str(logging_config.get("file", "training.log"))

    logger = logging.getLogger(logger_name)
    logger.setLevel(log_level)
    logger.propagate = False
    logger.handlers.clear()

    formatter = logging.Formatter(
        "%(asctime)s | %(levelname)s | %(name)s | %(message)s"
    )

    stream_handler = logging.StreamHandler()
    stream_handler.setLevel(log_level)
    stream_handler.setFormatter(formatter)

    file_handler = logging.FileHandler(log_file, mode="a", encoding="utf-8")
    file_handler.setLevel(log_level)
    file_handler.setFormatter(formatter)

    logger.addHandler(stream_handler)
    logger.addHandler(file_handler)
    logger.debug("Logging initialized at %s", log_file)
    return logger


def set_random_seed(seed: int) -> None:
    """Set reproducible seeds for Python and NumPy."""

    random.seed(seed)
    np.random.seed(seed)


def get_random_seed(config: Mapping[str, Any]) -> int:
    """Return the configured project seed."""

    return int(config.get("project", {}).get("random_seed", 42))


def normalize_class_mapping(config: Mapping[str, Any]) -> dict[int, str]:
    """Return class ID to crop name mapping with integer keys."""

    raw_mapping = config.get("evaluation", {}).get("class_names", {})
    mapping: dict[int, str] = {}

    for key, value in raw_mapping.items():
        try:
            mapping[int(key)] = str(value)
        except (TypeError, ValueError) as exc:
            raise ValueError(f"Invalid class mapping key: {key}") from exc

    return mapping


def format_class_labels(
    labels: Iterable[int],
    class_names: Mapping[int, str] | None = None,
) -> list[str]:
    """Format class labels for reports and plots."""

    names = class_names or {}
    return [names.get(int(label), str(int(label))) for label in labels]


def can_stratify(target: np.ndarray, test_size: float) -> bool:
    """Return whether a stratified split is valid for the class counts."""

    labels, counts = np.unique(target, return_counts=True)
    test_count = int(np.ceil(len(target) * test_size))
    train_count = len(target) - test_count

    return (
        len(labels) > 1
        and np.all(counts >= 2)
        and test_count >= len(labels)
        and train_count >= len(labels)
    )


def stratified_train_test_split(
    features: np.ndarray,
    target: np.ndarray,
    *,
    test_size: float,
    random_state: int,
) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    """Run a strict stratified train/test split."""

    if not can_stratify(target, test_size):
        labels, counts = np.unique(target, return_counts=True)
        class_counts = dict(zip(labels.tolist(), counts.tolist(), strict=True))
        raise ValueError(
            "Stratified split is not possible with the current class counts. "
            f"Class counts: {class_counts}; test_size={test_size}."
        )

    return train_test_split(
        features,
        target,
        test_size=test_size,
        random_state=random_state,
        stratify=target,
    )


def save_json(payload: Mapping[str, Any], output_path: str | Path) -> Path:
    """Save a JSON file with stable formatting."""

    path = Path(output_path)
    ensure_parent(path)
    with path.open("w", encoding="utf-8") as file:
        json.dump(payload, file, indent=2, sort_keys=True)
    return path


def save_model_bundle(bundle: Mapping[str, Any], output_path: str | Path) -> Path:
    """Persist a model bundle with joblib."""

    path = Path(output_path)
    ensure_parent(path)
    joblib.dump(dict(bundle), path)
    return path


def load_model_bundle(model_path: str | Path) -> dict[str, Any]:
    """Load a model bundle saved by the training scripts."""

    path = Path(model_path)
    if not path.exists():
        raise FileNotFoundError(f"Model file not found: {path}")

    bundle = joblib.load(path)
    if isinstance(bundle, dict) and "model" in bundle:
        return bundle

    return {"model": bundle}


def timestamp_utc() -> str:
    """Return the current UTC timestamp in ISO-8601 format."""

    return datetime.now(timezone.utc).isoformat()

