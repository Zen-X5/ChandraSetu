"""
Master Camera Geometry and Photogrammetry Module (Rashel).
Orchestrates PDS4 metadata parsing, planetary projection reconciliation,
and coarse metric re-projection for Chandrayaan-2 lunar imagery (OHRC, TMC, IIRS).
"""

from typing import Optional, Dict, Any
from pathlib import Path
import json

from app.schemas.geometry import (
    SelenographicBounds,
    CoarseAlignmentResponse,
)
from app.geometry.metadata_parser import (
    parse_metadata_or_bounds,
    ParsedMetadata,
)
from app.geometry.coarse_align import perform_coarse_alignment


def align_camera_geometry(
    image_a_path: str,
    image_b_path: str,
    xml_a_path: Optional[str] = None,
    xml_b_path: Optional[str] = None,
    manual_bounds_a: Optional[SelenographicBounds] = None,
    manual_bounds_b: Optional[SelenographicBounds] = None,
    instrument_a: Optional[str] = None,
    instrument_b: Optional[str] = None,
) -> CoarseAlignmentResponse:
    """
    Step 1 of the Chandrayaan-2 image correspondence pipeline.
    Takes two images, parses their PDS4 XML labels or manual bounds, re-projects them into
    a shared metric coordinate frame, and computes the coarse affine alignment matrix.
    """
    print("\n" + "=" * 60)
    print(">> [Rashel - Camera Geometry Module] Files received:")
    print(f"   [Image A]: {image_a_path}")
    print(f"   [Image B]: {image_b_path}")
    print(f"   [XML A]:   {xml_a_path or 'None provided'}")
    print(f"   [XML B]:   {xml_b_path or 'None provided'}")
    print("=" * 60 + "\n")

    # 1. Parse Metadata for Image A & B
    meta_a = parse_metadata_or_bounds(
        xml_path=xml_a_path,
        manual_bounds=manual_bounds_a,
        instrument_hint=instrument_a or Path(image_a_path).stem,
    )
    meta_b = parse_metadata_or_bounds(
        xml_path=xml_b_path,
        manual_bounds=manual_bounds_b,
        instrument_hint=instrument_b or Path(image_b_path).stem,
    )

    if meta_a is None or meta_b is None:
        return CoarseAlignmentResponse(
            status="INSUFFICIENT_GEODATA",
            message="Missing georeference bounds for one or both images. Provide PDS4 XML or manual bounds.",
        )

    # 2. Execute Coarse Alignment & Metric Reprojection
    alignment_result = perform_coarse_alignment(
        image_a_path=image_a_path,
        image_b_path=image_b_path,
        meta_a=meta_a,
        meta_b=meta_b,
    )

    if alignment_result["status"] == "NO_OVERLAP":
        return CoarseAlignmentResponse(
            status="NO_OVERLAP",
            message=alignment_result.get("message", "Computed selenographic bounds do not overlap."),
            image_a_bounds=meta_a.bounds,
            image_b_bounds=meta_b.bounds,
            overlap_ratio=0.0,
        )

    if alignment_result["status"] != "SUCCESS":
        return CoarseAlignmentResponse(
            status="ERROR",
            message=alignment_result.get("message", "Coarse alignment failed."),
            image_a_bounds=meta_a.bounds,
            image_b_bounds=meta_b.bounds,
        )

    overlap_bounds = alignment_result.get("overlap_bounds")
    overlap_ratio = alignment_result.get("overlap_ratio", 0.0)
    coarse_affine = alignment_result.get("coarse_affine_matrix")
    details = alignment_result.get("details", {})

    # Convert corner_coordinates dict from (lat, lon) tuples to [lat, lon] lists for JSON serialisation
    def _corners_to_json(corners):
        if not corners:
            return None
        return {k: [float(v[0]), float(v[1])] for k, v in corners.items()}

    response = CoarseAlignmentResponse(
        status="SUCCESS",
        message="Coarse alignment completed.",
        image_a_bounds=meta_a.bounds,
        image_b_bounds=meta_b.bounds,
        image_a_corners=_corners_to_json(meta_a.corner_coordinates),
        image_b_corners=_corners_to_json(meta_b.corner_coordinates),
        overlap_bounds=overlap_bounds,
        overlap_ratio=overlap_ratio,
        coarse_affine_matrix=coarse_affine,
        details=details,
    )

    # 3. Output clean JSON metadata log for diagnostics
    try:
        debug_summary = {
            "source_instrument": meta_a.instrument,
            "reference_instrument": meta_b.instrument,
            "source_bounds": meta_a.bounds.model_dump(),
            "reference_bounds": meta_b.bounds.model_dump(),
            "overlap_bounds": overlap_bounds.model_dump() if overlap_bounds else None,
            "overlap_ratio": round(overlap_ratio, 4),
            "projection": details.get("projection"),
            "common_resolution_mpp": details.get("common_resolution_mpp"),
            "coarse_affine_matrix": coarse_affine,
        }
        print("\n[Rashel] Alignment Summary:")
        print(json.dumps(debug_summary, indent=2))
    except Exception as e:
        print(f"[Rashel] Diagnostic log format error: {e}")

    return response
