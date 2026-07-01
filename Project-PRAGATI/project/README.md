# Project PRAGATI 🛰️
## AI-Driven Satellite Agricultural Intelligence System
### Crop Classification · Moisture Stress Detection · Irrigation Advisory

**ISRO Hackathon 2026 | India**

[![Python](https://img.shields.io/badge/Python-3.11+-blue.svg)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.111-green.svg)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18.3-61DAFB.svg)](https://react.dev)
[![GEE](https://img.shields.io/badge/Google_Earth_Engine-enabled-34A853.svg)](https://earthengine.google.com)

---

## 🌾 What is PRAGATI?

**PRAGATI** (Progressive Remote-sensing for Agricultural Ground-truth And Technology Integration) is a full-stack AI platform that uses satellite imagery from ESA Copernicus (Sentinel-1/2) and NASA (MODIS, CHIRPS) to provide real-time crop monitoring and precision irrigation advisory for Indian farmers.

The system ingests multi-temporal SAR and optical imagery through Google Earth Engine, extracts 22-dimensional spectral+texture feature vectors, and feeds them through a trained Random Forest + XGBoost ensemble for crop classification, and an LSTM network for VCI-based moisture stress prediction.

---

## 🚀 Quick Start (5 minutes)

### Prerequisites
- Python 3.11+
- Node.js 18+
- Google Earth Engine account (for live data; demo mode works without it)

### 1. Backend Setup
```bash
cd Project-PRAGATI/project/backend

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env: add your GEE_PROJECT and (optional) GEMINI_API_KEY

# Start the server
uvicorn backend.main:app --reload --port 8000
```
> **Demo user auto-created on first start:** `admin` / `admin123`

### 2. GEE Authentication (for live satellite data)
```bash
earthengine authenticate
# Follow the browser prompt to authenticate your Google account
```

### 3. Frontend Setup
```bash
cd Project-PRAGATI/project/frontend
npm install
cp .env.example .env
npm run dev
# Open http://localhost:5173
```

### 4. Docker (full stack with Redis + Prometheus)
```bash
cd Project-PRAGATI/project
docker-compose up
```

---

## 🖥️ Dashboard Pages

| Page | Route | Description | Data Source |
|------|-------|-------------|-------------|
| **Command Center** | `/command-center` | Single-pane view of all AI outputs: crop map, stress map, growth stage, irrigation depth | GEE + ML models |
| **Overview** | `/` | KPI dashboard — fields monitored, alerts, VCI, water demand | Advisory API |
| **Crop Classification** | `/crop-map` | Interactive GeoJSON map of predicted crop types with model confidence | Sentinel-1/2 → RF+XGBoost |
| **Moisture Stress** | `/stress` | VCI heat map with field-level stress severity | Sentinel-2 NDVI → LSTM |
| **Irrigation Advisory** | `/advisory` | Field-level irrigation schedules with FAO-56 water balance | FAO-56 ETc rules engine |
| **Analytics** | `/analytics` | NDVI time-series, CHIRPS rainfall, multi-season comparison charts | GEE time series |
| **Satellite Viewer** | `/satellite` | Side-by-side band comparison (NDVI, NDWI, EVI, True Color) with temporal slider | Sentinel composite |
| **Yield Forecast** | `/yield` | District-level Kharif yield forecast with VCI-adjusted economic impact | FAO yield model |
| **KisanView** | `/kisan` | Simplified bilingual (Hindi/English) farmer interface with traffic-light alerts | Advisory API |
| **Alert Center** | `/alerts` | Prioritized field alerts with SMS export (Twilio) and PDF report generation | All APIs |
| **Methodology** | `/methodology` | Full technical pipeline documentation with interactive step-by-step breakdown | Static |

---

## 🏗️ Architecture

```
╔══════════════════════════════════════════════════════════════╗
║  DATA SOURCES                                                ║
║  Sentinel-2 (10m Optical) ─┐                                ║
║  Sentinel-1 (10m SAR)      ├──► Google Earth Engine API     ║
║  CHIRPS Rainfall ──────────┤      (NDVI · NDWI · VV · VH)  ║
║  MODIS ET ─────────────────┘                                ║
╠══════════════════════════════════════════════════════════════╣
║  AI / ML PIPELINE                                            ║
║  ┌──────────────────────────────────────────────────────┐   ║
║  │ Feature Extraction: 22-dim spectral+SAR+texture     │   ║
║  │ ↓                                                    │   ║
║  │ Crop Classifier: Random Forest + XGBoost ensemble   │   ║
║  │ Moisture Stress: LSTM → VCI prediction               │   ║
║  │ Advisory Engine: FAO-56 ETc water balance rules      │   ║
║  └──────────────────────────────────────────────────────┘   ║
╠══════════════════════════════════════════════════════════════╣
║  BACKEND  FastAPI (Python 3.11)                              ║
║  ├── /api/crop-map     Crop GeoJSON + tile URL               ║
║  ├── /api/stress-map   VCI stress GeoJSON                    ║
║  ├── /api/advisory     FAO-56 irrigation schedules           ║
║  ├── /api/analytics    NDVI/CHIRPS time series               ║
║  ├── /api/chat         Gemini AI chatbot                     ║
║  ├── /api/alerts       Field priority alerts                 ║
║  └── /api/auth         JWT authentication                    ║
║  Cache: Redis → SQLite fallback                              ║
║  DB: PostgreSQL → SQLite fallback                            ║
╠══════════════════════════════════════════════════════════════╣
║  FRONTEND  React 18 + Leaflet + Chart.js                     ║
║  11 pages · JWT auth · PWA · bilingual (EN/HI)               ║
╚══════════════════════════════════════════════════════════════╝
```

---

## 🛰️ ISRO Payload Compatibility

The pipeline uses open-access Sentinel imagery for rapid evaluation but is **sensor-agnostic** and directly aligned with ISRO's indigenous satellite payloads for national deployment:

| Feature / Index | GEE Sentinel Band | Equivalent ISRO Band | ISRO Fleet |
|:---|:---|:---|:---|
| **NDVI / EVI** | B4 (Red, 665nm) & B8 (NIR, 842nm) | Band 2 (Red, 650nm) & Band 3 (NIR, 820nm) | **LISS-III / LISS-IV / AWiFS** |
| **NDWI** | B8 (NIR) & B11 (SWIR, 1610nm) | Band 3 (NIR) & Band 4 (SWIR, 1620nm) | **LISS-III / AWiFS** |
| **SAR Speckle Filter** | Sentinel-1 C-band | EOS-04 C-band SAR (FRS-1/MRS mode) | **EOS-04 (RISAT-1A)** |
| **GLCM Texture** | VV / VH polarization | HH / HV / VV / VH polarization | **EOS-04 / RISAT-2B** |
| **Dual-pol ratio** | VH/VV ratio | HV/HH or VH/VV ratio | **EOS-04 (Dual-pol mode)** |
| **Future** | L/S-band SAR | L-band & S-band sweeps | **Upcoming NISAR** |

---

## 📡 API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/crop-map` | Crop classification GeoJSON with confidence scores |
| `GET` | `/api/crop-tile` | GEE tile URL for Leaflet overlay |
| `GET` | `/api/stress-map` | VCI-based moisture stress GeoJSON |
| `GET` | `/api/stress-tile` | GEE stress visualization tile |
| `GET` | `/api/advisory` | Field-level irrigation advisories |
| `GET` | `/api/advisory/summary` | Dashboard KPI summary |
| `GET` | `/api/ndvi` | NDVI time series (6-month) |
| `GET` | `/api/rainfall` | CHIRPS precipitation stats |
| `GET` | `/api/analytics` | Combined analytics response |
| `GET` | `/api/yield-forecast` | District yield forecast data |
| `GET` | `/api/weather-forecast` | 5-day weather from Open-Meteo |
| `GET` | `/api/alerts` | Prioritized field alerts |
| `POST` | `/api/chat` | AI chatbot (Gemini / rule-based fallback) |
| `POST` | `/api/auth/register` | New user registration |
| `POST` | `/api/auth/token` | JWT login |
| `GET` | `/docs` | Interactive Swagger UI |

---

## 🤖 AI Models

### 1. Crop Classifier (RF + XGBoost Ensemble)
- **Input**: 22-dimensional multi-temporal feature vector (Sentinel-1 VV/VH texture + Sentinel-2 NDVI/NDWI/EVI across T1 & T2 epochs)
- **Output**: `{Rice, Maize, Sugarcane, Others}` with confidence
- **Accuracy**: ~92–94% 5-fold cross-validation on Karnataka ground truth

### 2. Moisture Stress LSTM
- **Input**: 6-month NDVI + NDWI + CHIRPS rainfall sequence
- **Output**: VCI (0–100) → stress category `{Severe, Moderate, Watch, Normal}`
- **Architecture**: 2-layer LSTM (hidden=64) + linear output head
- **Training**: Synthetic time-series data mirroring GEE real-world patterns

### 3. Irrigation Advisory Engine
- **Method**: FAO-56 `ETc = ET₀ × Kc` crop water balance
- **Data**: MODIS MOD16A2 ET₀ + VCI-adjusted Kc coefficients
- **Output**: Irrigation depth (mm), volume (m³), urgency priority

---

## 🔒 Offline / Demo Mode

When Google Earth Engine is unavailable (rate limits, no authentication), the system automatically falls back to:
- **Crop map**: Realistic synthetic GeoJSON generated from ground-truth CSV
- **Stress map**: LSTM-predicted VCI values on Karnataka field grid
- **Analytics**: Pre-computed NDVI/CHIRPS time series with realistic noise

The dashboard banner displays `"Offline Simulation Mode"` transparently.

---

## 🧑‍💻 Demo Credentials

| Username | Password | Role |
|----------|----------|------|
| `admin` | `admin123` | Full access (auto-created on first start) |

---

## 🗂️ Project Structure

```
Project-PRAGATI/
└── project/
    ├── backend/           FastAPI application
    │   ├── api/           Route handlers (crop, stress, advisory, auth, chat...)
    │   ├── models/        SQLAlchemy ORM models
    │   ├── utils/         NDVI series utilities
    │   ├── main.py        App entry point + GEE init + cache init
    │   ├── database.py    DB engine (PostgreSQL → SQLite fallback)
    │   └── requirements.txt
    ├── frontend/          React 18 + Vite application
    │   └── src/
    │       ├── pages/     11 dashboard pages
    │       ├── components/ ChatBot, LocationSearch, ReportGenerator...
    │       ├── hooks/     useAuth, useUserLocation, useLeafletMap
    │       └── store/     Zustand global state
    ├── ml/                Machine learning modules
    │   ├── crop/          RF + XGBoost pipeline
    │   ├── lstm_moisture.py  LSTM model definition
    │   ├── moisture_model.py VCI prediction
    │   ├── advisory_engine.py FAO-56 rules
    │   └── weights/       Pre-trained model weights (.pth)
    ├── gee/               Google Earth Engine scripts
    │   ├── sentinel2.py   Optical imagery + NDVI/NDWI
    │   ├── sentinel1.py   SAR imagery + texture
    │   ├── modis.py       ET₀ extraction
    │   └── weather.py     CHIRPS rainfall
    ├── data/              Ground truth CSV (Karnataka fields)
    ├── database/          SQL schema + SQLite DB (auto-created)
    ├── docs/              Architecture & technical documentation
    └── docker-compose.yml Full stack deployment
```

---

## 🏗️ Deployment

### Local Development
```bash
# Backend
uvicorn backend.main:app --reload --port 8000

# Frontend  
cd frontend && npm run dev
```

### Docker (Production-like)
```bash
docker-compose up --build
# Backend: http://localhost:8000
# Frontend: http://localhost:5173
# Prometheus: http://localhost:9090
# Grafana: http://localhost:3000
```

---

## 📊 Pilot Area

- **Region**: Karnataka, India
- **Pilot Coordinates**: `[74.0°E, 11.5°N] → [78.5°E, 18.5°N]`
- **Major Crops**: Rice, Sugarcane, Maize
- **Data Period**: Rolling 6-month window
- **Satellite Resolution**: 10m (Sentinel-2), 10m (Sentinel-1)

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Satellite Data | Sentinel-1 (SAR), Sentinel-2 (Optical), MODIS ET, CHIRPS |
| Data Processing | Google Earth Engine (GEE) Python API |
| ML Framework | scikit-learn, PyTorch, XGBoost |
| Backend API | FastAPI 0.111, SQLAlchemy, Pydantic v2 |
| Caching | Redis (prod) → SQLite (dev fallback) |
| Authentication | JWT (PyJWT), bcrypt |
| Frontend | React 18, Vite, Leaflet, Chart.js, Zustand |
| Monitoring | Prometheus, Grafana |
| Containerization | Docker Compose |
| AI Chatbot | Google Gemini (rule-based fallback) |
