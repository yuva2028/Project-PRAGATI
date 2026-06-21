# Project PRAGATI: Precision Remote-sensing & AI for Global Agricultural Trend Identification

An advanced, end-to-end satellite remote sensing pipeline and interactive dashboard built for the **ISRO Hackathon**. Project PRAGATI automates crop type identification, phenology-aware moisture stress detection, and field-level irrigation advisories using a combination of Google Earth Engine, Deep Learning, and classical Machine Learning.

![Project PRAGATI Dashboard](https://img.shields.io/badge/Status-Complete-success)
![React](https://img.shields.io/badge/Frontend-React%20%2B%20Vite-blue)
![FastAPI](https://img.shields.io/badge/Backend-FastAPI-green)
![Earth Engine](https://img.shields.io/badge/Data-Google%20Earth%20Engine-orange)

---

## 🌟 Core Features & Methodologies (Rubric Compliant)

### 1. Multi-Temporal Crop Classification (Optical + SAR)
- **Data**: Ingests Sentinel-2 (Optical) and Sentinel-1 (Microwave SAR) imagery over a 6-month growing season.
- **Processing**: Applies Atmospheric Correction (S2_SR) and a custom **Refined Lee Speckle Filter** via local variance calculation.
- **Feature Extraction**: Extracts NDVI, NDWI, EVI, VV, VH, and texture features (GLCM).
- **Temporal Stacking**: Generates a 22-dimensional multi-temporal stack comparing Early Season (T1) and Late Season (T2).
- **ML Model**: Supervised Random Forest trained dynamically on ground truth data (`data/ground_truth.csv`), achieving >85% target accuracy. Includes Explainable AI (Feature Importance) integration.

### 2. Phenology-Aware Moisture Stress Detection
- **Time-Series Analysis**: Generates continuous NDVI/CHIRPS Rainfall time-series.
- **Phenology Extraction**: Algorithmically detects **Start of Season (SOS)**, **Peak Growth**, and **Length of Growing Period (LGP)**.
- **Stage-Aware Stress**: Adjusts standard Vegetation Condition Index (VCI) severities dynamically. (e.g., Moisture stress during the `Flowering` stage triggers an amplified alert compared to the `Vegetative` stage).
- **Deep Learning**: Implements a PyTorch **LSTM Sequence Model** to predict the trajectory of moisture stress based on past satellite indicators.
- **Soil Moisture Index (SMI)**: Incorporates empirical SAR backscatter logic `SMI = (VH + 25) / 15 * 100` for all-weather soil condition monitoring.

### 3. Evapotranspiration-Driven Irrigation Advisory
- **Real Satellite ETc**: Connects directly to the MODIS/061/MOD16A2 Global Evapotranspiration sensor to extract literal 8-day water loss measurements.
- **Water Deficit Calculation**: Calculates `Deficit = (Real_ET0 × Kc) - Rainfall` using FAO-56 Crop Coefficients mapped to specific growth stages.
- **Command Area Mapping**: Simulates canal networks and parses soil types (Clay Loam, Sandy Loam) to generate hyper-localized, field-level actionable irrigation advisories.

---

## 🛠️ Tech Stack
- **Frontend**: React.js, Vite, Leaflet, Chart.js (Dashboard & UI)
- **Backend**: Python, FastAPI, Uvicorn, Pandas, Scikit-learn, PyTorch
- **Remote Sensing API**: Google Earth Engine (`ee`) API

---

## 🚀 How to Run Locally

### Prerequisites
1. Node.js (v18+)
2. Python (3.10+)
3. A Google Earth Engine Account / Service Account JSON key.

### 1. Setup the Backend
Open a terminal and navigate to the backend folder:
```bash
cd project/backend
# Create virtual environment
python -m venv venv
source venv/Scripts/activate  # (Windows) or source venv/bin/activate (Mac/Linux)

# Install dependencies
pip install -r requirements.txt

# Authenticate with Google Earth Engine
earthengine authenticate

# Run the FastAPI Server
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 2. Setup the Frontend
Open a new terminal and navigate to the frontend folder:
```bash
cd project/frontend

# Install node modules
npm install

# Start the Vite React app
npm run dev
```

### 3. Train the Machine Learning Model (Optional)
If you wish to re-train the Random Forest and LSTM using the latest live satellite sweeps:
```bash
cd project/ml
python crop_classifier.py
python moisture_model.py
```

---

## 🗺️ Output Deliverables Generated
1. **Crop Classification Map**: Viewable as an interactive GeoJSON Leaflet layer.
2. **Moisture Stress Maps (Stage-Wise)**: Color-coded severity based on extracted phenology.
3. **Time-Series Dashboard**: Interactive charts mapping NDVI, Rainfall, and VCI over 6 months.
4. **GeoTIFF Export**: Built-in Earth Engine `getDownloadURL` for off-platform QGIS analysis.

**Submission By:** Team PRAGATI for the ISRO Remote Sensing Hackathon.
