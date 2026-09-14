import os
import tempfile
import math
import numpy as np
import cv2
import pytest

from app.schemas.matching import MatchingRequest, MatchingResponse
from app.matching.preprocessing import (
    to_grayscale_uint8,
    apply_lunar_clahe,
    shadow_tolerant_normalization,
    compute_gradient_orientation_field,
    preprocess_lunar_pair,
)
from app.matching.phase_correlation import (
    compute_subpixel_phase_correlation,
    compute_fourier_mellin_scale_rotation,
    extract_uniform_grid_candidate_matches,
    match_optical_pair_phase_correlation,
)
from app.matching.router import route_and_match_pair


def create_synthetic_lunar_surface(size: int = 512, seed: int = 42) -> np.ndarray:
    """Generates a synthetic lunar terrain image with multiple crater structures."""
    np.random.seed(seed)
    surface = np.random.normal(120, 15, (size, size)).astype(np.float32)

    # Add synthetic circular craters
    craters = [
        (120, 150, 45, -60),
        (300, 200, 70, -80),
        (200, 380, 55, -70),
        (400, 420, 35, -50),
        (150, 300, 25, -40),
    ]

    y_grid, x_grid = np.ogrid[:size, :size]

    for cx, cy, radius, depth in craters:
        dist_sq = (x_grid - cx) ** 2 + (y_grid - cy) ** 2
        r_sq = radius ** 2
        mask_inside = dist_sq < r_sq
        surface[mask_inside] += depth * (1.0 - np.sqrt(dist_sq[mask_inside]) / radius)

        # Crater rim elevation
        rim_mask = (dist_sq >= r_sq) & (dist_sq < (radius * 1.3) ** 2)
        surface[rim_mask] += abs(depth) * 0.4 * (1.0 - (dist_sq[rim_mask] - r_sq) / ((radius * 1.3) ** 2 - r_sq))

    surface = np.clip(surface, 0, 255).astype(np.uint8)
    return surface


def test_lunar_preprocessing():
    """Test CLAHE and shadow-tolerant normalization."""
    img = create_synthetic_lunar_surface(256)
    clahe_out = apply_lunar_clahe(img)
    assert clahe_out.shape == (256, 256)
    assert clahe_out.dtype == np.uint8

    dog_out = shadow_tolerant_normalization(img)
    assert dog_out.shape == (256, 256)
    assert dog_out.dtype == np.uint8

    mag, ori = compute_gradient_orientation_field(img)
    assert mag.shape == (256, 256)
    assert ori.shape == (256, 256)


def test_subpixel_phase_correlation_exact_shift():
    """Test phase correlation with a known sub-pixel translation (dx, dy)."""
    img_a = create_synthetic_lunar_surface(256)

    # Shift image by subpixel amount: dx = +7.35 px, dy = -5.60 px
    true_dx = 7.35
    true_dy = -5.60

    warp_matrix = np.array([
        [1.0, 0.0, true_dx],
        [0.0, 1.0, true_dy]
    ], dtype=np.float32)

    img_b = cv2.warpAffine(img_a, warp_matrix, (256, 256), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REFLECT)

    (est_dx, est_dy), conf, _ = compute_subpixel_phase_correlation(img_a, img_b)

    # In phase correlation: dx is displacement from A to B
    assert pytest.approx(est_dx, abs=0.25) == true_dx
    assert pytest.approx(est_dy, abs=0.25) == true_dy
    assert conf > 0.5


def test_illumination_invariance_with_sun_angle_gradient():
    """Test matching robustness against extreme directional lighting / shadow shifts."""
    base_img = create_synthetic_lunar_surface(256)

    # Simulate Image A: sun from top-left
    y, x = np.mgrid[:256, :256]
    illum_a = (x + y) / (256.0 * 2.0) + 0.5
    img_a = np.clip(base_img.astype(np.float32) * illum_a, 0, 255).astype(np.uint8)

    # Simulate Image B: sun from bottom-right (opposite sun angle!) + small translation
    illum_b = (512 - x - y) / (256.0 * 2.0) + 0.5
    shift_mat = np.array([[1.0, 0.0, 4.0], [0.0, 1.0, -3.0]], dtype=np.float32)
    shifted = cv2.warpAffine(base_img, shift_mat, (256, 256), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REFLECT)
    img_b = np.clip(shifted.astype(np.float32) * illum_b, 0, 255).astype(np.uint8)

    res = match_optical_pair_phase_correlation(img_a, img_b, enable_clahe=True)

    assert res.status == "SUCCESS"
    assert pytest.approx(res.global_translation[0], abs=0.5) == 4.0
    assert pytest.approx(res.global_translation[1], abs=0.5) == -3.0


def test_uniform_grid_candidate_extraction():
    """Test candidate tie-point extraction across a 4x4 spatial grid."""
    img_a = create_synthetic_lunar_surface(512)
    shift_mat = np.array([[1.0, 0.0, 3.5], [0.0, 1.0, 2.5]], dtype=np.float32)
    img_b = cv2.warpAffine(img_a, shift_mat, (512, 512), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REFLECT)

    candidates, coverage = extract_uniform_grid_candidate_matches(
        img_a, img_b, grid_divisions=4, min_confidence=0.1
    )

    assert len(candidates) >= 10
    assert coverage >= 0.6  # Over 60% of spatial cells matched
    for c in candidates:
        assert 0 <= c.x1 <= 512
        assert 0 <= c.y1 <= 512
        assert pytest.approx(c.x2 - c.x1, abs=1.0) == 3.5
        assert pytest.approx(c.y2 - c.y1, abs=1.0) == 2.5


def test_router_end_to_end():
    """Test full router execution with image files on disk."""
    with tempfile.TemporaryDirectory() as tmp_dir:
        p_a = os.path.join(tmp_dir, "test_ohr1.png")
        p_b = os.path.join(tmp_dir, "test_ohr2.png")

        img_a = create_synthetic_lunar_surface(256)
        shift_mat = np.array([[1.0, 0.0, 5.0], [0.0, 1.0, -2.0]], dtype=np.float32)
        img_b = cv2.warpAffine(img_a, shift_mat, (256, 256), borderMode=cv2.BORDER_REFLECT)

        cv2.imwrite(p_a, img_a)
        cv2.imwrite(p_b, img_b)

        req = MatchingRequest(
            image_a_path=p_a,
            image_b_path=p_b,
            instrument_a="OHRC",
            instrument_b="OHRC",
            grid_divisions=4,
        )

        resp = route_and_match_pair(req)
        assert resp.status == "SUCCESS"
        assert resp.total_candidates > 0
        assert pytest.approx(resp.global_translation[0], abs=0.5) == 5.0
        assert pytest.approx(resp.global_translation[1], abs=0.5) == -2.0
