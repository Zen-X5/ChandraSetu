"""
Planetary Cartography and Coordinate Reference System (CRS) Engine for Lunar Geodesy.
Implements IAU/IAG 2015 Selenographic coordinate models with Equirectangular and
Lunar Polar Stereographic map projections.
"""

from typing import Tuple, Optional, Dict, Any, List
import math

from app.schemas.geometry import SelenographicBounds


# Mean Volumetric Radius of the Moon (IAU/IAG 2015 Lunar Geodetic Standard)
LUNAR_RADIUS_METERS: float = 1737400.0


class LunarProjection:
    """
    Abstract Base Representation of a Lunar Map Projection.
    Provides forward (lat, lon) -> (x_m, y_m) and inverse (x_m, y_m) -> (lat, lon) mappings.
    """
    def __init__(self, name: str, center_lat: float, center_lon: float):
        self.name = name
        self.center_lat = center_lat
        self.center_lon = center_lon

    def forward(self, lat_deg: float, lon_deg: float) -> Tuple[float, float]:
        """Convert Selenographic (lat, lon) degrees to planar coordinates (x_m, y_m) in meters."""
        raise NotImplementedError

    def inverse(self, x_m: float, y_m: float) -> Tuple[float, float]:
        """Convert planar coordinates (x_m, y_m) in meters to Selenographic (lat, lon) degrees."""
        raise NotImplementedError


class EquirectangularProjection(LunarProjection):
    """
    Equirectangular (Simple Cylindrical) Projection with True Scale along a Standard Parallel.
    Ideal for Equatorial and Mid-Latitude Lunar Observations (|lat| <= 65°).
    """
    def __init__(self, standard_parallel_deg: float = 0.0, center_lon_deg: float = 0.0):
        super().__init__("Equirectangular", center_lat=standard_parallel_deg, center_lon=center_lon_deg)
        self.standard_parallel_rad = math.radians(standard_parallel_deg)
        self.cos_std_parallel = math.cos(self.standard_parallel_rad)
        # Prevent division by zero near poles
        if abs(self.cos_std_parallel) < 1e-6:
            self.cos_std_parallel = 1e-6

    def forward(self, lat_deg: float, lon_deg: float) -> Tuple[float, float]:
        d_lat_rad = math.radians(lat_deg)
        # Normalize delta lon to [-180, 180]
        d_lon_deg = ((lon_deg - self.center_lon + 180.0) % 360.0) - 180.0
        d_lon_rad = math.radians(d_lon_deg)

        x_m = LUNAR_RADIUS_METERS * d_lon_rad * self.cos_std_parallel
        y_m = LUNAR_RADIUS_METERS * d_lat_rad
        return x_m, y_m

    def inverse(self, x_m: float, y_m: float) -> Tuple[float, float]:
        lat_rad = y_m / LUNAR_RADIUS_METERS
        lat_deg = math.degrees(lat_rad)
        lat_deg = max(-90.0, min(90.0, lat_deg))

        d_lon_rad = x_m / (LUNAR_RADIUS_METERS * self.cos_std_parallel)
        lon_deg = self.center_lon + math.degrees(d_lon_rad)
        lon_deg = ((lon_deg + 180.0) % 360.0) - 180.0
        return lat_deg, lon_deg


class LunarPolarStereographicProjection(LunarProjection):
    """
    Conformal Polar Stereographic Projection for Lunar Polar Regions (|lat| > 65°).
    Preserves angles and crater shapes near the South Pole (e.g. Boguslawsky, Manzinus, Shackleton).
    """
    def __init__(self, pole_lat_deg: float = -90.0, standard_parallel_deg: float = -70.0, center_lon_deg: float = 0.0):
        name = "Lunar_South_Polar_Stereographic" if pole_lat_deg < 0 else "Lunar_North_Polar_Stereographic"
        super().__init__(name, center_lat=pole_lat_deg, center_lon=center_lon_deg)
        self.is_south_pole = pole_lat_deg < 0
        self.std_parallel_rad = math.radians(standard_parallel_deg)
        
        # Scale factor at pole based on standard parallel
        std_lat_abs = abs(self.std_parallel_rad)
        self.k0 = (1.0 + math.sin(std_lat_abs)) / 2.0 if std_lat_abs < math.pi / 2 else 1.0

    def forward(self, lat_deg: float, lon_deg: float) -> Tuple[float, float]:
        lat_deg_clamped = max(-89.9999, min(89.9999, lat_deg))
        lat_rad = math.radians(lat_deg_clamped)
        d_lon_deg = ((lon_deg - self.center_lon + 180.0) % 360.0) - 180.0
        d_lon_rad = math.radians(d_lon_deg)

        if self.is_south_pole:
            # South Polar Stereographic: pole is at lat = -90°
            t = math.tan(math.pi / 4.0 + lat_rad / 2.0)
            rho = 2.0 * LUNAR_RADIUS_METERS * self.k0 * t
            x_m = rho * math.sin(d_lon_rad)
            y_m = rho * math.cos(d_lon_rad)
        else:
            # North Polar Stereographic: pole is at lat = +90°
            t = math.tan(math.pi / 4.0 - lat_rad / 2.0)
            rho = 2.0 * LUNAR_RADIUS_METERS * self.k0 * t
            x_m = rho * math.sin(d_lon_rad)
            y_m = -rho * math.cos(d_lon_rad)

        return x_m, y_m

    def inverse(self, x_m: float, y_m: float) -> Tuple[float, float]:
        rho = math.hypot(x_m, y_m)
        if rho < 1e-7:
            return (-90.0 if self.is_south_pole else 90.0), self.center_lon

        if self.is_south_pole:
            d_lon_rad = math.atan2(x_m, y_m)
            c = 2.0 * math.atan(rho / (2.0 * LUNAR_RADIUS_METERS * self.k0))
            lat_rad = c - (math.pi / 2.0)
        else:
            d_lon_rad = math.atan2(x_m, -y_m)
            c = 2.0 * math.atan(rho / (2.0 * LUNAR_RADIUS_METERS * self.k0))
            lat_rad = (math.pi / 2.0) - c

        lat_deg = math.degrees(lat_rad)
        lon_deg = self.center_lon + math.degrees(d_lon_rad)
        lon_deg = ((lon_deg + 180.0) % 360.0) - 180.0
        return lat_deg, lon_deg


