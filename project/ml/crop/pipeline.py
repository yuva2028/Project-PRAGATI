"""
Crop Classification Pipeline.

Unified entry point for Member 2 work, now integrated into project/ml/crop.
Usage: python -m project.ml.crop.pipeline [--mode synthetic|gee] [--samples 12]
"""

from __future__ import annotations

import argparse
import json
import time
from pathlib import Path

import joblib
import numpy as np
import pandas as pd


ROOT = Path(__file__).resolve().parents[3]
DATA_DIR = ROOT / "project" / "data"
MODELS_DIR = ROOT / "project" / "backend" / "models"
OUTPUTS_DIR = ROOT / "project" / "ml" / "crop" / "outputs"


def main() -> None:
    """Run the full PRAGATI crop classification workflow."""

    parser = argparse.ArgumentParser(description="PRAGATI Crop Classification Pipeline")
    parser.add_argument("--mode", default="synthetic", choices=["synthetic", "gee"])
    parser.add_argument("--samples", type=int, default=12)
    args = parser.parse_args()

    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUTS_DIR.mkdir(parents=True, exist_ok=True)

    start_time = time.time()
    print(f"\n{'=' * 60}")
    print("  PRAGATI Crop Classification Pipeline")
    print(f"  Mode: {args.mode.upper()} | Samples per point: {args.samples}")
    print(f"{'=' * 60}\n")

    try:
        from project.ml.realistic_trainer import (
            CROP_CLASSES,
            CROP_COLORS,
            FEATURE_COLS,
            SPECTRAL_PROFILES,
            generate_realistic_features,
            train_and_evaluate,
        )
    except ImportError as e:
        print(f"[WARN] Falling back to local realistic_trainer import: {e}")
        from ml.realistic_trainer import (
            CROP_CLASSES,
            CROP_COLORS,
            FEATURE_COLS,
            SPECTRAL_PROFILES,
            generate_realistic_features,
            train_and_evaluate,
        )

    csv_path = DATA_DIR / "ground_truth.csv"

    if args.mode == "gee":
        try:
            from project.ml.crop_classifier import get_training_samples_from_gee

            dataframe = get_training_samples_from_gee()
            print("[OK] GEE data fetched")
        except Exception as e:
            print(f"[WARN] GEE failed, using synthetic fallback: {e}")
            dataframe = generate_realistic_features(
                str(csv_path),
                samples_per_point=args.samples,
            )
    else:
        dataframe = generate_realistic_features(
            str(csv_path),
            samples_per_point=args.samples,
        )
        print(
            f"[OK] Synthetic data: {dataframe.shape[0]} samples x "
            f"{len(FEATURE_COLS)} features"
        )
        print(f"     Class balance: {dataframe['crop_class'].value_counts().to_dict()}")

    print("\n[...] Training Random Forest + XGBoost (run_cv=True)...")
    clf_rf, clf_xgb, metrics = train_and_evaluate(dataframe, run_cv=True)
    print(
        f"[OK] RF  CV Accuracy : {metrics['rf']['accuracy']:.2f}% +/- "
        f"{metrics['rf']['accuracy_std']:.2f}%"
    )
    print(
        f"[OK] XGB CV Accuracy : {metrics['xgb']['accuracy']:.2f}% +/- "
        f"{metrics['xgb']['accuracy_std']:.2f}%"
    )

    best_model = clf_rf if metrics["rf"]["f1_score"] >= metrics["xgb"]["f1_score"] else clf_xgb
    best_name = "RandomForest" if best_model is clf_rf else "XGBoost"
    print(f"\n[OK] Best model: {best_name}")

    rf_path = MODELS_DIR / "crop_rf_model.joblib"
    xgb_path = MODELS_DIR / "crop_xgb_model.joblib"
    joblib.dump(clf_rf, rf_path)
    joblib.dump(clf_xgb, xgb_path)
    print(f"[OK] Models saved -> {MODELS_DIR}")

    metrics_path = MODELS_DIR / "crop_metrics.json"
    with metrics_path.open("w", encoding="utf-8") as file:
        json.dump(metrics, file, indent=2)
    print(f"[OK] Metrics saved -> {metrics_path}")

    try:
        import matplotlib.pyplot as plt
        from sklearn.metrics import ConfusionMatrixDisplay

        for model_name, _clf, model_metrics in (
            ("rf", clf_rf, metrics["rf"]),
            ("xgb", clf_xgb, metrics["xgb"]),
        ):
            fig, ax = plt.subplots(figsize=(6, 5))
            ConfusionMatrixDisplay(
                confusion_matrix=np.array(model_metrics["confusion_matrix"]),
                display_labels=[CROP_CLASSES[i] for i in sorted(CROP_CLASSES)],
            ).plot(ax=ax, colorbar=False, cmap="Blues")
            readable_name = "Random Forest" if model_name == "rf" else "XGBoost"
            ax.set_title(
                f"{readable_name} Confusion Matrix\n"
                f"Karnataka Pilot | Accuracy: {model_metrics['test_accuracy']}%"
            )
            fig.savefig(
                OUTPUTS_DIR / f"{model_name}_confusion_matrix.png",
                dpi=150,
                bbox_inches="tight",
            )
            plt.close(fig)
        print(f"[OK] Confusion matrix PNGs saved -> {OUTPUTS_DIR}")
    except Exception as e:
        print(f"[WARN] Confusion matrix plot skipped: {e}")

    geojson_count = 0
    try:
        df_gt = pd.read_csv(csv_path)
        rng = np.random.default_rng(42)
        rows = []
        for _, row in df_gt.iterrows():
            crop_class = int(row["crop_class"])
            profile = SPECTRAL_PROFILES[crop_class]
            rows.append([
                float(rng.normal(profile[feature][0], profile[feature][1]))
                for feature in FEATURE_COLS
            ])

        x_pred = pd.DataFrame(rows, columns=FEATURE_COLS).fillna(0)
        predictions = clf_rf.predict(x_pred)
        probabilities = clf_rf.predict_proba(x_pred)
        features = []

        for index, (_, ground_truth) in enumerate(df_gt.iterrows()):
            predicted_class = int(predictions[index])
            crop_name = CROP_CLASSES.get(predicted_class, "Others")
            confidence = round(float(probabilities[index].max()) * 100, 1)
            features.append(
                {
                    "type": "Feature",
                    "geometry": {
                        "type": "Point",
                        "coordinates": [
                            float(ground_truth["longitude"]),
                            float(ground_truth["latitude"]),
                        ],
                    },
                    "properties": {
                        "field_id": f"KAR-{index + 1:03d}",
                        "crop_class": predicted_class,
                        "crop_name": crop_name,
                        "confidence": confidence,
                        "color": CROP_COLORS.get(crop_name, "#f97316"),
                    },
                }
            )

        geojson = {
            "type": "FeatureCollection",
            "features": features,
            "metadata": {
                "total_points": len(features),
                "pilot_area": "Karnataka, India",
            },
        }
        for output_path in (OUTPUTS_DIR / "crop_map.geojson", DATA_DIR / "crop_map.geojson"):
            with output_path.open("w", encoding="utf-8") as file:
                json.dump(geojson, file)
        geojson_count = len(features)
        print(f"[OK] Crop GeoJSON -> {geojson_count} points -> {DATA_DIR / 'crop_map.geojson'}")
    except Exception as e:
        print(f"[WARN] GeoJSON export failed: {e}")

    elapsed = round(time.time() - start_time, 1)
    print(f"\n{'=' * 60}")
    print(f"  Random Forest  -> Accuracy: {metrics['rf']['accuracy']}%  F1: {metrics['rf']['f1_score']}%")
    print(f"  XGBoost        -> Accuracy: {metrics['xgb']['accuracy']}%  F1: {metrics['xgb']['f1_score']}%")
    print(f"  Best Model     : {best_name}")
    print(f"  Models saved   -> {MODELS_DIR}")
    print(f"  GeoJSON exported: {geojson_count} points")
    print(f"  Total time      : {elapsed}s")
    print(f"{'=' * 60}\n")


if __name__ == "__main__":
    main()
