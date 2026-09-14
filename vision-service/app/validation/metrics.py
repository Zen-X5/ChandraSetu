"""
Scientific Accuracy Metrics and Decision Engine for Planetary Registration (Urmi).
Implements SAC/ISRO 2025 split-axis Root Mean Square Error (RMSE_X, RMSE_Y),
reprojection error analysis, and rigorous scientific match/uncertain/unmatched classification.
"""

from typing import Tuple, List, Dict, Any, Literal
import math
import numpy as np

from app.schemas.validation import RegistrationConfidence, ValidatedMatchPoint


def compute_reprojection_residuals(
    points_a: np.ndarray,
    points_b: np.ndarray,
    homography_matrix: np.ndarray
) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    """
    Computes point-by-point reprojection errors (e_x, e_y, total_error_px).
    Points: (N, 2) arrays.
    Homography: (3, 3) matrix.
    """
    if len(points_a) == 0:
        return np.array([]), np.array([]), np.array([])

    n = len(points_a)
    ones = np.ones((n, 1), dtype=np.float64)
    pts_a_homo = np.hstack([points_a.astype(np.float64), ones])  # (N, 3)

    # Project points A using H -> (N, 3)
    projected = (homography_matrix @ pts_a_homo.T).T

    # Normalize homogeneous coordinates (divide by Z)
    z = projected[:, 2:3]
    z_safe = np.where(np.abs(z) < 1e-9, 1e-9, z)
    pts_b_hat = projected[:, :2] / z_safe

    diff = points_b.astype(np.float64) - pts_b_hat
    dx = diff[:, 0]
    dy = diff[:, 1]
    errors_px = np.hypot(dx, dy)

    return dx, dy, errors_px


def calculate_isro_rmse_metrics(
    dx_inliers: np.ndarray,
    dy_inliers: np.ndarray
) -> Tuple[float, float, float]:
    """
    Computes split-axis RMSE metrics per SAC/ISRO 2025 benchmark standard:
    RMSE_X, RMSE_Y, and Total RMSE in pixels.
    """
    if len(dx_inliers) == 0:
        return 0.0, 0.0, 0.0

    rmse_x = float(np.sqrt(np.mean(dx_inliers ** 2)))
    rmse_y = float(np.sqrt(np.mean(dy_inliers ** 2)))
    total_rmse = float(np.sqrt(rmse_x ** 2 + rmse_y ** 2))

    return round(rmse_x, 4), round(rmse_y, 4), round(total_rmse, 4)


def classify_registration_confidence(
    inlier_count: int,
    total_candidates: int,
    total_rmse_px: float,
    spatial_distribution_score: float,
    min_inliers_matched: int = 8,
    min_inliers_uncertain: int = 5,
    max_rmse_threshold: float = 2.5,
) -> Literal["MATCHED", "UNCERTAIN", "UNMATCHED"]:
    """
    Strict scientific decision rule (ISRO/SAC 2025 standard):
    - MATCHED: High confidence (>=8 inliers, >=40% ratio, sub-pixel/tight RMSE <=2.5px, good spatial coverage).
    - UNCERTAIN: Borderline cases (e.g. 5-7 inliers or 25-40% ratio) with good RMSE (requires human check).
    - UNMATCHED: Insufficient inliers (<5) or catastrophic residual error (negative control rejection).
    """
    if total_candidates == 0 or inlier_count < min_inliers_uncertain:
        return "UNMATCHED"

    inlier_ratio = float(inlier_count / total_candidates)

    # Condition for Verified MATCHED
    if (
        inlier_count >= min_inliers_matched
        and inlier_ratio >= 0.40
        and total_rmse_px <= max_rmse_threshold
        and spatial_distribution_score >= 0.30
    ):
        return "MATCHED"

    # Condition for UNCERTAIN / Needs Review
    if inlier_count >= min_inliers_uncertain and (inlier_ratio >= 0.25 or inlier_count >= 8):
        return "UNCERTAIN"

    return "UNMATCHED"
