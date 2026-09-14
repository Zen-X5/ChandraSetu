"""
Matching Subsystem for Chandrayaan-2 Planetary Image Registration (Sahid & Khushi).
"""

from app.matching.preprocessing import (
    to_grayscale_uint8,
    apply_lunar_clahe,
    shadow_tolerant_normalization,
    enhance_crater_rims,
    compute_gradient_orientation_field,
    preprocess_lunar_pair,
)
from app.matching.phase_correlation import (
    create_2d_hanning_window,
    compute_subpixel_phase_correlation,
    compute_fourier_mellin_scale_rotation,
    extract_uniform_grid_candidate_matches,
    match_optical_pair_phase_correlation,
)
from app.matching.router import (
    route_and_match_pair,
)

__all__ = [
    "to_grayscale_uint8",
    "apply_lunar_clahe",
    "shadow_tolerant_normalization",
    "enhance_crater_rims",
    "compute_gradient_orientation_field",
    "preprocess_lunar_pair",
    "create_2d_hanning_window",
    "compute_subpixel_phase_correlation",
    "compute_fourier_mellin_scale_rotation",
    "extract_uniform_grid_candidate_matches",
    "match_optical_pair_phase_correlation",
    "route_and_match_pair",
]
