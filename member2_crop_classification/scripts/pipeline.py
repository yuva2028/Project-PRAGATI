"""
Master pipeline runner for Member 2 Crop Classification.
Trains Random Forest and XGBoost on Sentinel-1/2 features,
saves models, metrics, confusion matrix PNGs, and GeoJSON.

Usage:
    python -m member2_crop_classification.scripts.pipeline
    python -m member2_crop_classification.scripts.pipeline --mode synthetic
"""

from __future__ import annotations

import argparse
import json
import shutil
import sys
from pathlib import Path

# ── Repository root on sys.path ───────────────────────────────────────────────
REPO_ROOT = Path(__file__).resolve().parents[3]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))
if str(REPO_ROOT / "project") not in sys.path:
    sys.path.insert(0, str(REPO_ROOT / "project"))

# ── Output directories ────────────────────────────────────────────────────────
MEMBER2_ROOT = Path(__file__).resolve().parents[1]
MODELS_DIR   = MEMBER2_ROOT / "models"
OUTPUTS_DIR  = MEMBER2_ROOT / "outputs"
DATA_DIR     = REPO_ROOT / "project" / "data"
CSV_PATH     = DATA_DIR / "ground_truth.csv"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Member 2 Crop Classification Master Pipeline"
    )
    parser.add_argument(
        "--mode",
        choices=["synthetic", "gee"],
        default="synthetic",
        help="Feature source: 'synthetic' (default) or 'gee' (requires GEE auth)",
    )
    return parser.parse_args()


def ensure_dirs() -> None:
    for d in (MODELS_DIR, OUTPUTS_DIR):
        d.mkdir(parents=True, exist_ok=True)


def step_generate_features(mode: str):
    """Generate training features and return DataFrame."""
    print(f"  Generating features — mode={mode}")
    if mode == "gee":
        try:
            from ml.crop_classifier import get_training_samples_from_gee
            df = get_training_samples_from_gee()
            print(f"  ✅ GEE features: {df.shape[0]} samples")
            return df
        except Exception as e:
            print(f"  [WARN] GEE failed ({e}), falling back to synthetic")

    # Synthetic fallback
    from ml.realistic_trainer import generate_realistic_features
    df = generate_realistic_features(str(CSV_PATH), samples_per_point=12)
    print(f"  ✅ Synthetic features: {df.shape[0]} samples")
    return df


def step_train_models(df):
    """Train both RF and XGBoost with full CV. Returns (clf_rf, clf_xgb, metrics)."""
    print("  Training Random Forest & XGBoost (5-fold CV)...")
    from ml.realistic_trainer import train_and_evaluate
    clf_rf, clf_xgb, metrics = train_and_evaluate(df, run_cv=True)
    print(f"  ✅ RF accuracy: {metrics['rf']['accuracy']:.2f}% ± {metrics['rf']['accuracy_std']:.2f}%")
    print(f"  ✅ XGBoost accuracy: {metrics['xgb']['accuracy']:.2f}% ± {metrics['xgb']['accuracy_std']:.2f}%")
    return clf_rf, clf_xgb, metrics


def step_save_models(clf_rf, clf_xgb, metrics) -> tuple[Path, Path, Path]:
    """Save models and metrics JSON."""
    import joblib

    rf_path  = MODELS_DIR / "rf_model.joblib"
    xgb_path = MODELS_DIR / "xgb_model.joblib"
    met_path = OUTPUTS_DIR / "metrics.json"

    joblib.dump(clf_rf, rf_path)
    joblib.dump(clf_xgb, xgb_path)
    with open(met_path, "w", encoding="utf-8") as f:
        json.dump(metrics, f, indent=2, default=str)

    print(f"  ✅ RF model saved   → {rf_path} ({rf_path.stat().st_size / 1024:.1f} KB)")
    print(f"  ✅ XGB model saved  → {xgb_path} ({xgb_path.stat().st_size / 1024:.1f} KB)")
    print(f"  ✅ Metrics saved    → {met_path}")
    return rf_path, xgb_path, met_path


