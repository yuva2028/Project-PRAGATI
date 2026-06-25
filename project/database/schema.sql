-- Project PRAGATI - PostgreSQL Database Schema
-- PostGIS extension for geospatial field boundaries

CREATE EXTENSION IF NOT EXISTS postgis;

-- ── Districts ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS districts (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    state VARCHAR(100) DEFAULT 'India',
    boundary GEOMETRY(POLYGON, 4326),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO districts (name, boundary) VALUES (
    'India',
    ST_GeomFromText('POLYGON((68.1 8.0, 97.4 8.0, 97.4 37.3, 68.1 37.3, 68.1 8.0))', 4326)
) ON CONFLICT DO NOTHING;

-- ── Fields ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fields (
    id VARCHAR(10) PRIMARY KEY,
    crop_type VARCHAR(50),
    area_ha FLOAT,
    boundary GEOMETRY(POLYGON, 4326),
    centroid GEOMETRY(POINT, 4326),
    district_id INTEGER REFERENCES districts(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Satellite Observations ────────────────────────
CREATE TABLE IF NOT EXISTS satellite_observations (
    id SERIAL PRIMARY KEY,
    field_id VARCHAR(10) REFERENCES fields(id),
    observed_at DATE NOT NULL,
    ndvi FLOAT,
    ndwi FLOAT,
    evi  FLOAT,
    vv   FLOAT,
    vh   FLOAT,
    rainfall_mm FLOAT,
    vci  FLOAT,
    phenology_stage VARCHAR(50),
    data_source VARCHAR(50) DEFAULT 'GEE',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_obs_field_date ON satellite_observations(field_id, observed_at DESC);

-- ── Stress Records ────────────────────────────────
CREATE TABLE IF NOT EXISTS stress_records (
    id SERIAL PRIMARY KEY,
    field_id VARCHAR(10) REFERENCES fields(id),
    computed_at TIMESTAMPTZ DEFAULT NOW(),
    vci FLOAT,
    stress_label VARCHAR(50),
    stress_level INTEGER,
    phenology_stage VARCHAR(50)
);

-- ── Advisory Records ──────────────────────────────
CREATE TABLE IF NOT EXISTS advisory_records (
    id SERIAL PRIMARY KEY,
    field_id VARCHAR(10) REFERENCES fields(id),
    generated_at TIMESTAMPTZ DEFAULT NOW(),
    crop VARCHAR(50),
    growth_stage VARCHAR(50),
    stress_label VARCHAR(50),
    vci FLOAT,
    rainfall_mm FLOAT,
    etc_mm FLOAT,
    deficit_mm FLOAT,
    water_to_apply_mm FLOAT,
    urgency VARCHAR(20),
    priority VARCHAR(20),
    recommendation TEXT,
    within_days INTEGER
);

CREATE INDEX IF NOT EXISTS idx_advisory_priority ON advisory_records(priority, generated_at DESC);
