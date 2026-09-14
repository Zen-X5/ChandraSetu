"""
Pydantic Schemas for RANSAC Validation, Spatial Distribution, and Precision Metrics (Urmi).
"""

from typing import Optional, List, Dict, Any, Tuple, Literal
from pydantic import BaseModel, Field

from app.schemas.matching import CandidateMatch


class ValidatedMatchPoint(BaseModel):
    """A correspondence point pair with computed reprojection residual error."""
    x1: float = Field(..., description="X coordinate in Image A (pixels)")
    y1: float = Field(..., description="Y coordinate in Image A (pixels)")
    x2: float = Field(..., description="X coordinate in Image B (pixels)")
    y2: float = Field(..., description="Y coordinate in Image B (pixels)")
    residual_error_px: float = Field(..., description="Reprojection error in pixels")
    is_inlier: bool = Field(True, description="True if point satisfies RANSAC threshold")
    grid_row: Optional[int] = None
    grid_col: Optional[int] = None


class RegistrationConfidence(BaseModel):
    """Rigorous scientific registration metrics matching SAC/ISRO 2025 published evaluation standards."""
    inlier_count: int = Field(..., description="Number of points supporting the final transform")
    total_candidates: int = Field(..., description="Total points extracted by matching stage")
    inlier_ratio: float = Field(..., description="Inlier fraction (inlier_count / total_candidates)")
    rmse_x_px: float = Field(..., description="Root Mean Square Error along X axis in pixels")
    rmse_y_px: float = Field(..., description="Root Mean Square Error along Y axis in pixels")
    total_rmse_px: float = Field(..., description="Total Root Mean Square Error in pixels")
    spatial_distribution_score: float = Field(..., description="Uniform spatial grid coverage score (0.0 to 1.0)")
    match_status: Literal["MATCHED", "UNCERTAIN", "UNMATCHED"] = Field(
        ..., description="Final scientific validation classification"
    )


class ValidationRequest(BaseModel):
    """Input payload for Urmi's RANSAC and Spatial Validation module."""
    candidate_matches: List[CandidateMatch] = Field(..., description="Candidate match points from Sahid/Khushi")
    coarse_transform: Optional[List[List[float]]] = Field(None, description="Rashel's 3x3 coarse affine transform")
    image_a_path: Optional[str] = Field(None, description="Path to Image A file for generating warped registered output")
    image_b_path: Optional[str] = Field(None, description="Path to Image B reference file")
    output_warped_path: Optional[str] = Field(None, description="Output destination for warped registered Image A")
    ransac_threshold_px: float = Field(2.5, description="RANSAC inlier distance threshold in pixels")
    max_iterations: int = Field(2000, description="Maximum RANSAC random sample iterations")
    confidence_level: float = Field(0.99, description="Desired probability of finding optimal model")
    grid_divisions: int = Field(4, description="Grid resolution for uniform distribution scoring")


class ValidationResponse(BaseModel):
    """Final validated geometric transformation and scientific proof of correspondence."""
    status: Literal["MATCHED", "UNCERTAIN", "UNMATCHED"]
    message: str
    final_transform_matrix: List[List[float]] = Field(..., description="Final 3x3 refined Homography transform")
    residual_transform_matrix: Optional[List[List[float]]] = Field(None, description="Residual correction on top of coarse geometry")
    confidence: RegistrationConfidence
    inlier_matches: List[ValidatedMatchPoint] = Field(default_factory=list)
    outlier_matches: List[ValidatedMatchPoint] = Field(default_factory=list)
    details: Optional[Dict[str, Any]] = None