def step_confusion_matrix(clf_rf, clf_xgb, df) -> None:
    """Save confusion matrix PNGs for both models."""
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
        from sklearn.metrics import ConfusionMatrixDisplay, confusion_matrix
        from sklearn.model_selection import train_test_split
        from ml.realistic_trainer import FEATURE_COLS, CROP_CLASSES

        X = df[FEATURE_COLS].fillna(0)
        y = df["crop_class"]
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42, stratify=y
        )
        labels = [CROP_CLASSES[i] for i in sorted(CROP_CLASSES)]

        for name, clf, suffix in [("Random Forest", clf_rf, "rf"), ("XGBoost", clf_xgb, "xgb")]:
            y_pred = clf.predict(X_test)
            if suffix == "xgb":
                y_pred = y_pred + 1  # 0-indexed → 1-indexed
            cm = confusion_matrix(y_test, y_pred, labels=sorted(CROP_CLASSES))
            disp = ConfusionMatrixDisplay(confusion_matrix=cm, display_labels=labels)
            fig, ax = plt.subplots(figsize=(6, 5))
            disp.plot(ax=ax, colorbar=False, cmap="Greens")
            ax.set_title(f"{name} — Confusion Matrix")
            png_path = OUTPUTS_DIR / f"confusion_matrix_{suffix}.png"
            plt.savefig(png_path, dpi=120, bbox_inches="tight")
            plt.close(fig)
            print(f"  ✅ Confusion matrix → {png_path}")
    except ImportError as e:
        print(f"  [WARN] matplotlib not available — skipping confusion matrix PNGs: {e}")


def step_geojson(clf_rf, df) -> None:
    """Generate crop_map.geojson and copy to project/data/."""
    try:
        import numpy as np
        import pandas as pd
        from ml.realistic_trainer import FEATURE_COLS, SPECTRAL_PROFILES, CROP_CLASSES, CROP_COLORS

        csv_df   = pd.read_csv(CSV_PATH)
        rng      = np.random.default_rng(42)
        features = []
        for _, row in csv_df.iterrows():
            cls     = int(row["crop_class"])
            profile = SPECTRAL_PROFILES.get(cls, SPECTRAL_PROFILES[4])
            features.append([float(rng.normal(*profile[f])) for f in FEATURE_COLS])

        X_pred  = pd.DataFrame(features, columns=FEATURE_COLS).fillna(0)
        preds   = clf_rf.predict(X_pred)
        probas  = clf_rf.predict_proba(X_pred)

        geojson_features = []
        for i, (_, row) in enumerate(csv_df.iterrows()):
            pred_class = int(preds[i])
            crop_name  = CROP_CLASSES.get(pred_class, "Others")
            geojson_features.append({
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [float(row["longitude"]), float(row["latitude"])],
                },
                "properties": {
                    "field_id":   f"KAR-{i + 1:03d}",
                    "crop_class": pred_class,
                    "crop_name":  crop_name,
                    "confidence": round(float(probas[i].max()) * 100, 1),
                    "color":      CROP_COLORS.get(crop_name, "#f97316"),
                },
            })

        geojson = {
            "type":     "FeatureCollection",
            "features": geojson_features,
            "metadata": {
                "total_points": len(geojson_features),
                "pilot_area":   "Karnataka, India",
                "source":       "Random Forest | Sentinel-1/2 Spectral Signatures",
            },
        }

        local_path  = OUTPUTS_DIR / "crop_map.geojson"
        data_path   = DATA_DIR / "crop_map.geojson"
        geojson_str = json.dumps(geojson, indent=2)
        local_path.write_text(geojson_str, encoding="utf-8")
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        data_path.write_text(geojson_str, encoding="utf-8")
        print(f"  ✅ GeoJSON saved    → {local_path}")
        print(f"  ✅ GeoJSON copied   → {data_path}")

    except Exception as e:
        print(f"  [WARN] GeoJSON step failed: {e}")


def main() -> None:
    args = parse_args()
    print("\n🛰️  Project PRAGATI — Crop Classification Pipeline")
    print("=" * 55)
    ensure_dirs()

    print("\n[1/5] Feature Generation")
    df = step_generate_features(args.mode)

    print("\n[2/5] Model Training")
    clf_rf, clf_xgb, metrics = step_train_models(df)

    print("\n[3/5] Saving Models & Metrics")
    step_save_models(clf_rf, clf_xgb, metrics)

    print("\n[4/5] Confusion Matrix PNGs")
    step_confusion_matrix(clf_rf, clf_xgb, df)

    print("\n[5/5] GeoJSON Generation")
    step_geojson(clf_rf, df)

    print("\n" + "=" * 55)
    print("✅ Pipeline complete!")
    print(f"   RF Accuracy  : {metrics['rf']['accuracy']:.2f}%")
    print(f"   XGB Accuracy : {metrics['xgb']['accuracy']:.2f}%")
    print(f"   RF Kappa     : {metrics['rf']['kappa_coefficient']:.4f}")
    print(f"   Outputs      : {OUTPUTS_DIR}")


if __name__ == "__main__":
    main()
