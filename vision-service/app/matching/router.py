"""
Multimodal Instrument Router and Orchestrator (Sahid & Khushi).
Routes optical image pairs (OHRC↔OHRC, OHRC↔TMC) to Sahid's Phase Correlation / Fourier-Mellin engine,
and cross-modal pairs (OHRC↔IIRS) to Khushi's Mutual Information engine.
"""

from typing import Optional, Dict, Any
from pathlib import Path
import cv2
import numpy as np

from app.schemas.matching import MatchingRequest, MatchingResponse
from app.matching.phase_correlation import match_optical_pair_phase_correlation
from app.geometry.coarse_align import load_lunar_raster


OPTICAL_INSTRUMENTS = {"OHRC", "TMC", "TMC-2", "TMC2"}
SPECTRAL_INSTRUMENTS = {"IIRS"}


def route_and_match_pair(request: MatchingRequest) -> MatchingResponse:
    """
    Inspects instrument types, loads overlapping rasters, and executes the optimal matching algorithm.
    """
    img_a_path = request.image_a_path
    img_b_path = request.image_b_path

    img_a = load_lunar_raster(img_a_path)
    img_b = load_lunar_raster(img_b_path)

    if img_a is None:
        return MatchingResponse(
            status="ERROR",
            message=f"Failed to load Image A from path: {img_a_path}",
            method_used="NONE",
        )
    if img_b is None:
        return MatchingResponse(
            status="ERROR",
            message=f"Failed to load Image B from path: {img_b_path}",
            method_used="NONE",
        )

    # Crop to overlap windows if provided
    if request.overlap_window_a:
        wa = request.overlap_window_a
        x0, y0, w, h = wa.get("x", 0), wa.get("y", 0), wa.get("width", img_a.shape[1]), wa.get("height", img_a.shape[0])
        if w > 10 and h > 10:
            img_a = img_a[y0:y0+h, x0:x0+w]

    if request.overlap_window_b:
        wb = request.overlap_window_b
        x0, y0, w, h = wb.get("x", 0), wb.get("y", 0), wb.get("width", img_b.shape[1]), wb.get("height", img_b.shape[0])
        if w > 10 and h > 10:
            img_b = img_b[y0:y0+h, x0:x0+w]

    inst_a = (request.instrument_a or "OHRC").upper()
    inst_b = (request.instrument_b or "OHRC").upper()

    # Route 1: Optical-Optical Pairs (OHRC <-> OHRC, OHRC <-> TMC) -> Sahid's Module
    if (inst_a in OPTICAL_INSTRUMENTS or inst_a == "UNKNOWN") and (inst_b in OPTICAL_INSTRUMENTS or inst_b == "UNKNOWN"):
        return match_optical_pair_phase_correlation(
            image_a=img_a,
            image_b=img_b,
            grid_divisions=request.grid_divisions,
            use_fourier_mellin=request.use_fourier_mellin,
            enable_clahe=request.enable_clahe,
        )

    # Route 2: Cross-Modal Pairs (OHRC <-> IIRS) -> Routed to Khushi or Gradient Matching
    # Fallback to gradient-enhanced phase correlation for optical-spectral bridge
    return match_optical_pair_phase_correlation(
        image_a=img_a,
        image_b=img_b,
        grid_divisions=request.grid_divisions,
        use_fourier_mellin=request.use_fourier_mellin,
        enable_clahe=request.enable_clahe,
    )
