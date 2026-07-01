# PRAGATI — System Architecture

## Overview

PRAGATI is a full-stack satellite agricultural intelligence platform. It ingests multi-sensor satellite data from Google Earth Engine, applies AI/ML models for crop and moisture analysis, and serves results through a FastAPI backend to a React dashboard.

---

## Pipeline Stages

### Stage 1: Data Ingestion (Google Earth Engine)

```
ESA Copernicus ──► Sentinel-2 SR Harmonized (10m, optical, 13 bands, 5-day)
ESA Copernicus ──► Sentinel-1 GRD (10m, SAR C-band, VV+VH, 6-day)
NASA ────────────► MODIS MOD16A2 (500m, ET₀, 8-day)
UCSB-CHG ────────► CHIRPS Daily (0.05°, rainfall mm, daily)
```

GEE scripts in `gee/` handle:
- Cloud masking (QA60 bit-shift: bits 10=clouds, 11=cirrus)
- Median temporal compositing (6-month window into T1 and T2 epochs)
- Index computation: NDVI = (NIR−Red)/(NIR+Red), NDWI = (NIR−SWIR)/(NIR+SWIR), EVI
- SAR preprocessing: Lee speckle filter, GLCM texture (contrast, dissimilarity, homogeneity)

---

### Stage 2: Feature Extraction

22-dimensional feature vector per field/pixel:

| Feature Group | Features |
|---|---|
| Sentinel-2 T1 | NDVI, NDWI, EVI, Red (B4), NIR (B8) |
| Sentinel-2 T2 | NDVI, NDWI, EVI, Red (B4), NIR (B8) |
| Sentinel-1 | VV, VH, VH/VV ratio, GLCM Contrast, Dissimilarity, Homogeneity, Energy |
| Temporal Delta | ΔNDVI (T2−T1), ΔNDWI (T2−T1) |

---

### Stage 3: Crop Classification

**Model**: Random Forest (500 trees) + XGBoost ensemble with soft voting

```
Input: [22-dim feature vector]
  ↓
Random Forest (sklearn, n_estimators=500, max_depth=12)
  ↓ probability [Rice, Maize, Sugarcane, Others]
XGBoost (n_estimators=300, max_depth=6, learning_rate=0.1)
  ↓ probability [Rice, Maize, Sugarcane, Others]
Ensemble: weighted soft vote (RF=0.55, XGB=0.45)
  ↓
Final class label + confidence score
```

**Training**: Karnataka ground truth CSV (`data/ground_truth.csv`) with synthetic augmentation
**CV Accuracy**: ~92–94% (5-fold stratified cross-validation)

---

### Stage 4: Moisture Stress (LSTM + VCI)

**Vegetation Condition Index (VCI)**:
```
VCI = (NDVI_current − NDVI_min) / (NDVI_max − NDVI_min) × 100
```

**LSTM Model** (`ml/lstm_moisture.py`):
- Architecture: 2-layer LSTM (input=3, hidden=64, num_layers=2) + Linear(64→1)
- Input sequence: 6 monthly timesteps of [NDVI, NDWI, CHIRPS rainfall (mm)]
- Output: VCI (0–100) → stress category

| VCI Range | Category |
|---|---|
| 0–20 | Severe Stress 🔴 |
| 20–40 | Moderate Stress 🟠 |
| 40–60 | Watch 🟡 |
| 60–100 | Normal 🟢 |

---

### Stage 5: Irrigation Advisory (FAO-56)

```
ET₀ (MODIS MOD16A2)
  × Kc (crop-stage coefficient, VCI-adjusted)
  = ETc (crop water requirement, mm/day)

Water Balance: 
  Deficit = ETc × 8 days − Rainfall (CHIRPS, 8-day sum)
  if Deficit > 5 mm → irrigation recommended
```

Priority levels: Critical (> 30mm deficit) → High (15–30mm) → Medium (5–15mm) → None

---

### Stage 6: API Layer (FastAPI)

```
GET /api/crop-map       ← runs crop classifier on current GEE image
GET /api/stress-map     ← runs LSTM VCI prediction
GET /api/advisory       ← FAO-56 water balance for all fields
GET /api/analytics      ← NDVI + CHIRPS time series (last 6 months)
GET /api/tiles/{layer}  ← GEE tile URLs for Leaflet.js map overlays
POST /api/chat          ← Gemini AI chatbot with agri context injection
```

**Caching** (to handle GEE latency ~3–8s per request):
1. Redis (if `REDIS_URL` set)
2. SQLite (`database/cache.db`) — automatic fallback
3. In-memory — last resort

Cache TTL: 1 hour for satellite data, 5 minutes for advisory data.

---

### Stage 7: Frontend (React)

```
React 18 + Vite
├── Leaflet.js          → Interactive maps with GEE tile overlays
├── Chart.js            → NDVI/CHIRPS time-series charts
├── Zustand             → Global state (coords, bbox, active field)
├── i18next             → Hindi ↔ English bilingual support
├── PWA (vite-plugin)   → Installable, offline-capable
└── JWT auth            → 24h token, stored in localStorage
```

---

## Offline / Demo Mode

When GEE is unavailable, all APIs return realistic synthetic data:
- Crop map: Synthetic GeoJSON from `data/ground_truth.csv` with augmentation
- Stress map: LSTM-predicted VCI values on 12 Karnataka field coordinates
- Analytics: Pre-computed time-series with realistic seasonal patterns

The frontend detects `gee: false` from `/health` and displays the amber banner.

---

## Security

- **Authentication**: JWT (HS256), 24-hour expiry
- **Passwords**: bcrypt hashing (cost factor 12)
- **CORS**: Configurable via `FRONTEND_URL` env var
- **Secrets**: Never committed — all via `.env` (SQLite fallback needs no DB password)
- **GEE key**: Validated to be within allowed directory before use

---

## Deployment Options

| Mode | Command | Services |
|------|---------|----------|
| Dev (backend) | `uvicorn backend.main:app --reload` | FastAPI + SQLite |
| Dev (frontend) | `npm run dev` | Vite HMR |
| Docker full | `docker-compose up` | FastAPI + Redis + Prometheus + Grafana + Nginx |
