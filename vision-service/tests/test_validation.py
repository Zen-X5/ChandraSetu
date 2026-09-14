import numpy as np
import pytest

from app.schemas.matching import CandidateMatch
from app.schemas.validation import ValidationRequest, ValidationResponse
from app.validation.spatial_distribution import (
    compute_spatial_grid_coordinates,
    compute_spatial_distribution_score,
    prune_clusters_for_uniform_ransac,
)
from app.validation.metrics import (
    compute_reprojection_residuals,
    calculate_isro_rmse_metrics,
    classify_registration_confidence,
)
from app.validation.ransac import validate_and_refine_correspondences


def test_spatial_distribution_uniform_vs_clustered():
    """Test spatial distribution scoring for uniform spread vs single-cluster points."""
    # 16 points uniformly distributed across a 4x4 grid (0 to 400px)
    x = np.linspace(20, 380, 4)
    y = np.linspace(20, 380, 4)
    xx, yy = np.meshgrid(x, y)
    uniform_pts = np.column_stack([xx.ravel(), yy.ravel()])

    score_uniform, entropy_uniform = compute_spatial_distribution_score(
        uniform_pts, grid_divisions=4, image_bounds=(0.0, 0.0, 400.0, 400.0)
    )
    assert score_uniform > 0.85
    assert entropy_uniform > 0.90

    # 16 points clustered tightly in one corner
    clustered_pts = np.random.normal(50, 5, (16, 2))
    score_clustered, entropy_clustered = compute_spatial_distribution_score(
        clustered_pts, grid_divisions=4, image_bounds=(0.0, 0.0, 400.0, 400.0)
    )
    assert score_clustered < 0.20


def test_cluster_pruning_limits_points_per_cell():
    """Test that prune_clusters_for_uniform_ransac caps max points per grid cell."""
    candidates = []
    # 20 points in cell (0, 0)
    for i in range(20):
        candidates.append(CandidateMatch(x1=10.0 + i, y1=10.0 + i, x2=10.0, y2=10.0, confidence=0.8))
    # 5 points in cell (1, 1)
    for i in range(5):
        candidates.append(CandidateMatch(x1=200.0 + i, y1=200.0 + i, x2=200.0, y2=200.0, confidence=0.9))

    pruned = prune_clusters_for_uniform_ransac(candidates, grid_divisions=4, max_points_per_cell=3)
    # Total pruned should be 3 from cell (0,0) + 3 from cell (1,1) = 6
    assert len(pruned) == 6


def test_ransac_outlier_rejection_and_subpixel_rmse():
    """Test RANSAC outlier filtering with 40% outlier contamination."""
    np.random.seed(42)

    # True Homography (slight rotation + translation + scaling)
    true_H = np.array([
        [1.02, -0.01, 8.5],
        [0.01, 1.02, -5.2],
        [0.00001, 0.00002, 1.0]
    ], dtype=np.float64)

    # 20 genuine inlier points spread across image
    x = np.linspace(30, 480, 5)
    y = np.linspace(30, 480, 4)
    xx, yy = np.meshgrid(x, y)
    pts_a_inliers = np.column_stack([xx.ravel(), yy.ravel()])

    ones = np.ones((len(pts_a_inliers), 1))
    pts_a_homo = np.hstack([pts_a_inliers, ones])
    projected = (true_H @ pts_a_homo.T).T
    pts_b_inliers = projected[:, :2] / projected[:, 2:3]

    candidates: list[CandidateMatch] = []
    for (x1, y1), (x2, y2) in zip(pts_a_inliers, pts_b_inliers):
        candidates.append(CandidateMatch(x1=float(x1), y1=float(y1), x2=float(x2), y2=float(y2), confidence=0.95))

    # Add 12 extreme random outliers
    for _ in range(12):
        candidates.append(CandidateMatch(
            x1=float(np.random.uniform(0, 500)),
            y1=float(np.random.uniform(0, 500)),
            x2=float(np.random.uniform(0, 500)),
            y2=float(np.random.uniform(0, 500)),
            confidence=0.4
        ))

    req = ValidationRequest(
        candidate_matches=candidates,
        ransac_threshold_px=2.0,
        grid_divisions=4,
    )

    resp = validate_and_refine_correspondences(req)

    assert resp.status == "MATCHED"
    assert resp.confidence.inlier_count >= 18
    assert resp.confidence.total_rmse_px < 0.5  # Sub-pixel RMSE!
    assert resp.confidence.spatial_distribution_score > 0.6
    assert len(resp.outlier_matches) >= 10


def test_validation_decision_uncertain_case():
    """Test that borderline inlier counts (e.g. 7 inliers with low ratio) return UNCERTAIN."""
    np.random.seed(123)
    candidates = []
    # 7 genuine inliers
    for i in range(7):
        x = float(50 + i * 40)
        y = float(50 + i * 30)
        candidates.append(CandidateMatch(x1=x, y1=y, x2=x + 2.0, y2=y - 1.0, confidence=0.7))
    # 15 random noise points
    for _ in range(15):
        candidates.append(CandidateMatch(
            x1=float(np.random.uniform(0, 500)),
            y1=float(np.random.uniform(0, 500)),
            x2=float(np.random.uniform(0, 500)),
            y2=float(np.random.uniform(0, 500)),
            confidence=0.3
        ))

    req = ValidationRequest(candidate_matches=candidates, ransac_threshold_px=2.0)
    resp = validate_and_refine_correspondences(req)
    assert resp.status == "UNCERTAIN"


def test_validation_decision_unmatched_negative_control():
    """Test negative-control rejection (random noise matches return UNMATCHED)."""
    np.random.seed(99)
    candidates = []
    for _ in range(25):
        candidates.append(CandidateMatch(
            x1=float(np.random.uniform(0, 500)),
            y1=float(np.random.uniform(0, 500)),
            x2=float(np.random.uniform(0, 500)),
            y2=float(np.random.uniform(0, 500)),
            confidence=0.2
        ))

    req = ValidationRequest(candidate_matches=candidates, ransac_threshold_px=2.0)
    resp = validate_and_refine_correspondences(req)
    assert resp.status == "UNMATCHED"
    assert resp.confidence.inlier_count <= 5


def test_residual_homography_composition():
    """Test that H_final = H_residual * T_coarse composition is mathematically exact."""
    coarse_T = [[1.0, 0.0, 100.0], [0.0, 1.0, 50.0], [0.0, 0.0, 1.0]]

    # Pure translation residual dx = 5, dy = -2
    candidates = []
    for x in (50, 150, 250, 350):
        for y in (50, 150, 250, 350):
            candidates.append(CandidateMatch(x1=float(x), y1=float(y), x2=float(x + 5), y2=float(y - 2), confidence=0.9))

    req = ValidationRequest(candidate_matches=candidates, coarse_transform=coarse_T, ransac_threshold_px=1.5)
    resp = validate_and_refine_correspondences(req)

    assert resp.status == "MATCHED"
    final_H = np.array(resp.final_transform_matrix)
    # Offset should combine coarse translation (100, 50) + residual (5, -2) -> (105, 48)
    assert pytest.approx(final_H[0, 2], abs=0.5) == 105.0
    assert pytest.approx(final_H[1, 2], abs=0.5) == 48.0
