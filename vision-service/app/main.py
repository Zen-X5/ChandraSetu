import os
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware

from app.schemas.geometry import CoarseAlignmentRequest, CoarseAlignmentResponse
from app.schemas.matching import MatchingRequest, MatchingResponse
from app.schemas.validation import ValidationRequest, ValidationResponse
from app.geometry.camera_geometry import align_camera_geometry
from app.matching.router import route_and_match_pair
from app.validation.ransac import validate_and_refine_correspondences

app = FastAPI(
    title="ChandraSetu Vision Service",
    description="Microservice for Chandrayaan-2 Lunar Image Registration Pipeline (SIH26166)",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health", status_code=status.HTTP_200_OK)
def health_check():
    return {
        "status": "healthy",
        "service": "vision-service",
        "version": "1.0.0"
    }

@app.post(
    "/api/v1/geometry/align-coarse",
    response_model=CoarseAlignmentResponse,
    status_code=status.HTTP_200_OK,
    summary="Step 1: Camera Geometry Alignment (Rashel)"
)
def align_coarse(request: CoarseAlignmentRequest):
    """
    Hands Image A & Image B (and optional PDS4 XML metadata) to Rashel's camera geometry module.
    """
    img_a = request.image_a
    img_b = request.image_b

    if not os.path.exists(img_a.image_path):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Image A file not found at path: {img_a.image_path}"
        )
    if not os.path.exists(img_b.image_path):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Image B file not found at path: {img_b.image_path}"
        )

    result = align_camera_geometry(
        image_a_path=img_a.image_path,
        image_b_path=img_b.image_path,
        xml_a_path=img_a.xml_label_path,
        xml_b_path=img_b.xml_label_path,
        manual_bounds_a=img_a.manual_bounds,
        manual_bounds_b=img_b.manual_bounds
    )

    return result

@app.post(
    "/api/v1/matching/run",
    response_model=MatchingResponse,
    status_code=status.HTTP_200_OK,
    summary="Step 2: Signal Processing & Cross-Modal Feature Matching (Sahid & Khushi)"
)
def run_feature_matching(request: MatchingRequest):
    """
    Step 2 of ChandraSetu pipeline:
    Runs sub-pixel phase correlation, CLAHE shadow normalization, Fourier-Mellin scale/rotation
    recovery, and extracts spatially uniform grid correspondences.
    """
    if not os.path.exists(request.image_a_path):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Image A file not found at path: {request.image_a_path}"
        )
    if not os.path.exists(request.image_b_path):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Image B file not found at path: {request.image_b_path}"
        )

    result = route_and_match_pair(request)
    return result

@app.post(
    "/api/v1/validation/verify",
    response_model=ValidationResponse,
    status_code=status.HTTP_200_OK,
    summary="Step 3: RANSAC Validation & Precision Metrics (Urmi)"
)
def verify_registration(request: ValidationRequest):
    """
    Step 3 of ChandraSetu pipeline:
    Runs RANSAC homography estimation with spatial distribution scoring, computes split-axis
    RMSE (RMSE_X, RMSE_Y) per SAC/ISRO 2025 standard, and confirms match validity.
    """
    result = validate_and_refine_correspondences(request)
    return result
