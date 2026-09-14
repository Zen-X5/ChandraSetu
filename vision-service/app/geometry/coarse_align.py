"""
Coarse Image Alignment and Metric Resolution Resampling Engine.
Computes common-frame re-projections, multi-scale antialiased downsampling,
bounding-box overlap regions of interest (ROI), and analytical 3x3 affine transformation matrices.
"""

from pathlib import Path
from typing import Tuple, Dict, Any, List, Optional, Union
import math
import re
import numpy as np
import cv2

from app.schemas.geometry import SelenographicBounds
from app.geometry.metadata_parser import ParsedMetadata
from app.geometry.projection import (
    LunarProjection,
    select_optimal_projection,
    compute_selenographic_overlap,
)


def _antialiased_resample(img: np.ndarray, target_w: int, target_h: int) -> np.ndarray:
    """
    Antialiased resampling for extreme scale differences (e.g. OHRC 0.32m -> TMC 5m or IIRS 80m).
    Applies Gaussian pre-filtering prior to decimation to eliminate moiré and Nyquist aliasing.
    """
    h, w = img.shape[:2]
    if target_w <= 0 or target_h <= 0 or h <= 0 or w <= 0:
        return np.zeros((max(1, target_h), max(1, target_w), 3 if img.ndim == 3 else 1), dtype=np.uint8)

    scale_x = w / float(target_w)
    scale_y = h / float(target_h)
    max_scale = max(scale_x, scale_y)

    # If downsampling significantly (> 2x), pre-blur with Gaussian filter
    if max_scale > 2.0:
        sigma = 0.5 * (max_scale - 1.0)
        ksize = int(math.ceil(sigma * 3.0)) * 2 + 1
        blurred = cv2.GaussianBlur(img, (ksize, ksize), sigmaX=sigma, sigmaY=sigma)
        return cv2.resize(blurred, (target_w, target_h), interpolation=cv2.INTER_AREA)
    elif max_scale > 1.0:
        return cv2.resize(img, (target_w, target_h), interpolation=cv2.INTER_AREA)
    else:
        # Upsampling
        return cv2.resize(img, (target_w, target_h), interpolation=cv2.INTER_CUBIC)


