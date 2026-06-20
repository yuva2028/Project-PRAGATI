# Member 2: Crop Type Classification

This module contains the first prototype layer for crop type classification in the Project PRAGATI ISRO Hackathon workflow. It focuses only on preparing satellite raster data, extracting basic spectral features, and training a baseline Random Forest classifier.

This is intentionally limited to the first 30 percent of the work. It does not include dashboard code, moisture stress analysis, Streamlit, or XGBoost.

## Purpose

The purpose of the Member 2 module is to classify crop types from Sentinel-2 imagery using supervised machine learning.

At this stage, the module supports:

- Loading Sentinel-2 GeoTIFF bands.
- Loading crop label rasters.
- Converting raster pixels into a tabular machine learning dataset.
- Computing basic spectral indices such as NDVI and NDWI.
- Training a baseline Random Forest crop classifier.
- Generating an accuracy score and confusion matrix.

The module is designed as a clean starting point for the hackathon prototype. Future work can add better temporal features, crop calendars, class mappings, geospatial validation, tuned models, and full prediction map export.

## Input Data Required

The expected inputs are:

1. Sentinel-2 GeoTIFF imagery
   - A multi-band GeoTIFF, or a raster stack containing the Sentinel-2 bands required for classification.
   - At minimum, NDVI requires red and near-infrared bands.
   - NDWI requires green and near-infrared bands.

2. Crop label raster
   - A single-band raster where each pixel value is a crop class ID.
   - Label value `0` is treated as unlabeled and is ignored during training.
   - The label raster should have the same height, width, CRS, and transform as the Sentinel-2 image stack.

3. Crop class mapping
   - A mapping from class IDs to crop names is still required.
   - Example: `1 = Rice`, `2 = Wheat`, `3 = Cotton`.
   - TODO: Replace example class IDs with the official hackathon or dataset-specific crop class mapping.

## Expected Outputs

The current prototype produces:

- A trained Random Forest model object in memory.
- Train/test accuracy printed to the console.
- A confusion matrix image saved to:

```text
member2_crop_classification/outputs/confusion_matrix.png
```

Future outputs may include:

- Saved model files in `models/`.
- Classified crop maps as GeoTIFF files.
- Per-class precision, recall, and F1-score reports.
- District or field-level crop area summaries.

## Workflow Overview

The intended workflow is:

1. Place Sentinel-2 imagery and label rasters in `data/`.
2. Use `scripts/load_data.py` to read raster bands and labels.
3. Convert image pixels and labels into a tabular dataset.
4. Use `scripts/feature_engineering.py` to calculate NDVI, NDWI, and other feature arrays.
5. Use `scripts/train_rf.py` to train and evaluate a Random Forest classifier.
6. Review the confusion matrix in `outputs/`.

Recommended project flow:

```text
Sentinel-2 GeoTIFF + Label Raster
        |
        v
Raster Loading and Validation
        |
        v
Pixel Table Creation
        |
        v
Spectral Feature Engineering
        |
        v
Random Forest Training
        |
        v
Accuracy + Confusion Matrix
```

## Folder Structure

```text
member2_crop_classification/
├── data/
├── notebooks/
├── scripts/
│   ├── feature_engineering.py
│   ├── load_data.py
│   └── train_rf.py
├── models/
├── outputs/
└── README.md
```

## Dependencies

The module requires:

- `numpy`
- `pandas`
- `rasterio`
- `scikit-learn`
- `matplotlib`

Install the project requirements from the repository root:

```bash
pip install -r requirements.txt
```

## Current Limitations and TODOs

- TODO: Add actual Sentinel-2 file paths from the hackathon dataset.
- TODO: Add the official crop class ID to crop name mapping.
- TODO: Confirm Sentinel-2 band order for the provided raster stack.
- TODO: Add temporal features if multi-date imagery is available.
- TODO: Add model persistence after the baseline is validated.
- TODO: Add prediction map export after training and validation are stable.

