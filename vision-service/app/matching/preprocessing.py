"""
Lunar-Specific Image Preprocessing and Illumination-Invariant Filtering (Sahid).
Implements SAC/ISRO 2025 published pipeline standards: CLAHE, shadow-aware intensity
normalization, morphological crater rim enhancement, and Sobel/Scharr gradient direction fields.
"""

from typing import Tuple, Optional
import numpy as np
import cv2


def to_grayscale_uint8(img: np.ndarray) -> np.ndarray:
    """Converts multi-channel or float array to standardized single-channel uint8."""
    if img is None:
        raise ValueError("Input image is None")
    if img.ndim == 3:
        if img.shape[2] == 4:
            gray = cv2.cvtColor(img, cv2.COLOR_BGRA2GRAY)
        elif img.shape[2] == 3:
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        else:
            gray = img[:, :, 0]
    else:
        gray = img

    if gray.dtype != np.uint8:
        p2, p98 = np.percentile(gray, (2, 98))
        denom = max(1e-5, float(p98 - p2))
        gray = np.clip((gray.astype(np.float32) - p2) / denom * 255.0, 0, 255).astype(np.uint8)

    return gray


def apply_lunar_clahe(
    img: np.ndarray,
    clip_limit: float = 3.5,
    tile_grid_size: Tuple[int, int] = (8, 8)
) -> np.ndarray:
    """
    Applies Contrast Limited Adaptive Histogram Equalization (CLAHE).
    Balances extreme shadows and bright sunlit crater slopes without amplifying background noise.
    """
    gray = to_grayscale_uint8(img)
    clahe = cv2.createCLAHE(clipLimit=clip_limit, tileGridSize=tile_grid_size)
    return clahe.apply(gray)


def shadow_tolerant_normalization(img: np.ndarray) -> np.ndarray:
    """
    Suppresses shadow bias caused by low lunar grazing sun angles while boosting subtle topography.
    Uses bandpass filtering (Gaussian difference / DoG) to emphasize structural frequencies.
    """
    gray = to_grayscale_uint8(img).astype(np.float32)
    
    # Difference of Gaussians (DoG) bandpass filter
    blur_fine = cv2.GaussianBlur(gray, (3, 3), sigmaX=1.0)
    blur_coarse = cv2.GaussianBlur(gray, (21, 21), sigmaX=5.0)
    dog = blur_fine - blur_coarse

    # Normalize to [0, 255]
    dog_norm = cv2.normalize(dog, None, alpha=0, beta=255, norm_type=cv2.NORM_MINMAX, dtype=cv2.CV_8U)
    return dog_norm


def enhance_crater_rims(img: np.ndarray) -> np.ndarray:
    """
    Morphological top-hat and gradient filtering to accentuate circular crater rims and geologic ridges.
    """
    gray = to_grayscale_uint8(img)
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    tophat = cv2.morphologyEx(gray, cv2.MORPH_TOPHAT, kernel)
    gradient = cv2.morphologyEx(gray, cv2.MORPH_GRADIENT, kernel)
    enhanced = cv2.addWeighted(tophat, 0.5, gradient, 0.5, 0)
    return enhanced


def compute_gradient_orientation_field(img: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
    """
    Computes horizontal (Gx) and vertical (Gy) Scharr gradients, returning:
    (magnitude, orientation_radians in [-pi, +pi]).
    Gradient direction is invariant to monotonic brightness changes and sun elevation shifts.
    """
    gray = to_grayscale_uint8(img).astype(np.float32)
    # Scharr operator provides superior rotational symmetry over standard 3x3 Sobel
    gx = cv2.Scharr(gray, cv2.CV_32F, 1, 0)
    gy = cv2.Scharr(gray, cv2.CV_32F, 0, 1)

    magnitude = np.hypot(gx, gy)
    orientation = np.arctan2(gy, gx)
    return magnitude, orientation


def preprocess_lunar_pair(
    img_a: np.ndarray,
    img_b: np.ndarray,
    enable_clahe: bool = True,
    enable_shadow_norm: bool = True
) -> Tuple[np.ndarray, np.ndarray]:
    """
    Complete lunar preprocessing pipeline for a pair of images prior to frequency-domain matching.
    """
    gray_a = to_grayscale_uint8(img_a)
    gray_b = to_grayscale_uint8(img_b)

    if enable_clahe:
        gray_a = apply_lunar_clahe(gray_a)
        gray_b = apply_lunar_clahe(gray_b)

    if enable_shadow_norm:
        gray_a = shadow_tolerant_normalization(gray_a)
        gray_b = shadow_tolerant_normalization(gray_b)

    return gray_a, gray_b
