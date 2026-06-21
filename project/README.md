# Project PRAGATI 🛰️
## AI-Driven Crop Classification, Moisture Stress Detection & Irrigation Advisory

**ISRO Hackathon 2025 | Team Project | India**

---

## Architecture

```
Sentinel-1 (SAR) ──┐
                    ├──► Google Earth Engine ──► FastAPI Backend ──► React Dashboard
Sentinel-2 (Opt) ──┘         ↕                        ↕
                         NDVI/NDWI/VCI           PostgreSQL
CHIRPS Rainfall ──────────────────────────────► (PostGIS)
```

## Tech Stack

| Layer       | Tool                      |
|-------------|---------------------------|
| Satellite   | Sentinel-1, Sentinel-2    |
| Processing  | Google Earth Engine (GEE) |
| AI/ML       | Random Forest (sklearn)   |
| Backend     | FastAPI + Python          |
| Frontend    | React + Leaflet + Chart.js|
| Database    | PostgreSQL + PostGIS       |

## Quick Start

### 1. GEE Authentication (One time)
```bash
earthengine authenticate
```

### 2. Backend Setup
```bash
cd project/backend
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your GEE_PROJECT and DATABASE_URL
uvicorn main:app --reload --port 8000
```

### 3. Frontend Setup
```bash
cd project/frontend
npm install
npm run dev
# Open http://localhost:5173
```

### 4. Database Setup (Optional)
```bash
psql -U postgres -d pragati -f project/database/schema.sql
```

## Dashboard Pages

| Page | URL | Data Source |
|------|-----|-------------|
| Home | `/` | GEE + Advisory API |
| Crop Classification | `/crop-map` | Sentinel-1/2 → RF Model |
| Moisture Stress | `/stress` | Sentinel-2 NDVI → VCI |
| Irrigation Advisory | `/advisory` | FAO-56 + Rules Engine |
| Analytics | `/analytics` | NDVI + CHIRPS Time Series |

## API Endpoints

```
GET  /api/crop-map        → Crop classification results
GET  /api/crop-tile       → GEE tile URL for Leaflet
GET  /api/stress-map      → VCI stress distribution
GET  /api/stress-tile     → GEE stress tile URL
GET  /api/advisory        → Field-level advisories
GET  /api/advisory/summary→ Dashboard KPIs
GET  /api/ndvi            → NDVI time series
GET  /api/rainfall        → CHIRPS rainfall stats
GET  /api/analytics       → All analytics in one call
GET  /api/tiles/{layer}   → Any GEE layer tile URL
```

## Pilot Area: India
- Bounding Box: `[68.1, 8.0] → [97.4, 37.3]`
- Major Crops: Rice, Sugarcane, Maize
- Data Period: Last 6 months
- Resolution: 10m (Sentinel-2), 10m (Sentinel-1)

## Team

| Member | Role | Deliverable |
|--------|------|-------------|
| Member 1 | Satellite Data Engineer | GEE + NDVI/NDWI/EVI |
| Member 2 | AI/ML Engineer | Random Forest Crop Classifier |
| Member 3 | Remote Sensing Engineer | VCI + Moisture Stress + Advisory |
| Member 4 | Full Stack Engineer | React Dashboard + FastAPI |
