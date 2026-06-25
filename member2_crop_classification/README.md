# Member 2: Crop Type Classification

This module implements the crop type classification component for Project
PRAGATI. It is designed for an ISRO Hackathon demonstration where Sentinel
imagery is converted into machine-learning features, trained with a robust
baseline classifier, evaluated with defensible metrics, and exported as
GeoTIFF outputs for downstream team members.

The module does not include dashboard code, Streamlit UI code, or moisture
stress logic.

## What This Module Does

- Loads Sentinel-2 optical GeoTIFF bands.
- Optionally loads aligned Sentinel-1 VV and VH bands.
- Computes NDVI, NDWI, EVI, SAVI, and optional VH/VV ratio.
- Builds a labeled pixel table from raster data and crop labels.
- Trains a Random Forest classifier with stratified train/test split.
- Runs GridSearchCV for Random Forest hyperparameter tuning.
- Generates evaluation metrics and publication-quality plots.
- Runs full-raster inference and exports classified crop maps.
- Writes `outputs/crop_predictions.tif` for Member 3 moisture-stress work.
- Provides optional XGBoost training and RF-vs-XGB comparison.

## Folder Structure

```text
member2_crop_classification/
├── config/
│   └── config.yaml
├── data/
├── logs/
│   └── training.log
├── models/
├── outputs/
├── scripts/
│   ├── evaluate.py
│   ├── feature_engineering.py
│   ├── inference.py
│   ├── load_data.py
│   ├── train_rf.py
│   ├── train_xgb.py
│   ├── utils.py
│   └── visualize.py
├── notebooks/
└── README.md
```

## Setup

From the repository root:

```bash
pip install -r requirements.txt
```

Optional XGBoost support:

```bash
pip install xgboost
```

## Dataset Structure

Place data under:

```text
member2_crop_classification/data/
├── sentinel2_stack.tif
├── crop_labels.tif
└── sentinel1_stack.tif        # optional
```

Expected inputs:

- `sentinel2_stack.tif`: GeoTIFF containing Sentinel-2 bands.
- `crop_labels.tif`: single-band crop label raster.
- `sentinel1_stack.tif`: optional aligned VV/VH raster.

Important assumptions:

- Label value `0` means unlabeled or no crop label.
- Label raster must align with imagery in CRS, transform, width, and height.
- Sentinel-1, if used, must also be aligned to the Sentinel-2 grid.
- TODO: Update `config/config.yaml` with the official crop class mapping.
- TODO: Confirm the exact Sentinel-2 band indexes for the provided dataset.

## Configuration

All operational paths, band mappings, model parameters, and outputs are stored
in:

```text
member2_crop_classification/config/config.yaml
```

Key sections:

- `paths`: input data, model, output, and log locations.
- `sentinel2.band_indexes`: 1-based rasterio indexes for optical bands.
- `sentinel1`: optional VV/VH settings.
- `features`: spectral indices and raw-band inclusion.
- `model.random_forest`: production Random Forest parameters.
- `model.grid_search`: GridSearchCV search space.
- `evaluation.class_names`: crop class ID to crop name mapping.

## Training

Run from the repository root:

```bash
python member2_crop_classification/scripts/train_rf.py --config member2_crop_classification/config/config.yaml
```

Training performs:

- Raster loading.
- Feature engineering.
- Labeled pixel table creation.
- Stratified train/test split.
- Random Forest fitting.
- GridSearchCV hyperparameter search.
- Best-model saving.
- Evaluation artifact generation.
- Training logs.

The trained model is saved to:

```text
member2_crop_classification/models/random_forest_best.joblib
```

## Evaluation

Evaluate the saved model:

```bash
python member2_crop_classification/scripts/evaluate.py --config member2_crop_classification/config/config.yaml
```

Generated files:

```text
outputs/confusion_matrix.png
outputs/classification_report.txt
outputs/evaluation_metrics.json
outputs/class_distribution.png
outputs/feature_importance.png
```

Metrics include:

- Overall Accuracy
- Cohen Kappa
- Precision
- Recall
- F1 Score
- Per-class precision, recall, F1, and support

## Inference

Run full-raster crop map generation:

```bash
python member2_crop_classification/scripts/inference.py --config member2_crop_classification/config/config.yaml
```

Generated files:

```text
outputs/crop_map.tif
outputs/crop_predictions.tif
outputs/crop_map.png
outputs/crop_statistics.json
```

`crop_predictions.tif` is the integration handoff file for Member 3.

`crop_statistics.json` contains:

- Crop counts
- Crop percentages
- Crop class names
- CRS and raster metadata
- Generation timestamp

## Optional XGBoost Stretch Goal

After installing XGBoost:

```bash
python member2_crop_classification/scripts/train_xgb.py --config member2_crop_classification/config/config.yaml
```

This trains an optional XGBoost classifier and writes:

```text
models/xgboost_best.joblib
outputs/model_comparison.csv
```

The comparison table includes Random Forest and XGBoost accuracy, kappa,
weighted precision, weighted recall, weighted F1, and training time.

## Outputs

| Output | Purpose |
| --- | --- |
| `models/random_forest_best.joblib` | Best trained Random Forest model bundle |
| `outputs/confusion_matrix.png` | Model confusion matrix |
| `outputs/classification_report.txt` | Text evaluation report |
| `outputs/evaluation_metrics.json` | Machine-readable metrics |
| `outputs/class_distribution.png` | Labeled training pixel distribution |
| `outputs/feature_importance.png` | Tree-based feature importance |
| `outputs/crop_map.tif` | Classified crop map GeoTIFF |
| `outputs/crop_predictions.tif` | Member 3 integration raster |
| `outputs/crop_map.png` | Visual crop map preview |
| `outputs/crop_statistics.json` | Crop counts, percentages, and metadata |
| `logs/training.log` | Reproducible training log |

## Engineering Notes

- All spectral indices use vectorized NumPy operations.
- Division by zero is handled through safe array division.
- NaN and invalid pixels are excluded from training and left as no-prediction
  pixels during inference.
- Sentinel-1 support is optional. If unavailable, the pipeline logs a warning
  and continues with Sentinel-2 features.
- Random seeds are controlled through YAML configuration.
- Paths are read from config and resolved relative to this module.

