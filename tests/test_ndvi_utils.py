"""Tests for shared NDVI/VCI utilities."""

from project.backend.utils.ndvi_series import (
    generate_synthetic_ndvi_series,
    get_phenology_metrics,
    get_phenology_stage,
)


def test_series_length():
    """Generate the expected number of NDVI records."""
    series = generate_synthetic_ndvi_series()
    assert len(series) == 36


def test_series_sorted_by_date():
    """Return records sorted by date."""
    series = generate_synthetic_ndvi_series()
    dates = [row["date"] for row in series]
    assert dates == sorted(dates)


def test_series_vci_bounds():
    """Constrain all generated VCI values."""
    for row in generate_synthetic_ndvi_series():
        assert 0 <= row["vci"] <= 100


def test_phenology_keys():
    """Return recognized phenology stage names."""
    for row in generate_synthetic_ndvi_series():
        assert row["phenology_stage"] in ["Sowing", "Vegetative", "Flowering", "Maturity"]


def test_metrics_has_required_keys():
    """Compute all required phenology metrics."""
    metrics = get_phenology_metrics(generate_synthetic_ndvi_series())
    assert "start_of_season" in metrics
    assert "peak_growth_date" in metrics
    assert "length_of_growing_period_days" in metrics


def test_phenology_stage_all_ndvi():
    """Map a spread of NDVI values to valid stages."""
    for ndvi in [0.05, 0.15, 0.30, 0.45, 0.55, 0.65, 0.75, 0.90]:
        assert get_phenology_stage(ndvi) in ["Sowing", "Vegetative", "Flowering", "Maturity"]
