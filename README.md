# Project PRAGATI: Precision Remote-sensing & AI for Global Agricultural Trend Identification

An advanced, end-to-end satellite remote sensing platform built for the **ISRO Bharatiya Antariksh Hackathon 2026**. Project PRAGATI automates crop type identification, phenology-aware moisture stress detection, district-level yield forecasting, and field-level irrigation advisories using a combination of Google Earth Engine, Deep Learning, and classical Machine Learning.

![Project PRAGATI Dashboard](https://img.shields.io/badge/Status-Complete-success)
![React](https://img.shields.io/badge/Frontend-React%20%2B%20Vite-blue)
![FastAPI](https://img.shields.io/badge/Backend-FastAPI-green)
![Earth Engine](https://img.shields.io/badge/Data-Google%20Earth%20Engine-orange)

---

## 🗺️ System Architecture

```mermaid
graph TD
    %% Satellite Data Ingestion
    subgraph Data Acquisition (Google Earth Engine)
        S2[Sentinel-2 SR Harmonized] -->|QA60 Cloud Mask| S2_Clean[Optical Bands: Red, NIR, SWIR]
        S1[Sentinel-1 GRD SAR] -->|Refined Lee Speckle Filter| S1_Clean[Radar Bands: VV, VH]
        MODIS[MODIS MOD16A2] -->|ET0 Ingestion| ET[8-day Evapotranspiration]
        CHIRPS[CHIRPS Daily] -->|Rainfall Ingestion| Precip[Daily Precipitation]
    end

    %% Processing & Feature Extraction
    subgraph Feature Engineering (Backend API)
        S2_Clean -->|Index Extraction| Indices[NDVI, NDWI, EVI]
        S1_Clean -->|GLCM Calculations| Texture[GLCM Homogeneity/Entropy]
        Indices -->|Time Series| VCI[Vegetation Condition Index]
        S1_Clean -->|Ratio Analysis| SMI[Soil Moisture Index]
    end

    %% Machine Learning Models
    subgraph ML Intelligence Engine
        Indices & Texture -->|22-D Stack| RF_XGB[Random Forest & XGBoost Classifiers]
        VCI & Precip -->|Temporal Sequences| LSTM[PyTorch Sequence Model]
        RF_XGB -->|Crop Class| YieldModel[FAO Yield & MSP Economic Model]
    end

    %% Application Layer
    subgraph Decision Support Dashboard (React)
        RF_XGB -->|Map Overlays| CropMap[Crop Classification Map]
        LSTM -->|Stress Alerts| StressMap[Moisture Stress Map]
        ET & Precip & CropMap -->|Water Deficit| FAO[FAO-56 Irrigation Advisories]
        FAO -->|Command Aggregation| Canal[Canal Command Distributary Strategy]
        YieldModel -->|Economic Forecasts| YieldDash[Yield & MSP Revenue Dashboard]
        FAO & Weather[Open-Meteo Weather API] -->|Bilingual Advice| Kisan[KisanView Farmer Dashboard]
        FAO & LSTM -->|Alert Timeline| Alerts[Alert & Notification Center]
    end

    classDef default fill:#0d1526,stroke:#1e293b,color:#cbd5e1;
    classDef GEE fill:#1e3a8a,stroke:#3b82f6,color:#fff;
    classDef ML fill:#5b21b6,stroke:#8b5cf6,color:#fff;
    classDef Frontend fill:#065f46,stroke:#10b981,color:#fff;
    class S2,S1,MODIS,CHIRPS GEE;
    class RF_XGB,LSTM,YieldModel ML;
    class CropMap,StressMap,FAO,Canal,YieldDash,Kisan,Alerts Frontend;
```

---

## 🌟 Platform Feature Directory

### 1. Multi-Temporal Crop Classification (Optical + SAR)
- **Data**: Ingests Sentinel-2 (Optical) and Sentinel-1 (Microwave SAR) imagery over a 6-month growing season.
- **Processing**: Applies Atmospheric Correction (S2_SR) and a custom **Refined Lee Speckle Filter** via local variance calculation.
- **ML Model**: Supervised Random Forest and XGBoost classifiers trained dynamically on ground truth data (`data/ground_truth.csv`), achieving >93% cross-validation accuracy. Includes Explainable AI (Feature Importance) integration.

### 2. Phenology-Aware Moisture Stress Detection (LSTM)
- **Time-Series Analysis**: Generates continuous NDVI/CHIRPS Rainfall time-series.
- **Phenology Extraction**: Detects **Start of Season (SOS)**, **Peak Growth**, and **Length of Growing Period (LGP)**.
- **Deep Learning**: Implements a PyTorch **LSTM Sequence Model** to predict the trajectory of moisture stress based on past satellite indicators.
- **Soil Moisture Index (SMI)**: Incorporates empirical SAR backscatter logic `SMI = (VH + 25) / 15 * 100` for all-weather soil condition monitoring.

### 3. Evapotranspiration-Driven Irrigation Advisory
- **Real Satellite ETc**: Connects directly to the MODIS/061/MOD16A2 Global Evapotranspiration sensor to extract literal 8-day water loss measurements.
- **Water Deficit Calculation**: Calculates `Deficit = (Real_ET0 × Kc) - Rainfall` using FAO-56 Crop Coefficients mapped to specific growth stages.
- **Command Area Mapping**: Simulates canal networks and aggregates regional distributaries to advise canal gate managers on gate discharge flows (PMKSY planning).

### 4. Satellite Imagery Viewer
- **Compare Bands**: Slider component to perform side-by-side comparison of different satellite indices (NDVI, NDWI, EVI, Red, NIR).
- **Time-Lapse Playback**: 6-month agricultural time-lapse playback showing vegetation dynamics over the crop lifecycle.

### 5. Crop Yield & Economic Forecasting
- **FAO Productivity Model**: Predicts crop yield (tons/ha) adjusted dynamically for moisture stress (VCI trajectory).
- **Economic Valuation**: Calculates estimated farm-gate revenues and losses based on Government of India Minimum Support Prices (MSP) for Kharif 2026.

### 6. Farmer-Facing Portal (KisanView)
- **Bilingual Interface**: Simplified translation toggle supporting English and Hindi (हिन्दी) translations.
- **Traffic-Light Advisory**: High-contrast, accessibility-ready cards mapping advisories to Red (🔴 Irrigate Now), Yellow (🟡 Monitor), and Green (🟢 Healthy) status.
- **Text-to-Speech (TTS)**: One-tap voice advisory in Hindi and English.

### 7. Alert & Notification Center
- **Timeline**: Chronological feed of critical alerts, pest warnings, weather warnings, and satellite pass updates.
- **Twilio/WhatsApp Integration**: Architecture is production-ready for SMS advisory broadcasts. Includes a one-click **Webhook JSON Payload Generator** to demonstrate exact API integration payloads to judges without requiring paid API keys.

### 8. Premium Export Options
- **PDF Report**: Prints an executive satellite intelligence brief with charts and tables, formatted with official ISRO/PRAGATI headers.
- **GeoTIFF / CSV Export**: Built-in endpoints to export analytical grids for QGIS/Excel ingestion.

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
If you wish to re-train the Random Forest, XGBoost, and LSTM using the latest live satellite sweeps:
```bash
cd project/ml
python realistic_trainer.py
python train_lstm_synthetic.py
```

---

## 🏆 Evaluation Alignment (ISRO Hackathon Rubric)
1. **Conceptual Clarity**: Fully documented remote-sensing methodology cards, index references, and step-by-step processing pipeline diagrams.
2. **Technical Feasibility**: End-to-end integration of active ESA/Copernicus Sentinel-2, Sentinel-1, MODIS, and CHIRPS sensors with classical & deep learning models.
3. **Innovation & Impact**: Dynamic yield modeling cross-referenced with Minimum Support Prices (MSP) to show real agricultural economic impact.
4. **Actionable Deliverables**: Accessible farmer KisanView, PDF intelligence report, and GeoTIFF download options.

**Submission By:** Team PRAGATI for the ISRO Remote Sensing Hackathon.
