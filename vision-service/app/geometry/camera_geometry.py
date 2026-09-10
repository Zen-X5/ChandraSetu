from typing import Optional, Tuple, List, Dict
import os
import re
import math
from pathlib import Path
from dataclasses import asdict

import cv2
import numpy as np
import json

from app.schemas.geometry import (
    SelenographicBounds,
    CoarseAlignmentResponse,
    ImageMetadataInput,
)


LUNAR_RADIUS_M = 1737400.0


def _parse_bounds_from_xml(xml_path: str) -> Optional[SelenographicBounds]:
    p = Path(xml_path)
    if not p.exists():
        print(f"[Rashel] XML label not found at: {xml_path}")
        return None

    # Attempt robust XML parsing with heuristics for common PDS4 label layouts
    try:
        import xml.etree.ElementTree as ET
        tree = ET.parse(str(p))
        root = tree.getroot()
    except Exception as e:
        # Fallback: try reading raw text and regex
        print(f"[Rashel] XML parse failed ({e}), falling back to text search")
        txt = p.read_text(errors='ignore')
        # reuse previous regex approach as fallback
        def find_float_after_text(key_regex: str):
            m = re.search(rf"{key_regex}" + r"[^\d\-\.\+\n\r\>\<]{0,40}([\-0-9]+\.?[0-9]*)", txt, re.IGNORECASE)
            if m:
                try:
                    return float(m.group(1))
                except Exception:
                    return None
            return None

        north = find_float_after_text(r"north|max_lat|north_bounding|minimum_latitude|maximum_latitude")
        south = find_float_after_text(r"south|min_lat|south_bounding|minimum_latitude|minimum_latitude")
        east = find_float_after_text(r"east|max_lon|east_bounding|maximum_longitude|maximum_longitude")
        west = find_float_after_text(r"west|min_lon|west_bounding|minimum_longitude|minimum_longitude")

        if None in (north, south, east, west):
            return None
        center_lat = (south + north) / 2.0
        center_lon = (west + east) / 2.0
        return SelenographicBounds(min_lat=south, max_lat=north, min_lon=west, max_lon=east, center_lat=center_lat, center_lon=center_lon)

    # Walk XML tree and look for elements/attributes with latitude/longitude info
    def strip_ns(tag: str) -> str:
        return tag.split('}')[-1].lower()

    lat_vals = []
    lon_vals = []
    named = {}

    for elem in root.iter():
        tag = strip_ns(elem.tag)
        text = (elem.text or '').strip()
        # check attributes too
        for k, v in (elem.attrib or {}).items():
            k_l = k.lower()
            try:
                fv = float(v)
                if 'lat' in k_l or 'latitude' in k_l or 'north' in k_l or 'south' in k_l:
                    lat_vals.append(fv)
                    named.setdefault(k_l, []).append(fv)
                if 'lon' in k_l or 'longitude' in k_l or 'east' in k_l or 'west' in k_l:
                    lon_vals.append(fv)
                    named.setdefault(k_l, []).append(fv)
            except Exception:
                pass

        if text:
            # if element name suggests lat/lon
            try:
                fv = float(text)
                if 'min' in tag and 'lat' in tag:
                    named['min_lat'] = fv
                if 'max' in tag and 'lat' in tag:
                    named['max_lat'] = fv
                if 'min' in tag and 'lon' in tag:
                    named['min_lon'] = fv
                if 'max' in tag and 'lon' in tag:
                    named['max_lon'] = fv

                if 'lat' in tag or 'latitude' in tag or 'north' in tag or 'south' in tag:
                    lat_vals.append(fv)
                if 'lon' in tag or 'longitude' in tag or 'east' in tag or 'west' in tag:
                    lon_vals.append(fv)
            except Exception:
                # look for bounding coordinate lists like "(lat lon, lat lon, ...)"
                nums = re.findall(r"[-+]?[0-9]*\.?[0-9]+", text)
                if len(nums) >= 4:
                    # try to interpret as lat lon pairs, take mins/maxs
                    numsf = [float(x) for x in nums]
                    # assume order lat lon lat lon ... or lon lat
                    lats = numsf[0::2]
                    lons = numsf[1::2]
                    if len(lats) >= 1 and len(lons) >= 1:
                        lat_vals.extend(lats)
                        lon_vals.extend(lons)

    # If we found explicit named min/max in elements
    try:
        min_lat = float(named['min_lat']) if 'min_lat' in named else (min(lat_vals) if lat_vals else None)
        max_lat = float(named['max_lat']) if 'max_lat' in named else (max(lat_vals) if lat_vals else None)
        min_lon = float(named['min_lon']) if 'min_lon' in named else (min(lon_vals) if lon_vals else None)
        max_lon = float(named['max_lon']) if 'max_lon' in named else (max(lon_vals) if lon_vals else None)
    except Exception:
        return None

    if None in (min_lat, max_lat, min_lon, max_lon):
        return None

    center_lat = (min_lat + max_lat) / 2.0
    center_lon = (min_lon + max_lon) / 2.0
    return SelenographicBounds(min_lat=min_lat, max_lat=max_lat, min_lon=min_lon, max_lon=max_lon, center_lat=center_lat, center_lon=center_lon)


