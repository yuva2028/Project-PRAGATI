"""Tests for the moisture stress model."""

import pytest

from project.ml.moisture_model import (
    compute_pixel_stress,
    get_phenology_stage,
    get_stress_category,
)


class TestStressCategory:
    """Validate VCI stress categories."""

    @pytest.mark.parametrize(
        ("vci", "label"),
        [
            (5, "Severe Stress"),
            (30, "High Stress"),
            (50, "Moderate Stress"),
            (70, "Low Stress"),
            (90, "Healthy"),
        ],
    )
    def test_vci_to_label(self, vci, label):
        """Map representative VCI values to labels."""
        assert get_stress_category(vci)["label"] == label

    def test_boundary_100(self):
        """Treat VCI 100 as healthy."""
        assert get_stress_category(100)["label"] == "Healthy"

    def test_boundary_0(self):
        """Treat VCI 0 as severe stress."""
        assert get_stress_category(0)["label"] == "Severe Stress"

    def test_has_color(self):
        """Return a hex color for every category."""
        category = get_stress_category(50)
        assert category["color"].startswith("#") and len(category["color"]) == 7


class TestPhenology:
    """Validate NDVI phenology stage mapping."""

    @pytest.mark.parametrize(
        ("ndvi", "stage"),
        [(0.10, "Sowing"), (0.35, "Vegetative"), (0.60, "Flowering"), (0.80, "Maturity")],
    )
    def test_stage(self, ndvi, stage):
        """Map representative NDVI values to stages."""
        assert get_phenology_stage(ndvi) == stage


class TestComputePixelStress:
    """Validate combined pixel stress output."""

    def test_required_keys(self):
        """Return all keys needed by API clients."""
        result = compute_pixel_stress(0.5, 0.1, 0.85, 0.1, -14.0, -20.0)
        for key in ("vci", "smi", "stress_label", "stress_color", "stress_level", "phenology_stage"):
            assert key in result

    @pytest.mark.parametrize("ndvi", [0.1, 0.4, 0.7])
    def test_vci_bounds(self, ndvi):
        """Constrain VCI to [0, 100]."""
        result = compute_pixel_stress(ndvi, 0.05, 0.85, ndvi - 0.3, -15.0, -21.0)
        assert 0 <= result["vci"] <= 100

    def test_equal_ndvi_no_crash(self):
        """Use neutral VCI when NDVI min and max are equal."""
        result = compute_pixel_stress(0.5, 0.5, 0.5, 0.1, -14.0, -20.0)
        assert result["vci"] == 50.0

    def test_smi_bounds(self):
        """Constrain SMI to [0, 100]."""
        result = compute_pixel_stress(0.5, 0.1, 0.85, 0.1, -14.0, -20.0)
        assert 0 <= result["smi"] <= 100

    def test_smi_clamped_for_very_low_vh(self):
        """SMI must not go below 0 even for extreme VH values."""
        result = compute_pixel_stress(0.3, 0.05, 0.8, -0.1, -18.0, -30.0)
        assert result["smi"] >= 0

    def test_smi_clamped_for_very_high_vh(self):
        """SMI must not exceed 100 even for extreme VH values."""
        result = compute_pixel_stress(0.6, 0.1, 0.9, 0.2, -10.0, -5.0)
        assert result["smi"] <= 100

    def test_smi_clamped_extreme_low_vh(self):
        result = compute_pixel_stress(0.3, 0.05, 0.8, -0.1, -18.0, -35.0)
        assert result["smi"] >= 0

    def test_smi_clamped_extreme_high_vh(self):
        result = compute_pixel_stress(0.6, 0.1, 0.9, 0.2, -10.0, -3.0)
        assert result["smi"] <= 100