def select_optimal_projection(center_lat: float, center_lon: float) -> LunarProjection:
    """
    Chooses the optimal lunar cartographic projection:
    - Polar Stereographic for polar scenes (|center_lat| > 65.0°)
    - Equirectangular with scene-centered standard parallel for equatorial / mid-latitude scenes.
    """
    if center_lat <= -65.0:
        return LunarPolarStereographicProjection(pole_lat_deg=-90.0, standard_parallel_deg=center_lat, center_lon_deg=center_lon)
    elif center_lat >= 65.0:
        return LunarPolarStereographicProjection(pole_lat_deg=90.0, standard_parallel_deg=center_lat, center_lon_deg=center_lon)
    else:
        return EquirectangularProjection(standard_parallel_deg=center_lat, center_lon_deg=center_lon)


def compute_spherical_surface_area(bounds: SelenographicBounds) -> float:
    """
    Computes rigorous surface area on the lunar sphere in square meters:
    Area = R^2 * |sin(phi_2) - sin(phi_1)| * |lambda_2 - lambda_1| (in radians).
    """
    phi1 = math.radians(bounds.min_lat)
    phi2 = math.radians(bounds.max_lat)
    
    d_lon = (bounds.max_lon - bounds.min_lon + 360.0) % 360.0
    if d_lon > 180.0:
        d_lon = bounds.max_lon - bounds.min_lon
    d_lon_rad = math.radians(abs(d_lon))

    area_sq_m = (LUNAR_RADIUS_METERS ** 2) * abs(math.sin(phi2) - math.sin(phi1)) * d_lon_rad
    return max(1.0, area_sq_m)


def compute_selenographic_overlap(
    bounds_a: SelenographicBounds,
    bounds_b: SelenographicBounds
) -> Tuple[Optional[SelenographicBounds], float]:
    """
    Calculates geographic intersection between two Selenographic bounding boxes and computes the IoU overlap ratio.
    Returns:
        (overlap_bounds, overlap_ratio) where overlap_ratio is in [0.0, 1.0].
    """
    overlap_min_lat = max(bounds_a.min_lat, bounds_b.min_lat)
    overlap_max_lat = min(bounds_a.max_lat, bounds_b.max_lat)
    overlap_min_lon = max(bounds_a.min_lon, bounds_b.min_lon)
    overlap_max_lon = min(bounds_a.max_lon, bounds_b.max_lon)

    if overlap_min_lat >= overlap_max_lat or overlap_min_lon >= overlap_max_lon:
        return None, 0.0

    overlap_bounds = SelenographicBounds(
        min_lat=overlap_min_lat,
        max_lat=overlap_max_lat,
        min_lon=overlap_min_lon,
        max_lon=overlap_max_lon,
        center_lat=(overlap_min_lat + overlap_max_lat) / 2.0,
        center_lon=(overlap_min_lon + overlap_max_lon) / 2.0,
    )

    area_a = compute_spherical_surface_area(bounds_a)
    area_b = compute_spherical_surface_area(bounds_b)
    area_overlap = compute_spherical_surface_area(overlap_bounds)

    # IoU / Min-Area overlap ratio
    min_area = min(area_a, area_b)
    overlap_ratio = float(min(1.0, max(0.0, area_overlap / min_area)))

    return overlap_bounds, overlap_ratio