def _deg_to_meters(lat_deg: float, lon_deg: float, ref_lat_deg: float) -> Tuple[float, float]:
    # Convert degree deltas to meters on the lunar sphere approximation
    lat_m = lat_deg * (math.pi / 180.0) * LUNAR_RADIUS_M
    lon_m = lon_deg * (math.pi / 180.0) * LUNAR_RADIUS_M * math.cos(math.radians(ref_lat_deg))
    return lat_m, lon_m


def _instrument_resolution_mpp(instrument: Optional[str]) -> float:
    if not instrument:
        return 5.0
    s = instrument.upper()
    if "OHRC" in s:
        return 0.3
    if "TMC" in s:
        return 5.0
    if "IIRS" in s:
        return 80.0
    return 5.0


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

    print("\n" + "=" * 60)
    print("🛰️  [Rashel - Camera Geometry Module] Files received:")
    print(f"   📂 Image A: {image_a_path}")
    print(f"   📂 Image B: {image_b_path}")
    print(f"   📜 XML A:   {xml_a_path or 'None provided'}")
    print(f"   📜 XML B:   {xml_b_path or 'None provided'}")
    print("=" * 60 + "\n")

    # Try to obtain bounds for each image: manual override -> XML parse -> fail
    bounds_a = manual_bounds_a or (_parse_bounds_from_xml(xml_a_path) if xml_a_path else None)
    bounds_b = manual_bounds_b or (_parse_bounds_from_xml(xml_b_path) if xml_b_path else None)

    if bounds_a is None or bounds_b is None:
        return CoarseAlignmentResponse(
            status="INSUFFICIENT_GEODATA",
            message="Missing georeference bounds for one or both images. Provide PDS4 XML or manual bounds.",
        )

    # Ensure centers are present
    if bounds_a.center_lat is None:
        bounds_a.center_lat = (bounds_a.min_lat + bounds_a.max_lat) / 2.0
        bounds_a.center_lon = (bounds_a.min_lon + bounds_a.max_lon) / 2.0
    if bounds_b.center_lat is None:
        bounds_b.center_lat = (bounds_b.min_lat + bounds_b.max_lat) / 2.0
        bounds_b.center_lon = (bounds_b.min_lon + bounds_b.max_lon) / 2.0

    # Determine common frame resolution (use coarser of the two to avoid upsampling)
    res_a = _instrument_resolution_mpp(instrument_a or Path(image_a_path).stem)
    res_b = _instrument_resolution_mpp(instrument_b or Path(image_b_path).stem)
    common_res = max(res_a, res_b, 0.3)

    # Compute union bounds and overlap
    union_min_lat = min(bounds_a.min_lat, bounds_b.min_lat)
    union_max_lat = max(bounds_a.max_lat, bounds_b.max_lat)
    union_min_lon = min(bounds_a.min_lon, bounds_b.min_lon)
    union_max_lon = max(bounds_a.max_lon, bounds_b.max_lon)

    overlap_min_lat = max(bounds_a.min_lat, bounds_b.min_lat)
    overlap_max_lat = min(bounds_a.max_lat, bounds_b.max_lat)
    overlap_min_lon = max(bounds_a.min_lon, bounds_b.min_lon)
    overlap_max_lon = min(bounds_a.max_lon, bounds_b.max_lon)

    if overlap_min_lat >= overlap_max_lat or overlap_min_lon >= overlap_max_lon:
        return CoarseAlignmentResponse(
            status="NO_OVERLAP",
            message="Computed selenographic bounds do not overlap.",
            image_a_bounds=bounds_a,
            image_b_bounds=bounds_b,
        )

    # Validate and clamp bounds to sane ranges to avoid catastrophically large canvases
    def clamp_lat(lat: float) -> float:
        return max(-90.0, min(90.0, lat))

    def clamp_lon(lon: float) -> float:
        # normalize to [-180, 180]
        lon = ((lon + 180.0) % 360.0) - 180.0
        return lon

    union_min_lat = clamp_lat(union_min_lat)
    union_max_lat = clamp_lat(union_max_lat)
    union_min_lon = clamp_lon(union_min_lon)
    union_max_lon = clamp_lon(union_max_lon)
    overlap_min_lat = clamp_lat(overlap_min_lat)
    overlap_max_lat = clamp_lat(overlap_max_lat)
    overlap_min_lon = clamp_lon(overlap_min_lon)
    overlap_max_lon = clamp_lon(overlap_max_lon)

    lat_span_deg = union_max_lat - union_min_lat
    lon_span_deg = (union_max_lon - union_min_lon + 360.0) % 360.0
    if lon_span_deg > 180.0:
        lon_span_deg = 360.0 - lon_span_deg

    # Reject unrealistic spans
    if lat_span_deg <= 0 or lon_span_deg <= 0 or lat_span_deg > 180 or lon_span_deg > 360:
        return CoarseAlignmentResponse(
            status="ERROR",
            message=f"Computed invalid union spans lat={lat_span_deg:.2f}°, lon={lon_span_deg:.2f}°; check input bounds.",
            image_a_bounds=bounds_a,
            image_b_bounds=bounds_b,
        )

    # Compute approximate areas in meters for overlap ratio
    mean_lat = (bounds_a.center_lat + bounds_b.center_lat) / 2.0
    # deg spans
    def deg_spans(b: SelenographicBounds):
        return (b.max_lat - b.min_lat, b.max_lon - b.min_lon)

    a_lat_span_deg, a_lon_span_deg = deg_spans(bounds_a)
    b_lat_span_deg, b_lon_span_deg = deg_spans(bounds_b)
    o_lat_span_deg = overlap_max_lat - overlap_min_lat
    o_lon_span_deg = overlap_max_lon - overlap_min_lon

    a_h_m, a_w_m = _deg_to_meters(a_lat_span_deg, a_lon_span_deg, mean_lat)
    b_h_m, b_w_m = _deg_to_meters(b_lat_span_deg, b_lon_span_deg, mean_lat)
    o_h_m, o_w_m = _deg_to_meters(o_lat_span_deg, o_lon_span_deg, mean_lat)

    area_a = max(1.0, a_h_m * a_w_m)
    area_b = max(1.0, b_h_m * b_w_m)
    area_o = max(0.0, o_h_m * o_w_m)

    overlap_ratio = float(area_o / min(area_a, area_b))

    # Prepare output folder for coarse-aligned images
    out_dir = Path("uploads/coarse_aligned")
    out_dir.mkdir(parents=True, exist_ok=True)

    # Compute canvas in pixels for union
    union_h_m, union_w_m = _deg_to_meters(union_max_lat - union_min_lat, union_max_lon - union_min_lon, mean_lat)
    canvas_h_px = max(1, int(math.ceil(union_h_m / common_res)))
    canvas_w_px = max(1, int(math.ceil(union_w_m / common_res)))

    # Safety: prevent allocating ridiculously large canvases
    MAX_PIXELS = 10000 * 10000  # 100M pixels ~ 300MB for RGB uint8
    if canvas_h_px * canvas_w_px > MAX_PIXELS:
        return CoarseAlignmentResponse(
            status="ERROR",
            message=(f"Computed common-frame canvas too large ({canvas_h_px}x{canvas_w_px} pixels). "
                     "Check input bounds or provide manual bounds/resolution."),
            image_a_bounds=bounds_a,
            image_b_bounds=bounds_b,
        )

    # Helper to rasterize each image into the common canvas
    def rasterize_to_common(image_path: str, bounds: SelenographicBounds, out_name: str) -> Tuple[str, List[List[float]], Dict[str,int]]:
        img = cv2.imread(image_path, cv2.IMREAD_COLOR)
        if img is None:
            # create an empty placeholder
            canvas = np.zeros((canvas_h_px, canvas_w_px, 3), dtype=np.uint8)
            out_path = str(out_dir / out_name)
            cv2.imwrite(out_path, canvas)
            return out_path, [[1.0,0.0,0.0],[0.0,1.0,0.0],[0.0,0.0,1.0]], {"x":0,"y":0,"width":0,"height":0}

        # expected pixel size for this image in common frame
        lat_span_deg = bounds.max_lat - bounds.min_lat
        lon_span_deg = bounds.max_lon - bounds.min_lon
        h_m, w_m = _deg_to_meters(lat_span_deg, lon_span_deg, mean_lat)
        expected_h_px = max(1, int(round(h_m / common_res)))
        expected_w_px = max(1, int(round(w_m / common_res)))

        # resize source image to expected size (coarse approximation)
        resized = cv2.resize(img, (expected_w_px, expected_h_px), interpolation=cv2.INTER_AREA)

        # create canvas and paste
        canvas = np.zeros((canvas_h_px, canvas_w_px, 3), dtype=np.uint8)

        # compute pixel offsets: from top-left of union
        offset_x_m = _deg_to_meters(0.0, bounds.min_lon - union_min_lon, mean_lat)[1]
        offset_y_m = _deg_to_meters(union_max_lat - bounds.max_lat, 0.0, mean_lat)[0]
        offset_x = int(round(offset_x_m / common_res))
        offset_y = int(round(offset_y_m / common_res))

        # paste with clipping
        y0 = max(0, offset_y)
        x0 = max(0, offset_x)
        y1 = min(canvas_h_px, offset_y + expected_h_px)
        x1 = min(canvas_w_px, offset_x + expected_w_px)

        src_y0 = max(0, -offset_y)
        src_x0 = max(0, -offset_x)
        src_y1 = src_y0 + (y1 - y0)
        src_x1 = src_x0 + (x1 - x0)

        if y1 > y0 and x1 > x0:
            canvas[y0:y1, x0:x1, :] = resized[src_y0:src_y1, src_x0:src_x1, :]

        out_path = str(out_dir / out_name)
        cv2.imwrite(out_path, canvas)

        # compute affine: scale and translation from source pixel coords to common canvas
        h_src, w_src = img.shape[:2]
        scale_x = expected_w_px / float(w_src) if w_src > 0 else 1.0
        scale_y = expected_h_px / float(h_src) if h_src > 0 else 1.0
        affine = [[scale_x, 0.0, float(offset_x)], [0.0, scale_y, float(offset_y)], [0.0, 0.0, 1.0]]

        pixel_window = {"x": x0, "y": y0, "width": x1 - x0, "height": y1 - y0}
        return out_path, affine, pixel_window

    a_common_ref, a_affine, a_window = rasterize_to_common(image_a_path, bounds_a, "image_a_common.png")
    b_common_ref, b_affine, b_window = rasterize_to_common(image_b_path, bounds_b, "image_b_common.png")

    response = CoarseAlignmentResponse(
        status="SUCCESS",
        message="Coarse alignment completed.",
        image_a_bounds=bounds_a,
        image_b_bounds=bounds_b,
        overlap_bounds=SelenographicBounds(min_lat=overlap_min_lat, max_lat=overlap_max_lat, min_lon=overlap_min_lon, max_lon=overlap_max_lon, center_lat=(overlap_min_lat+overlap_max_lat)/2.0, center_lon=(overlap_min_lon+overlap_max_lon)/2.0),
        overlap_ratio=overlap_ratio,
        coarse_affine_matrix=None,
        details={
            "common_frame": {"projection": "Selenographic", "resolution_m_per_pixel": common_res},
            "image_a_common_ref": a_common_ref,
            "image_b_common_ref": b_common_ref,
            "image_a_transform_to_common": a_affine,
            "image_b_transform_to_common": b_affine,
            "image_a_overlap_window": a_window,
            "image_b_overlap_window": b_window,
        },
    )

    # Build terminal-friendly metadata structure and print as JSON
    try:
        overlap_bounds_obj = response.overlap_bounds
        common_frame_info = response.details.get("common_frame", {}) if response.details else {}

        metadata_output = {
            "source": {
                "lat_lon_bounds": {
                    "min_lat": float(bounds_a.min_lat),
                    "max_lat": float(bounds_a.max_lat),
                    "min_lon": float(bounds_a.min_lon),
                    "max_lon": float(bounds_a.max_lon),
                },
                "common_frame_image_ref": response.details.get("image_a_common_ref") if response.details else a_common_ref,
                "transform_to_common": response.details.get("image_a_transform_to_common") if response.details else a_affine,
                "overlap_pixel_window": response.details.get("image_a_overlap_window") if response.details else a_window,
            },
            "reference": {
                "lat_lon_bounds": {
                    "min_lat": float(bounds_b.min_lat),
                    "max_lat": float(bounds_b.max_lat),
                    "min_lon": float(bounds_b.min_lon),
                    "max_lon": float(bounds_b.max_lon),
                },
                "common_frame_image_ref": response.details.get("image_b_common_ref") if response.details else b_common_ref,
                "transform_to_common": response.details.get("image_b_transform_to_common") if response.details else b_affine,
                "overlap_pixel_window": response.details.get("image_b_overlap_window") if response.details else b_window,
            },
            "overlap": {
                "bounds": {
                    "min_lat": float(overlap_bounds_obj.min_lat),
                    "max_lat": float(overlap_bounds_obj.max_lat),
                    "min_lon": float(overlap_bounds_obj.min_lon),
                    "max_lon": float(overlap_bounds_obj.max_lon),
                },
                "source_pixel_window": response.details.get("image_a_overlap_window") if response.details else a_window,
                "reference_pixel_window": response.details.get("image_b_overlap_window") if response.details else b_window,
            },
            "common_frame": {
                "projection": common_frame_info.get("projection", "Selenographic"),
                "resolution_m_per_pixel": float(common_frame_info.get("resolution_m_per_pixel", common_res)),
            },
        }

        print(json.dumps(metadata_output, indent=2))
    except Exception as e:
        print(f"[Rashel] Failed to print metadata summary: {e}")

    return response