def load_lunar_raster(img_path: str, raw_props: Optional[Dict[str, Any]] = None) -> Optional[np.ndarray]:
    """
    Loads planetary imagery across multiple formats: PNG/JPEG/TIFF and raw binary PDS4 .img files.
    Uses memory-mapping (np.memmap) for multi-GB PDS4 raw cubes to prevent OOM memory exhaustion.
    Applies CLAHE adaptive contrast stretching to reveal low-light polar crater details.
    """
    p = Path(img_path)
    if not p.exists():
        return None

    # 1. Standard image loader (PNG/JPEG/TIFF)
    try:
        img = cv2.imread(img_path, cv2.IMREAD_COLOR)
        if img is not None and img.size > 0:
            return img
    except Exception:
        pass

    # 2. PIL Image Loader
    try:
        from PIL import Image
        with Image.open(img_path) as pil_img:
            return np.array(pil_img.convert("RGB"))
    except Exception:
        pass

    # 3. Raw Planetary Binary .img Raster Reader (PDS4 Array_2D_Image)
    try:
        file_size = p.stat().st_size
        lines = 0
        samples = 0
        if raw_props:
            for k, v in raw_props.items():
                if "line" in k and k != "axis_name":
                    try:
                        lines = int(re.search(r"\d+", str(v)).group(0))
                    except Exception:
                        pass
                if "sample" in k and k != "axis_name":
                    try:
                        samples = int(re.search(r"\d+", str(v)).group(0))
                    except Exception:
                        pass

        # Standard OHRC frame size fallback if metadata did not parse axes
        if lines == 0 or samples == 0:
            samples = 12000
            lines = file_size // samples

        if lines > 0 and samples > 0 and lines * samples <= file_size:
            dtype = np.uint8
            if file_size >= lines * samples * 2:
                dtype = np.uint16

            mmap = np.memmap(str(p), dtype=dtype, mode="r", shape=(lines, samples))
            stride_y = max(1, lines // 2048)
            stride_x = max(1, samples // 2048)
            sub = np.array(mmap[::stride_y, ::stride_x], dtype=np.float32)

            # Robust 1-99 percentile contrast stretch to 8-bit visual range
            p1, p99 = np.percentile(sub, (1, 99))
            denom = max(1.0, float(p99 - p1))
            stretched = np.clip((sub - p1) / denom * 255.0, 0, 255).astype(np.uint8)

            # Enhance low-contrast polar terrain details with CLAHE
            clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
            enhanced = clahe.apply(stretched)

            return cv2.cvtColor(enhanced, cv2.COLOR_GRAY2BGR)
    except Exception as e:
        print(f"[Rashel] Binary .img raster load fallback failed: {e}")

    return None


def perform_coarse_alignment(
    image_a_path: str,
    image_b_path: str,
    meta_a: ParsedMetadata,
    meta_b: ParsedMetadata,
    output_dir: Union[str, Path] = "uploads/coarse_aligned",
    max_canvas_dim: int = 4096,
) -> Dict[str, Any]:
    """
    Executes coarse geometric alignment between two lunar images.
    Returns:
        Dictionary containing overlap bounds, ratio, affine matrices, pixel windows, and common-frame raster paths.
    """
    out_path_dir = Path(output_dir).resolve()
    out_path_dir.mkdir(parents=True, exist_ok=True)

    bounds_a = meta_a.bounds
    bounds_b = meta_b.bounds

    # 1. Compute Selenographic Overlap
    overlap_bounds, overlap_ratio = compute_selenographic_overlap(bounds_a, bounds_b)
    if overlap_bounds is None or overlap_ratio <= 0.0:
        return {
            "status": "NO_OVERLAP",
            "message": "Computed selenographic bounds do not have any intersecting area.",
            "overlap_bounds": None,
            "overlap_ratio": 0.0,
        }

    # 2. Select Optimal Projection based on true scene center
    all_corner_lats: List[float] = []
    all_corner_lons: List[float] = []
    if meta_a.corner_coordinates:
        for lat, lon in meta_a.corner_coordinates.values():
            all_corner_lats.append(lat)
            all_corner_lons.append(lon)
    if meta_b.corner_coordinates:
        for lat, lon in meta_b.corner_coordinates.values():
            all_corner_lats.append(lat)
            all_corner_lons.append(lon)

    if all_corner_lats and all_corner_lons:
        scene_center_lat = sum(all_corner_lats) / len(all_corner_lats)
        scene_center_lon = sum(all_corner_lons) / len(all_corner_lons)
    else:
        scene_center_lat = (bounds_a.center_lat + bounds_b.center_lat) / 2.0
        scene_center_lon = (bounds_a.center_lon + bounds_b.center_lon) / 2.0

    projection = select_optimal_projection(scene_center_lat, scene_center_lon)

    # 3. Determine Common Metric Resolution (GSD in meters per pixel)
    common_res_mpp = max(meta_a.resolution_mpp, meta_b.resolution_mpp, 0.3)

    # 4. Compute Tight Union Extents from all projected physical corner points
    all_projected_pts: List[Tuple[float, float]] = []
    if meta_a.corner_coordinates:
        for lat, lon in meta_a.corner_coordinates.values():
            all_projected_pts.append(projection.forward(lat, lon))
    else:
        all_projected_pts.append(projection.forward(bounds_a.min_lat, bounds_a.min_lon))
        all_projected_pts.append(projection.forward(bounds_a.max_lat, bounds_a.max_lon))

    if meta_b.corner_coordinates:
        for lat, lon in meta_b.corner_coordinates.values():
            all_projected_pts.append(projection.forward(lat, lon))
    else:
        all_projected_pts.append(projection.forward(bounds_b.min_lat, bounds_b.min_lon))
        all_projected_pts.append(projection.forward(bounds_b.max_lat, bounds_b.max_lon))

    union_x_min = min(p[0] for p in all_projected_pts)
    union_x_max = max(p[0] for p in all_projected_pts)
    union_y_min = min(p[1] for p in all_projected_pts)
    union_y_max = max(p[1] for p in all_projected_pts)

    span_x_m = max(10.0, union_x_max - union_x_min)
    span_y_m = max(10.0, union_y_max - union_y_min)

    # Canvas dimensions in pixels
    canvas_w = int(math.ceil(span_x_m / common_res_mpp))
    canvas_h = int(math.ceil(span_y_m / common_res_mpp))

    # Safety clamp on canvas dimensions to avoid out-of-memory errors
    if canvas_w > max_canvas_dim or canvas_h > max_canvas_dim:
        scale_factor = max(canvas_w / max_canvas_dim, canvas_h / max_canvas_dim)
        common_res_mpp *= scale_factor
        canvas_w = int(math.ceil(span_x_m / common_res_mpp))
        canvas_h = int(math.ceil(span_y_m / common_res_mpp))

    # 5. Helper function to place an image on the common canvas using true 4-corner georeferencing
    def rasterize_layer(
        img_path: str,
        meta: ParsedMetadata,
        out_filename: str
    ) -> Tuple[str, List[List[float]], Dict[str, int]]:
        raw_img = load_lunar_raster(img_path, meta.raw_properties)
        if raw_img is None:
            # Fallback placeholder
            canvas = np.zeros((canvas_h, canvas_w, 3), dtype=np.uint8)
            out_file = str(out_path_dir / out_filename)
            cv2.imwrite(out_file, canvas)
            return out_file, [[1.0, 0.0, 0.0], [0.0, 1.0, 0.0], [0.0, 0.0, 1.0]], {"x": 0, "y": 0, "width": 0, "height": 0}

        orig_h, orig_w = raw_img.shape[:2]

        # Check if true 4-corner physical coordinates exist (handles Ascending/Descending and 180-deg yaw)
        has_corners = (
            meta.corner_coordinates is not None
            and all(k in meta.corner_coordinates for k in ("upper_left", "upper_right", "lower_right", "lower_left"))
        )

        if has_corners and meta.corner_coordinates:
            c = meta.corner_coordinates
            # Project each physical corner to metric projection
            x_ul, y_ul = projection.forward(c["upper_left"][0], c["upper_left"][1])
            x_ur, y_ur = projection.forward(c["upper_right"][0], c["upper_right"][1])
            x_lr, y_lr = projection.forward(c["lower_right"][0], c["lower_right"][1])
            x_ll, y_ll = projection.forward(c["lower_left"][0], c["lower_left"][1])

            # Convert to common canvas pixel coordinates (top is union_y_max)
            dst_ul = [(x_ul - union_x_min) / common_res_mpp, (union_y_max - y_ul) / common_res_mpp]
            dst_ur = [(x_ur - union_x_min) / common_res_mpp, (union_y_max - y_ur) / common_res_mpp]
            dst_lr = [(x_lr - union_x_min) / common_res_mpp, (union_y_max - y_lr) / common_res_mpp]
            dst_ll = [(x_ll - union_x_min) / common_res_mpp, (union_y_max - y_ll) / common_res_mpp]

            src_pts = np.float32([[0, 0], [orig_w, 0], [orig_w, orig_h], [0, orig_h]])
            dst_pts = np.float32([dst_ul, dst_ur, dst_lr, dst_ll])

            # Compute precise 3x3 projective homography from raw image pixels to common canvas
            H_to_canvas = cv2.getPerspectiveTransform(src_pts, dst_pts)

            # Warp raw image directly into georeferenced common canvas
            canvas = cv2.warpPerspective(
                raw_img,
                H_to_canvas,
                (canvas_w, canvas_h),
                flags=cv2.INTER_LINEAR,
                borderMode=cv2.BORDER_CONSTANT,
                borderValue=(0, 0, 0)
            )

            # Compute pixel window bounding box
            all_x = [dst_ul[0], dst_ur[0], dst_lr[0], dst_ll[0]]
            all_y = [dst_ul[1], dst_ur[1], dst_lr[1], dst_ll[1]]
            w_x0 = max(0, int(np.floor(min(all_x))))
            w_y0 = max(0, int(np.floor(min(all_y))))
            w_x1 = min(canvas_w, int(np.ceil(max(all_x))))
            w_y1 = min(canvas_h, int(np.ceil(max(all_y))))

            out_file = str((out_path_dir / out_filename).resolve())
            cv2.imwrite(out_file, canvas)

            affine_3x3 = H_to_canvas.tolist()
            pixel_window = {"x": w_x0, "y": w_y0, "width": max(1, w_x1 - w_x0), "height": max(1, w_y1 - w_y0)}
            return out_file, affine_3x3, pixel_window

        # Fallback to axis-aligned bounding box scaling if 4 corners are not provided
        bounds = meta.bounds
        x_min_i, y_min_i = projection.forward(bounds.min_lat, bounds.min_lon)
        x_max_i, y_max_i = projection.forward(bounds.max_lat, bounds.max_lon)

        b_x_min = min(x_min_i, x_max_i)
        b_x_max = max(x_min_i, x_max_i)
        b_y_min = min(y_min_i, y_max_i)
        b_y_max = max(y_min_i, y_max_i)

        target_w = max(1, int(round((b_x_max - b_x_min) / common_res_mpp)))
        target_h = max(1, int(round((b_y_max - b_y_min) / common_res_mpp)))

        resampled = _antialiased_resample(raw_img, target_w, target_h)

        # Offsets relative to top-left of the common canvas (y inverted for pixel coordinates: top is union_y_max)
        offset_x = int(round((b_x_min - union_x_min) / common_res_mpp))
        offset_y = int(round((union_y_max - b_y_max) / common_res_mpp))

        canvas = np.zeros((canvas_h, canvas_w, 3), dtype=np.uint8)

        # Safe pixel blit
        c_x0 = max(0, offset_x)
        c_y0 = max(0, offset_y)
        c_x1 = min(canvas_w, offset_x + target_w)
        c_y1 = min(canvas_h, offset_y + target_h)

        s_x0 = max(0, -offset_x)
        s_y0 = max(0, -offset_y)
        s_x1 = s_x0 + (c_x1 - c_x0)
        s_y1 = s_y0 + (c_y1 - c_y0)

        if c_x1 > c_x0 and c_y1 > c_y0:
            canvas[c_y0:c_y1, c_x0:c_x1] = resampled[s_y0:s_y1, s_x0:s_x1]

        out_file = str((out_path_dir / out_filename).resolve())
        cv2.imwrite(out_file, canvas)

        # 3x3 Affine Matrix mapping original image pixels (u, v, 1) -> common canvas pixels (x_c, y_c, 1)
        scale_u = target_w / float(orig_w) if orig_w > 0 else 1.0
        scale_v = target_h / float(orig_h) if orig_h > 0 else 1.0

        affine_3x3 = [
            [float(scale_u), 0.0, float(offset_x)],
            [0.0, float(scale_v), float(offset_y)],
            [0.0, 0.0, 1.0],
        ]

        # Pixel bounding window of this image on the common canvas
        pixel_window = {
            "x": max(0, c_x0),
            "y": max(0, c_y0),
            "width": max(1, c_x1 - c_x0),
            "height": max(1, c_y1 - c_y0),
        }

        # BUG FIX: was missing — Python implicitly returned None, causing
        # `ref_a, affine_a, win_a = rasterize_layer(...)` to crash with
        # TypeError: cannot unpack non-iterable NoneType
        return out_file, affine_3x3, pixel_window

    stem_a = Path(image_a_path).stem
    stem_b = Path(image_b_path).stem
    ref_a, affine_a, win_a = rasterize_layer(image_a_path, meta_a, f"{stem_a}_coarse_aligned.png")
    ref_b, affine_b, win_b = rasterize_layer(image_b_path, meta_b, f"{stem_b}_coarse_aligned.png")

    # 6. Compute Direct Transformation Matrix T_{A -> B} = T_{B -> common}^{-1} * T_{A -> common}
    try:
        mat_a = np.array(affine_a, dtype=np.float64)
        mat_b = np.array(affine_b, dtype=np.float64)
        mat_b_inv = np.linalg.inv(mat_b)
        mat_a_to_b = mat_b_inv @ mat_a
        coarse_affine_a_to_b = mat_a_to_b.tolist()
    except Exception:
        coarse_affine_a_to_b = [[1.0, 0.0, 0.0], [0.0, 1.0, 0.0], [0.0, 0.0, 1.0]]

    # 7. Compute Overlap ROI Window in Common Canvas
    x_min_o, y_min_o = projection.forward(overlap_bounds.min_lat, overlap_bounds.min_lon)
    x_max_o, y_max_o = projection.forward(overlap_bounds.max_lat, overlap_bounds.max_lon)
    o_x_min = min(x_min_o, x_max_o)
    o_x_max = max(x_min_o, x_max_o)
    o_y_min = min(y_min_o, y_max_o)
    o_y_max = max(y_min_o, y_max_o)

    overlap_x0 = max(0, int(round((o_x_min - union_x_min) / common_res_mpp)))
    overlap_y0 = max(0, int(round((union_y_max - o_y_max) / common_res_mpp)))
    overlap_w = max(1, int(round((o_x_max - o_x_min) / common_res_mpp)))
    overlap_h = max(1, int(round((o_y_max - o_y_min) / common_res_mpp)))

    overlap_window = {
        "x": overlap_x0,
        "y": overlap_y0,
        "width": min(overlap_w, canvas_w - overlap_x0),
        "height": min(overlap_h, canvas_h - overlap_y0),
    }

    return {
        "status": "SUCCESS",
        "message": "Coarse geometric alignment and reprojection completed.",
        "overlap_bounds": overlap_bounds,
        "overlap_ratio": overlap_ratio,
        "coarse_affine_matrix": coarse_affine_a_to_b,
        "details": {
            "projection": projection.name,
            "common_resolution_mpp": float(common_res_mpp),
            "canvas_dimensions": {"width": canvas_w, "height": canvas_h},
            "image_a_common_ref": ref_a,
            "image_b_common_ref": ref_b,
            "image_a_transform_to_common": affine_a,
            "image_b_transform_to_common": affine_b,
            "image_a_overlap_window": win_a,
            "image_b_overlap_window": win_b,
            "common_overlap_window": overlap_window,
        },
    }
