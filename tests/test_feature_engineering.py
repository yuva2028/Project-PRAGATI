"""Tests for crop feature engineering."""

import numpy as np

from project.ml.crop.feature_engineering import (
    calculate_evi,
    calculate_ndvi,
    calculate_ndwi,
    safe_divide,
)


class TestSafeDivide:
    """Validate safe vectorized division behavior."""

    def test_normal(self):
        """Divide finite values normally."""
        result = safe_divide(np.array([1.0]), np.array([2.0]))
        assert abs(result[0] - 0.5) < 1e-5

    def test_zero_denominator(self):
        """Use fill value when denominator is zero."""
        result = safe_divide(np.array([1.0]), np.array([0.0]), fill_value=-99.0)
        assert result[0] == -99.0

    def test_nan_propagation(self):
        """Use fill value when numerator is NaN."""
        result = safe_divide(np.array([np.nan]), np.array([1.0]), fill_value=0.0)
        assert result[0] == 0.0


class TestNDVI:
    """Validate NDVI calculations."""

    def test_range(self):
        """Keep NDVI in the normalized range."""
        result = calculate_ndvi(np.array([0.05, 0.20]), np.array([0.40, 0.60]))
        assert np.all(result >= -1) and np.all(result <= 1)

    def test_formula(self):
        """Match the standard NDVI formula."""
        expected = (0.50 - 0.10) / (0.50 + 0.10)
        assert abs(calculate_ndvi(np.array([0.10]), np.array([0.50]))[0] - expected) < 1e-5

    def test_zero_denominator(self):
        """Avoid non-finite output for a zero denominator."""
        result = calculate_ndvi(np.array([0.0]), np.array([0.0]))
        assert np.isfinite(result[0])

    def test_water_body_negative(self):
        """Return a negative NDVI-like value for low NIR water pixels."""
        result = calculate_ndvi(np.array([0.40]), np.array([0.10]))
        assert result[0] < 0


class TestNDWI:
    """Validate NDWI calculations."""

    def test_range(self):
        """Keep NDWI in the normalized range."""
        result = calculate_ndwi(np.array([0.10, 0.30]), np.array([0.50, 0.20]))
        assert np.all(result >= -1) and np.all(result <= 1)

    def test_water_positive(self):
        """Return a positive NDWI for high green and low NIR."""
        result = calculate_ndwi(np.array([0.40]), np.array([0.10]))
        assert result[0] > 0


class TestEVI:
    """Validate EVI calculations."""

    def test_formula(self):
        """Match the standard EVI formula."""
        blue, red, nir = np.array([0.02]), np.array([0.05]), np.array([0.40])
        expected = 2.5 * (0.40 - 0.05) / (0.40 + 6 * 0.05 - 7.5 * 0.02 + 1.0)
        result = calculate_evi(blue, red, nir)
        assert abs(result[0] - expected) < 1e-4

    def test_clipped(self):
        """Clip EVI to the normalized range."""
        result = calculate_evi(np.array([0.0]), np.array([0.0]), np.array([1.0]))
        assert -1.0 <= result[0] <= 1.0

    def test_no_crash_zero(self):
        """Avoid non-finite output for edge reflectance values."""
        result = calculate_evi(np.array([1.0]), np.array([1.0]), np.array([0.0]))
        assert np.isfinite(result[0])
