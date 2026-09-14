"""
Spatial Distribution and Grid-Based Uniform Coverage Engine (Urmi).
Fulfills official ISRO Problem Statement deliverable requiring non-clustered, uniformly
distributed point correspondences across the scene.
"""

from typing import List, Tuple, Dict, Optional
import math
import numpy as np

from app.schemas.matching import CandidateMatch
from app.schemas.validation import ValidatedMatchPoint


def compute_spatial_grid_coordinates(
    points_xy: np.ndarray,
    grid_divisions: int = 4,
    bounds: Optional[Tuple[float, float, float, float]] = None
) -> Tuple[np.ndarray, np.ndarray]:
    """
    Computes (grid_row, grid_col) cell indices for an array of (N, 2) points.
    Bounds: (min_x, min_y, max_x, max_y). If None, calculated from points.
    """
    if len(points_xy) == 0:
        return np.array([], dtype=int), np.array([], dtype=int)

    if bounds is None:
        min_x, min_y = float(np.min(points_xy[:, 0])), float(np.min(points_xy[:, 1]))
        max_x, max_y = float(np.max(points_xy[:, 0])), float(np.max(points_xy[:, 1]))
    else:
        min_x, min_y, max_x, max_y = bounds

    span_x = max(1e-5, max_x - min_x)
    span_y = max(1e-5, max_y - min_y)

    col_indices = np.clip(
        np.floor((points_xy[:, 0] - min_x) / span_x * grid_divisions).astype(int),
        0,
        grid_divisions - 1
    )
    row_indices = np.clip(
        np.floor((points_xy[:, 1] - min_y) / span_y * grid_divisions).astype(int),
        0,
        grid_divisions - 1
    )

    return row_indices, col_indices


def compute_spatial_distribution_score(
    inlier_points_a: np.ndarray,
    grid_divisions: int = 4,
    image_bounds: Optional[Tuple[float, float, float, float]] = None
) -> Tuple[float, float]:
    """
    Calculates the spatial distribution uniformity score (0.0 to 1.0) and Shannon Spatial Entropy.
    Returns:
        (grid_coverage_ratio, normalized_entropy)
    """
    if len(inlier_points_a) == 0:
        return 0.0, 0.0

    rows, cols = compute_spatial_grid_coordinates(
        inlier_points_a,
        grid_divisions=grid_divisions,
        bounds=image_bounds
    )

    total_cells = grid_divisions * grid_divisions
    cell_counts = np.zeros((grid_divisions, grid_divisions), dtype=int)

    for r, c in zip(rows, cols):
        cell_counts[r, c] += 1

    active_cells = int(np.count_nonzero(cell_counts))
    coverage_ratio = float(active_cells / total_cells)

    # Compute Normalized Shannon Entropy
    total_points = len(inlier_points_a)
    probabilities = cell_counts[cell_counts > 0] / float(total_points)
    entropy = -float(np.sum(probabilities * np.log2(probabilities)))
    max_entropy = math.log2(total_cells) if total_cells > 1 else 1.0
    normalized_entropy = float(entropy / max_entropy) if max_entropy > 0 else 0.0

    # Composite spatial score (weighted average of coverage and entropy)
    distribution_score = float(0.6 * coverage_ratio + 0.4 * normalized_entropy)
    return min(1.0, max(0.0, distribution_score)), normalized_entropy


def prune_clusters_for_uniform_ransac(
    candidates: List[CandidateMatch],
    grid_divisions: int = 4,
    max_points_per_cell: int = 3
) -> List[CandidateMatch]:
    """
    Suppresses dense spatial clustering (e.g. 20 points on a single bright crater rim)
    by selecting at most `max_points_per_cell` highest-confidence matches per grid tile.
    Ensures RANSAC samples from diverse spatial regions.
    """
    if not candidates:
        return []

    pts = np.array([[c.x1, c.y1] for c in candidates], dtype=np.float32)
    rows, cols = compute_spatial_grid_coordinates(pts, grid_divisions=grid_divisions)

    cell_bins: Dict[Tuple[int, int], List[CandidateMatch]] = {}

    for c_match, r, c in zip(candidates, rows, cols):
        c_match.grid_row = int(r)
        c_match.grid_col = int(c)
        cell_bins.setdefault((int(r), int(c)), []).append(c_match)

    pruned: List[CandidateMatch] = []
    for cell_key, cell_matches in cell_bins.items():
        # Sort by confidence descending
        sorted_matches = sorted(cell_matches, key=lambda m: m.confidence, reverse=True)
        pruned.extend(sorted_matches[:max_points_per_cell])

    return pruned
