"""
Crop Type Classification Model
Uses Random Forest on Sentinel-1/2 + Weather features
Target Classes: Rice, Maize, Sugarcane, Others
"""

import ee
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from xgboost import XGBClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import (accuracy_score, precision_score, recall_score,
                             f1_score, confusion_matrix, classification_report,
                             cohen_kappa_score)
import joblib
import json
import os

# Crop class mapping
CROP_CLASSES = {
    1: "Rice",
    2: "Maize",
    3: "Sugarcane",
    4: "Others"
}

CROP_COLORS = {
    "Rice":      "#22c55e",   # Green
    "Maize":     "#eab308",   # Yellow
    "Sugarcane": "#3b82f6",   # Blue
    "Others":    "#f97316",   # Orange
}

RF_MODEL_PATH = os.path.join(os.path.dirname(__file__), '..', 'backend', 'models', 'crop_rf_model.joblib')
XGB_MODEL_PATH = os.path.join(os.path.dirname(__file__), '..', 'backend', 'models', 'crop_xgb_model.joblib')


def get_training_samples_from_gee():
    """
    Sample real pixel values from GEE over exact Ground Truth coordinates.
    Uses Multi-Temporal stacks (T1 and T2) of Sentinel-2 and Sentinel-1.
    """
    from gee.sentinel2 import get_multi_temporal_stack_s2
    from gee.sentinel1 import get_multi_temporal_stack_s1

    s2_stack = get_multi_temporal_stack_s2()
    s1_stack = get_multi_temporal_stack_s1()
    combined = s2_stack.addBands(s1_stack)
    
    csv_path = os.path.join(os.path.dirname(__file__), '..', 'data', 'ground_truth.csv')
    if not os.path.exists(csv_path):
        raise FileNotFoundError(f"Missing ground truth file at {csv_path}")
        
    df_gt = pd.read_csv(csv_path)
    
    # Create GEE feature collection from CSV
    features = []
    for idx, row in df_gt.iterrows():
        geom = ee.Geometry.Point([row['longitude'], row['latitude']])
        feat = ee.Feature(geom, {'crop_class': row['crop_class']})
        features.append(feat)
        
    fc = ee.FeatureCollection(features)
    
    # Extract multi-temporal pixel values at these points
    sample_fc = combined.sampleRegions(
        collection=fc,
        properties=['crop_class'],
        scale=10,
        tileScale=4
    )

    features = sample_fc.getInfo()['features']
    records = []
    for f in features:
        props = f['properties']
        records.append({
            'NDVI_t1': props.get('NDVI_t1', 0),
            'NDWI_t1': props.get('NDWI_t1', 0),
            'EVI_t1':  props.get('EVI_t1', 0),
            'B4_t1':   props.get('B4_t1', 0),
            'B8_t1':   props.get('B8_t1', 0),
            'B11_t1':  props.get('B11_t1', 0),
            'VV_t1':   props.get('VV_t1', -15),
            'VH_t1':   props.get('VH_t1', -20),
            'VH_VV_ratio_t1': props.get('VH_VV_ratio_t1', 1.3),
            'VV_contrast_t1': props.get('VV_contrast_t1', 0),
            'VV_entropy_t1':  props.get('VV_entropy_t1', 0),
            
            'NDVI_t2': props.get('NDVI_t2', 0),
            'NDWI_t2': props.get('NDWI_t2', 0),
            'EVI_t2':  props.get('EVI_t2', 0),
            'B4_t2':   props.get('B4_t2', 0),
            'B8_t2':   props.get('B8_t2', 0),
            'B11_t2':  props.get('B11_t2', 0),
            'VV_t2':   props.get('VV_t2', -15),
            'VH_t2':   props.get('VH_t2', -20),
            'VH_VV_ratio_t2': props.get('VH_VV_ratio_t2', 1.3),
            'VV_contrast_t2': props.get('VV_contrast_t2', 0),
            'VV_entropy_t2':  props.get('VV_entropy_t2', 0),
            
            'crop_class': props.get('crop_class')
        })

    return pd.DataFrame(records)

# Removed assign_labels_from_ndvi as we now use real ground truth


