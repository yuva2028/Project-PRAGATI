"""Tests for the irrigation advisory engine."""

from project.ml.advisory_engine import (
    compute_crop_water_requirement,
    compute_water_deficit,
    generate_advisory,
    generate_bulk_advisories,
    get_command_area_advisories,
)


class TestCropWaterRequirement:
    """Validate crop coefficient calculations."""

    def test_rice_vegetative(self):
        """Use Rice vegetative Kc of 1.20."""
        etc = compute_crop_water_requirement("Rice", "Vegetative", 36.0)
        assert abs(etc - 36.0 * 1.20) < 0.01

    def test_unknown_crop_fallback(self):
        """Use Others coefficients for unknown crops."""
        unknown = compute_crop_water_requirement("UnknownCrop", "Vegetative", 36.0)
        other = compute_crop_water_requirement("Others", "Vegetative", 36.0)
        assert unknown == other


class TestWaterDeficit:
    """Validate water deficit signs."""

    def test_deficit_when_etc_gt_rain(self):
        """Return positive deficit when ETc exceeds rainfall."""
        assert compute_water_deficit("Rice", "Vegetative", 5.0, 40.0) > 0

    def test_surplus_when_rain_gt_etc(self):
        """Return negative deficit when rainfall exceeds ETc."""
        assert compute_water_deficit("Rice", "Maturity", 200.0, 10.0) < 0


class TestGenerateAdvisory:
    """Validate single-field advisory output."""

    def test_severe_stress_immediate(self):
        """Make severe stress immediate."""
        advisory = generate_advisory("F001", "Rice", "Severe Stress", 10.0, "Vegetative", 0.0, 36.0)
        assert advisory["urgency"] == "IMMEDIATE"
        assert advisory["within_days"] == 1
        assert advisory["water_to_apply_mm"] > 0

    def test_healthy_no_water(self):
        """Avoid irrigation for healthy surplus fields."""
        advisory = generate_advisory("F002", "Rice", "Healthy", 90.0, "Maturity", 100.0, 10.0)
        assert advisory["urgency"] == "NONE"
        assert advisory["water_to_apply_mm"] == 0

    def test_all_keys_present(self):
        """Return keys required by API/frontend consumers."""
        advisory = generate_advisory("F003", "Maize", "Moderate Stress", 50.0, "Flowering", 20.0, 36.0)
        for key in (
            "field_id",
            "crop",
            "growth_stage",
            "stress_level",
            "vci",
            "water_to_apply_mm",
            "urgency",
            "recommendation",
            "priority",
        ):
            assert key in advisory


class TestBulkAdvisories:
    """Validate bulk advisory generation."""

    def test_returns_list(self):
        """Generate one advisory for one field."""
        fields = [{"field_id": "T001", "crop": "Rice", "stage": "Vegetative", "vci": 15, "rainfall_mm": 5}]
        result = generate_bulk_advisories(fields)
        assert isinstance(result, list) and len(result) == 1

    def test_default_generates_fields(self):
        """Generate demo fields when none are provided."""
        assert len(generate_bulk_advisories()) > 0

    def test_sorted_by_priority(self):
        """Sort field advisories by priority."""
        result = generate_bulk_advisories()
        priority_map = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3, "NONE": 4}
        for index in range(len(result) - 1):
            assert priority_map.get(result[index]["priority"], 5) <= priority_map.get(result[index + 1]["priority"], 5)


class TestCommandAreaAdvisories:
    """Validate command-area aggregation."""

    def test_returns_list(self):
        """Return at least one command summary."""
        result = get_command_area_advisories(generate_bulk_advisories())
        assert isinstance(result, list) and len(result) > 0

    def test_required_keys(self):
        """Return keys needed by command-area UI."""
        result = get_command_area_advisories(generate_bulk_advisories())
        for key in ("command_area", "total_fields_monitored", "discharge_recommendation", "gate_action"):
            assert key in result[0]

    def test_sorted_by_deficit(self):
        """Sort command areas by total deficit descending."""
        result = get_command_area_advisories(generate_bulk_advisories())
        for index in range(len(result) - 1):
            assert result[index]["total_deficit_mm"] >= result[index + 1]["total_deficit_mm"]
