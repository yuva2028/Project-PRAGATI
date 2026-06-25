"""Tests for real GLCM texture computation."""

import numpy as np
import pytest

pytest.importorskip("skimage", reason="scikit-image required for GLCM tests")

from project.ml.crop.glcm_texture import (
    compute_glcm_features,
    compute_glcm_for_point,
    _db_to_uint8,
)


class TestDbToUint8:
    def test_min_maps_to_zero(self):
        result = _db_to_uint8(np.array([-30.0]))
        assert result[0] == 0

    def test_max_maps_to_levels_minus_one(self):
        result = _db_to_uint8(np.array([5.0]))
        assert result[0] == 63   # GLCM_LEVELS - 1

    def test_clamps_below_range(self):
        result = _db_to_uint8(np.array([-99.0]))
        assert result[0] == 0

    def test_clamps_above_range(self):
        result = _db_to_uint8(np.array([99.0]))
        assert result[0] == 63


class TestComputeGlcmFeatures:
    def test_returns_contrast_and_entropy(self):
        patch = np.full((5, 5), -15.0, dtype=np.float32)
        result = compute_glcm_features(patch)
        assert "contrast" in result and "entropy" in result

    def test_uniform_patch_low_contrast(self):
        # Uniform patch has zero contrast
        patch = np.full((7, 7), -15.0, dtype=np.float32)
        result = compute_glcm_features(patch)
        assert result["contrast"] == pytest.approx(0.0, abs=1e-3)

    def test_high_variance_patch_higher_contrast(self):
        rng = np.random.default_rng(0)
        noisy = rng.uniform(-25, -5, size=(9, 9)).astype(np.float32)
        uniform = np.full((9, 9), -15.0, dtype=np.float32)
        assert compute_glcm_features(noisy)["contrast"] > compute_glcm_features(uniform)["contrast"]

    def test_too_small_raises(self):
        with pytest.raises(ValueError):
            compute_glcm_features(np.full((1, 1), -15.0))


class TestComputeGlcmForPoint:
    def test_returns_valid_dict(self):
        result = compute_glcm_for_point(-15.0)
        assert "contrast" in result and "entropy" in result

    def test_deterministic_with_same_rng(self):
        r1 = compute_glcm_for_point(-15.0, rng=np.random.default_rng(42))
        r2 = compute_glcm_for_point(-15.0, rng=np.random.default_rng(42))
        assert r1["contrast"] == r2["contrast"]
        assert r1["entropy"] == r2["entropy"]

    def test_different_vv_gives_different_contrast(self):
        dry = compute_glcm_for_point(-24.0, rng=np.random.default_rng(0))
        wet = compute_glcm_for_point(-11.0, rng=np.random.default_rng(0))
        # Different VV values should produce different textures
        assert dry != wet