def train_model(df: pd.DataFrame):
    feature_cols = [
        'NDVI_t1', 'NDWI_t1', 'EVI_t1', 'B4_t1', 'B8_t1', 'B11_t1', 'VV_t1', 'VH_t1', 'VH_VV_ratio_t1', 'VV_contrast_t1', 'VV_entropy_t1',
        'NDVI_t2', 'NDWI_t2', 'EVI_t2', 'B4_t2', 'B8_t2', 'B11_t2', 'VV_t2', 'VH_t2', 'VH_VV_ratio_t2', 'VV_contrast_t2', 'VV_entropy_t2'
    ]
    X = df[feature_cols].fillna(0)
    y = df['crop_class']

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42,
        stratify=y if y.value_counts().min() >= 2 else None
    )

    clf = RandomForestClassifier(
        n_estimators=200,
        max_depth=15,
        random_state=42,
        n_jobs=-1
    )
    clf.fit(X_train, y_train)

    # Train XGBoost
    y_train_xgb = y_train - 1
    y_test_xgb = y_test - 1
    xgb_clf = XGBClassifier(
        n_estimators=200,
        max_depth=10,
        learning_rate=0.1,
        subsample=0.8,
        random_state=42,
        n_jobs=-1,
        eval_metric='mlogloss'
    )
    xgb_clf.fit(X_train, y_train_xgb)

    # Metrics for RF
    y_pred = clf.predict(X_test)
    importances = clf.feature_importances_
    feature_importance_dict = {feat: round(float(imp)*100, 2) for feat, imp in zip(feature_cols, importances)}
    feature_importance_dict = dict(sorted(feature_importance_dict.items(), key=lambda item: item[1], reverse=True))

    metrics_rf = {
        'accuracy':  round(accuracy_score(y_test, y_pred) * 100, 2),
        'kappa_coefficient': round(cohen_kappa_score(y_test, y_pred), 4),
        'precision': round(precision_score(y_test, y_pred, average='weighted', zero_division=0) * 100, 2),
        'recall':    round(recall_score(y_test, y_pred, average='weighted', zero_division=0) * 100, 2),
        'f1_score':  round(f1_score(y_test, y_pred, average='weighted', zero_division=0) * 100, 2),
        'confusion_matrix': confusion_matrix(y_test, y_pred).tolist(),
        'classification_report': classification_report(y_test, y_pred, target_names=[CROP_CLASSES[i] for i in sorted(CROP_CLASSES)]),
        'feature_importances': feature_importance_dict
    }

    # Metrics for XGBoost
    y_pred_xgb_raw = xgb_clf.predict(X_test)
    y_pred_xgb = y_pred_xgb_raw + 1
    xgb_importances = xgb_clf.feature_importances_
    xgb_fi_dict = {feat: round(float(imp)*100, 2) for feat, imp in zip(feature_cols, xgb_importances)}
    xgb_fi_dict = dict(sorted(xgb_fi_dict.items(), key=lambda item: item[1], reverse=True))
    
    metrics_xgb = {
        'accuracy':  round(accuracy_score(y_test, y_pred_xgb) * 100, 2),
        'kappa_coefficient': round(cohen_kappa_score(y_test, y_pred_xgb), 4),
        'precision': round(precision_score(y_test, y_pred_xgb, average='weighted', zero_division=0) * 100, 2),
        'recall':    round(recall_score(y_test, y_pred_xgb, average='weighted', zero_division=0) * 100, 2),
        'f1_score':  round(f1_score(y_test, y_pred_xgb, average='weighted', zero_division=0) * 100, 2),
        'confusion_matrix': confusion_matrix(y_test, y_pred_xgb).tolist(),
        'classification_report': classification_report(y_test, y_pred_xgb, target_names=[CROP_CLASSES[i] for i in sorted(CROP_CLASSES)]),
        'feature_importances': xgb_fi_dict
    }

    metrics = {
        "rf": metrics_rf,
        "xgb": metrics_xgb
    }

    # Save models
    os.makedirs(os.path.dirname(RF_MODEL_PATH), exist_ok=True)
    joblib.dump(clf, RF_MODEL_PATH)
    joblib.dump(xgb_clf, XGB_MODEL_PATH)
    print("Models saved to", os.path.dirname(RF_MODEL_PATH))
    print("RF Accuracy:", metrics_rf['accuracy'], "%")
    print("XGB Accuracy:", metrics_xgb['accuracy'], "%")

    return clf, xgb_clf, metrics


def load_model(model_name: str = "rf"):
    path = XGB_MODEL_PATH if model_name == "xgb" else RF_MODEL_PATH
    if os.path.exists(path):
        return joblib.load(path)
    return None


def classify_pixel(features: list, model_name: str = "rf"):
    """Single pixel prediction for the API expecting a 22-element multi-temporal feature list."""
    clf = load_model(model_name)
    if clf is None:
        raise RuntimeError(f"{model_name.upper()} model not trained yet. Run train pipeline first.")
    X = np.array([features])
    pred = clf.predict(X)[0]
    if model_name == "xgb":
        pred = int(pred) + 1  # map from [0, 1, 2, 3] to [1, 2, 3, 4]
    proba = clf.predict_proba(X)[0]
    return {
        'class_id': int(pred),
        'crop_name': CROP_CLASSES.get(int(pred), 'Unknown'),
        'confidence': round(float(max(proba)) * 100, 1),
        'color': CROP_COLORS.get(CROP_CLASSES.get(int(pred), 'Others'), '#6b7280')
    }


def get_crop_area_stats(predictions: list) -> dict:
    """Compute area in hectares per crop class (assuming 10m resolution pixels)."""
    pixel_area_ha = 0.01  # 10m x 10m = 100m2 = 0.01 ha
    stats = {}
    for cls_id, cls_name in CROP_CLASSES.items():
        count = predictions.count(cls_id)
        stats[cls_name] = {
            'pixel_count': count,
            'area_ha': round(count * pixel_area_ha, 2),
            'color': CROP_COLORS[cls_name]
        }
    return stats


if __name__ == '__main__':
    import ee
    ee.Authenticate()
    ee.Initialize(project='your-gee-project-id')

    print("Loading Ground Truth CSV and sampling pixels from GEE...")
    df = get_training_samples_from_gee()
    print(f"Dataset shape: {df.shape}")
    if 'crop_class' in df.columns:
        print(df['crop_class'].value_counts())

    clf_rf, clf_xgb, metrics = train_model(df)
    print("Training complete!")
    
    metrics_summary = {
        "rf_accuracy": metrics["rf"]["accuracy"],
        "xgb_accuracy": metrics["xgb"]["accuracy"]
    }
    print("Metrics:", json.dumps(metrics_summary, indent=2))
