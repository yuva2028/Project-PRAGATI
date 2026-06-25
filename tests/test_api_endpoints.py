"""FastAPI endpoint smoke tests."""

import pytest

try:
    from fastapi.testclient import TestClient

    try:
        from project.backend.main import app
    except ImportError as e:
        print(f"[WARN] Falling back to backend app import in tests: {e}")
        from backend.main import app

    client = TestClient(app)
    API_OK = True
except Exception as e:
    print(f"[WARN] FastAPI app not importable in tests: {e}")
    API_OK = False


@pytest.mark.skipif(not API_OK, reason="FastAPI app not importable in test environment")
class TestHealthAndRoot:
    """Smoke-test root API endpoints."""

    def test_root(self):
        """Return project metadata."""
        response = client.get("/")
        assert response.status_code == 200
        assert response.json()["project"] == "PRAGATI"

    def test_health(self):
        """Return health status."""
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json()["status"] == "ok"

    def test_docs(self):
        """Serve OpenAPI docs."""
        response = client.get("/docs")
        assert response.status_code == 200


@pytest.mark.skipif(not API_OK, reason="FastAPI app not importable in test environment")
class TestAdvisoryEndpoints:
    """Smoke-test advisory endpoints."""

    def test_get_advisory(self):
        """Return field advisories."""
        response = client.get("/api/advisory")
        assert response.status_code == 200
        assert len(response.json()["advisories"]) > 0

    def test_advisory_summary(self):
        """Return advisory summary."""
        response = client.get("/api/advisory/summary")
        assert response.status_code == 200
        data = response.json()
        assert "total_fields" in data
        assert "critical_alerts" in data

    def test_advisory_field_post_valid(self):
        """Accept a valid field advisory payload."""
        payload = {"field_id": "T001", "crop": "Rice", "vci": 25.0, "stage": "Vegetative", "rainfall_mm": 10.0}
        assert client.post("/api/advisory/field", json=payload).status_code == 200

    def test_advisory_field_post_invalid_vci(self):
        """Reject invalid VCI values."""
        payload = {"field_id": "T001", "crop": "Rice", "vci": 999.0, "stage": "Vegetative", "rainfall_mm": 10.0}
        assert client.post("/api/advisory/field", json=payload).status_code == 422

    def test_advisory_field_invalid_crop(self):
        """Reject invalid crop names."""
        payload = {"field_id": "T001", "crop": "Tomato", "vci": 50.0, "stage": "Vegetative", "rainfall_mm": 10.0}
        assert client.post("/api/advisory/field", json=payload).status_code == 422

    def test_command_summary(self):
        """Return command-area advisories."""
        response = client.get("/api/advisory/command-summary")
        assert response.status_code == 200
        assert len(response.json()["command_areas"]) > 0


@pytest.mark.skipif(not API_OK, reason="FastAPI app not importable in test environment")
class TestStressEndpoints:
    """Smoke-test stress endpoints."""

    def test_stress_map(self):
        """Return stress distribution."""
        response = client.get("/api/stress-map")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert "stress_distribution" in data

    def test_stress_geojson(self):
        """Return stress GeoJSON points."""
        response = client.get("/api/stress-geojson")
        assert response.status_code == 200
        data = response.json()
        assert data["type"] == "FeatureCollection"
        assert len(data["features"]) > 0

    def test_stress_tile(self):
        """Return stress tile fallback or live URL."""
        response = client.get("/api/tiles/stress")
        assert response.status_code == 200
        assert "tile_url" in response.json()

    def test_phenology(self):
        """Return phenology time-series data."""
        response = client.get("/api/phenology")
        assert response.status_code == 200
        data = response.json()
        assert "data" in data and len(data["data"]) > 0


@pytest.mark.skipif(not API_OK, reason="FastAPI app not importable in test environment")
class TestCropEndpoints:
    """Smoke-test crop endpoints."""

    def test_crop_stats(self):
        """Return crop statistics."""
        response = client.get("/api/crop-stats")
        assert response.status_code == 200
        data = response.json()
        assert "crops" in data
        assert len(data["crops"]) == 4

    def test_crop_geojson(self):
        """Return crop GeoJSON points."""
        response = client.get("/api/crop-geojson")
        assert response.status_code == 200
        assert response.json()["type"] == "FeatureCollection"

    def test_crop_tile(self):
        """Return crop tile fallback or live URL."""
        response = client.get("/api/crop-tile?band=NDVI")
        assert response.status_code == 200
        assert "tile_url" in response.json()

    def test_crop_tile_invalid(self):
        """Reject invalid crop tile bands."""
        response = client.get("/api/crop-tile?band=INVALID")
        assert response.status_code == 400

    def test_tiles_list(self):
        """Return tile layer list."""
        response = client.get("/api/tiles")
        assert response.status_code == 200


@pytest.mark.skipif(not API_OK, reason="FastAPI app not importable in test environment")
class TestAnalyticsEndpoints:
    """Smoke-test analytics endpoints."""

    def test_ndvi(self):
        """Return NDVI series."""
        response = client.get("/api/ndvi")
        assert response.status_code == 200
        data = response.json()
        assert "data" in data and len(data["data"]) > 0

    def test_rainfall(self):
        """Return rainfall summary."""
        response = client.get("/api/rainfall")
        assert response.status_code == 200
        assert "total_rainfall_mm" in response.json()

    def test_rainfall_series(self):
        """Return rainfall time series."""
        response = client.get("/api/rainfall-series")
        assert response.status_code == 200
        data = response.json()
        assert "data" in data and len(data["data"]) > 0

    def test_analytics(self):
        """Return combined analytics."""
        response = client.get("/api/analytics")
        assert response.status_code == 200
        assert "ndvi_trend" in response.json()
