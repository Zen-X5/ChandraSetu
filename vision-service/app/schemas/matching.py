"""
Pydantic Schemas for Feature Matching, Phase Correlation, and Candidate Correspondences (Sahid & Khushi).
"""

from typing import Optional, List, Dict, Any, Tuple, Literal
from pydantic import BaseModel, Field


class CandidateMatch(BaseModel):
    """Single corresponding point pair between Source Image A and Reference Image B."""
    x1: float = Field(..., description="X coordinate in Image A (pixels)")
    y1: float = Field(..., description="Y coordinate in Image A (pixels)")
    x2: float = Field(..., description="X coordinate in Image B (pixels)")
    y2: float = Field(..., description="Y coordinate in Image B (pixels)")
    confidence: float = Field(1.0, description="Local cross-correlation / similarity score (0.0 to 1.0)")
    grid_row: Optional[int] = Field(None, description="Spatial grid row index for uniform distribution")
    grid_col: Optional[int] = Field(None, description="Spatial grid column index for uniform distribution")


class MatchingRequest(BaseModel):
    """Request payload for multimodal / optical feature matching."""
    image_a_path: str = Field(..., description="Path to rasterized Image A")
    image_b_path: str = Field(..., description="Path to rasterized Image B")
    instrument_a: Optional[str] = "OHRC"
    instrument_b: Optional[str] = "OHRC"
    overlap_window_a: Optional[Dict[str, int]] = None
    overlap_window_b: Optional[Dict[str, int]] = None
    grid_divisions: int = Field(4, description="Number of uniform spatial grid tiles per axis (e.g. 4x4 = 16 tiles)")
    use_fourier_mellin: bool = Field(True, description="Enable Log-Polar transform for scale & rotation recovery")
    enable_clahe: bool = Field(True, description="Enable Lunar CLAHE & shadow-aware preprocessing")


class MatchingResponse(BaseModel):
    """Candidate match correspondences and global geometric transformation estimate."""
    status: Literal["SUCCESS", "LOW_CONFIDENCE", "ERROR"]
    message: str
    method_used: str = "PHASE_CORRELATION"
    global_translation: Tuple[float, float] = Field((0.0, 0.0), description="Global sub-pixel shift (dx, dy) in pixels")
    estimated_rotation_deg: float = Field(0.0, description="Estimated rotation angle in degrees")
    estimated_scale_factor: float = Field(1.0, description="Estimated relative scale factor")
    peak_correlation_confidence: float = Field(0.0, description="Normalized cross-power peak intensity (0.0 to 1.0)")
    candidate_matches: List[CandidateMatch] = Field(default_factory=list, description="Uniformly distributed tie points")
    total_candidates: int = Field(0, description="Count of candidate correspondences found")
    spatial_coverage_ratio: float = Field(0.0, description="Fraction of spatial grid cells with valid match points (0.0 to 1.0)")
    details: Optional[Dict[str, Any]] = None
