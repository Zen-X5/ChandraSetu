"""
Metadata Parser for Chandrayaan-2 and Planetary PDS4 XML / JSON Metadata Labels.
Parses cartographic projection, georeferenced bounding coordinates, spatial resolution,
instrument identifiers, and acquisition timing across OHRC, TMC, and IIRS.
Supports standard NASA PDS4 schemas as well as official ISRO/ISSDC ISDA dictionaries.
"""

from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional, Dict, Any, List, Union, Tuple
import re
import xml.etree.ElementTree as ET

from app.schemas.geometry import SelenographicBounds


# Default Ground Sampling Distances (m/pixel) for Chandrayaan-2 instruments
DEFAULT_INSTRUMENT_GSD_MPP: Dict[str, float] = {
    "OHRC": 0.25,   # Orbiter High Resolution Camera (approx 0.24 - 0.32 m/px)
    "TMC": 5.0,     # Terrain Mapping Camera-2 (approx 5.0 m/px)
    "TMC-2": 5.0,
    "TMC2": 5.0,
    "IIRS": 80.0,   # Imaging Infra-Red Spectrometer (approx 80.0 m/px)
}


@dataclass
class ParsedMetadata:
    """Standardized metadata extracted from PDS4 XML or auxiliary label files."""
    bounds: SelenographicBounds
    instrument: str = "UNKNOWN"
    resolution_mpp: float = 5.0
    projection_name: str = "Equirectangular"
    standard_parallel: Optional[float] = None
    center_latitude: Optional[float] = None
    center_longitude: Optional[float] = None
    start_time_utc: Optional[str] = None
    stop_time_utc: Optional[str] = None
    sun_azimuth_deg: Optional[float] = None
    sun_elevation_deg: Optional[float] = None
    solar_incidence_deg: Optional[float] = None
    corner_coordinates: Optional[Dict[str, Tuple[float, float]]] = None
    raw_properties: Dict[str, Any] = field(default_factory=dict)


def _strip_namespace(tag: str) -> str:
    """Removes XML namespace prefix if present (e.g. '{http://...}element' -> 'element')."""
    return tag.split("}")[-1] if "}" in tag else tag


def _normalize_longitude(lon: float) -> float:
    """Normalizes longitude to the standard Selenographic range [-180.0, +180.0]."""
    lon = ((lon + 180.0) % 360.0) - 180.0
    return lon


def _normalize_latitude(lat: float) -> float:
    """Clamps latitude to valid planetary range [-90.0, +90.0]."""
    return max(-90.0, min(90.0, lat))


def parse_pds4_xml(xml_content_or_path: Union[str, Path]) -> Optional[ParsedMetadata]:
    """
    Parses a PDS4 XML label file or raw XML string.
    Extracts cartographic bounding boxes, spatial resolution, sensor properties,
    and ISSDC ISDA corner coordinates.
    """
    p = Path(str(xml_content_or_path))
    xml_str = ""

    if p.exists() and p.is_file():
        try:
            xml_str = p.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            xml_str = ""
    elif isinstance(xml_content_or_path, str) and ("<" in xml_content_or_path and ">" in xml_content_or_path):
        xml_str = xml_content_or_path

    if not xml_str:
        return None

    try:
        root = ET.fromstring(xml_str)
    except Exception:
        return _fallback_regex_parse(xml_str)

    extracted_dict: Dict[str, str] = {}
    bounding_coords: Dict[str, float] = {}
    all_lats: List[float] = []
    all_lons: List[float] = []

    corner_points: Dict[str, Tuple[float, float]] = {}
    corner_lats: Dict[str, float] = {}
    corner_lons: Dict[str, float] = {}

    instrument_id = "UNKNOWN"
    projection_name = "Equirectangular"
    resolution_mpp: Optional[float] = None
    start_time: Optional[str] = None
    stop_time: Optional[str] = None
    sun_az: Optional[float] = None
    sun_el: Optional[float] = None
    sun_inc: Optional[float] = None

    # Traverse XML tree
    for elem in root.iter():
        tag = _strip_namespace(elem.tag).lower()
        text = (elem.text or "").strip()

        if not text:
            continue

        extracted_dict[tag] = text

        # Instrument Identification
        upper_val = text.upper()
        if "OHRC" in upper_val or "HIGH RESOLUTION CAMERA" in upper_val or "ORBITER HIGH RESOLUTION CAMERA" in upper_val:
            instrument_id = "OHRC"
        elif "TMC" in upper_val or "TERRAIN MAPPING" in upper_val:
            instrument_id = "TMC"
        elif "IIRS" in upper_val or "INFRA-RED" in upper_val or "INFRARED" in upper_val:
            instrument_id = "IIRS"
        elif tag in ("instrument_id", "instrument_name", "instrument_short_name", "sensor_name") and instrument_id == "UNKNOWN":
            instrument_id = upper_val

        # Timestamps
        if tag in ("start_date_time", "start_time", "acquisition_start_time"):
            start_time = text
        if tag in ("stop_date_time", "stop_time", "acquisition_stop_time"):
            stop_time = text

        # Projection Name
        if tag in ("projection", "projection_name", "map_projection_name", "coordinate_system_name"):
            projection_name = text

        # Resolution / Scale
        if tag in ("pixel_resolution", "pixel_scale", "spatial_resolution", "map_scale", "sampling_resolution", "resolution"):
            try:
                m = re.search(r"[-+]?[0-9]*\.?[0-9]+(?:[eE][-+]?[0-9]+)?", text)
                if m:
                    val = float(m.group(0))
                    if "km" in text.lower() or val < 0.001:
                        val = val * 1000.0
                    if val > 0:
                        resolution_mpp = val
            except Exception:
                pass

        # Solar Angles
        if tag == "sun_azimuth":
            try:
                sun_az = float(text)
            except ValueError:
                pass
        elif tag == "sun_elevation":
            try:
                sun_el = float(text)
            except ValueError:
                pass
        elif tag == "solar_incidence":
            try:
                sun_inc = float(text)
            except ValueError:
                pass

        # ISRO ISSDC ISDA Corner Coordinates (e.g., upper_left_latitude, lower_right_longitude)
        try:
            val = float(text)
            if "upper_left_lat" in tag:
                corner_lats["upper_left"] = val
                all_lats.append(val)
            elif "upper_left_lon" in tag:
                corner_lons["upper_left"] = val
                all_lons.append(val)
            elif "upper_right_lat" in tag:
                corner_lats["upper_right"] = val
                all_lats.append(val)
            elif "upper_right_lon" in tag:
                corner_lons["upper_right"] = val
                all_lons.append(val)
            elif "lower_left_lat" in tag:
                corner_lats["lower_left"] = val
                all_lats.append(val)
            elif "lower_left_lon" in tag:
                corner_lons["lower_left"] = val
                all_lons.append(val)
            elif "lower_right_lat" in tag:
                corner_lats["lower_right"] = val
                all_lats.append(val)
            elif "lower_right_lon" in tag:
                corner_lons["lower_right"] = val
                all_lons.append(val)
            # Standard NASA PDS4 Cartographic Bounding Coordinates
            elif tag in ("west_bounding_coordinate", "minimum_longitude", "min_lon", "west_bounding_coord"):
                bounding_coords["min_lon"] = _normalize_longitude(val)
            elif tag in ("east_bounding_coordinate", "maximum_longitude", "max_lon", "east_bounding_coord"):
                bounding_coords["max_lon"] = _normalize_longitude(val)
            elif tag in ("south_bounding_coordinate", "minimum_latitude", "min_lat", "south_bounding_coord"):
                bounding_coords["min_lat"] = _normalize_latitude(val)
            elif tag in ("north_bounding_coordinate", "maximum_latitude", "max_lat", "north_bounding_coord"):
                bounding_coords["max_lat"] = _normalize_latitude(val)
        except ValueError:
            pass

    # Build corners dictionary if available
    for c_key in ("upper_left", "upper_right", "lower_left", "lower_right"):
        if c_key in corner_lats and c_key in corner_lons:
            corner_points[c_key] = (
                _normalize_latitude(corner_lats[c_key]),
                _normalize_longitude(corner_lons[c_key])
            )

    # Determine bounds from either bounding_coords or corner points
    if all(k in bounding_coords for k in ("min_lat", "max_lat", "min_lon", "max_lon")):
        min_lat = min(bounding_coords["min_lat"], bounding_coords["max_lat"])
        max_lat = max(bounding_coords["min_lat"], bounding_coords["max_lat"])
        min_lon = min(bounding_coords["min_lon"], bounding_coords["max_lon"])
        max_lon = max(bounding_coords["min_lon"], bounding_coords["max_lon"])
    elif len(all_lats) >= 3 and len(all_lons) >= 3:
        # Normalize latitudes and longitudes from corner coordinates
        norm_lats = [_normalize_latitude(x) for x in all_lats]
        norm_lons = [_normalize_longitude(x) for x in all_lons]
        min_lat = min(norm_lats)
        max_lat = max(norm_lats)
        min_lon = min(norm_lons)
        max_lon = max(norm_lons)
    else:
        fallback = _fallback_regex_parse(xml_str)
        if fallback:
            if instrument_id != "UNKNOWN" and fallback.instrument == "UNKNOWN":
                fallback.instrument = instrument_id
            if resolution_mpp is not None:
                fallback.resolution_mpp = resolution_mpp
            return fallback
        return None

    center_lat = (min_lat + max_lat) / 2.0
    center_lon = (min_lon + max_lon) / 2.0

    if resolution_mpp is None:
        resolution_mpp = DEFAULT_INSTRUMENT_GSD_MPP.get(instrument_id, 5.0)

    bounds = SelenographicBounds(
        min_lat=min_lat,
        max_lat=max_lat,
        min_lon=min_lon,
        max_lon=max_lon,
        center_lat=center_lat,
        center_lon=center_lon,
    )

    return ParsedMetadata(
        bounds=bounds,
        instrument=instrument_id,
        resolution_mpp=resolution_mpp,
        projection_name=projection_name,
        center_latitude=center_lat,
        center_longitude=center_lon,
        start_time_utc=start_time,
        stop_time_utc=stop_time,
        sun_azimuth_deg=sun_az,
        sun_elevation_deg=sun_el,
        solar_incidence_deg=sun_inc,
        corner_coordinates=corner_points if corner_points else None,
        raw_properties=extracted_dict,
    )


def _fallback_regex_parse(text: str) -> Optional[ParsedMetadata]:
    """Robust regex fallback for non-standard, truncated, or plain-text PDS labels."""
    def extract_float(patterns: List[str]) -> Optional[float]:
        for pat in patterns:
            m = re.search(rf"{pat}[^\d+-]{{0,30}}([+-]?\d+\.?\d*)", text, re.IGNORECASE)
            if m:
                try:
                    return float(m.group(1))
                except ValueError:
                    pass
        return None

    # Search for latitudes
    all_lats_found = [float(x) for x in re.findall(r"(?:upper_left_latitude|upper_right_latitude|lower_left_latitude|lower_right_latitude|latitude)[^\d+-]{0,30}([+-]?\d+\.?\d*)", text, re.IGNORECASE)]
    all_lons_found = [float(x) for x in re.findall(r"(?:upper_left_longitude|upper_right_longitude|lower_left_longitude|lower_right_longitude|longitude)[^\d+-]{0,30}([+-]?\d+\.?\d*)", text, re.IGNORECASE)]

    if len(all_lats_found) >= 2 and len(all_lons_found) >= 2:
        norm_lats = [_normalize_latitude(x) for x in all_lats_found]
        norm_lons = [_normalize_longitude(x) for x in all_lons_found]
        min_lat = min(norm_lats)
        max_lat = max(norm_lats)
        min_lon = min(norm_lons)
        max_lon = max(norm_lons)
    else:
        min_lat = extract_float(["south_bounding_coordinate", "minimum_latitude", "min_lat", "south_bounding", "south_lat"])
        max_lat = extract_float(["north_bounding_coordinate", "maximum_latitude", "max_lat", "north_bounding", "north_lat"])
        min_lon = extract_float(["west_bounding_coordinate", "minimum_longitude", "min_lon", "west_bounding", "west_lon"])
        max_lon = extract_float(["east_bounding_coordinate", "maximum_longitude", "max_lon", "east_bounding", "east_lon"])

    if None in (min_lat, max_lat, min_lon, max_lon):
        return None

    # Instrument detection
    instrument_id = "UNKNOWN"
    for inst in ("OHRC", "TMC-2", "TMC", "IIRS"):
        if inst in text.upper():
            instrument_id = inst.replace("-2", "")
            break

    # Resolution detection
    resolution_mpp = DEFAULT_INSTRUMENT_GSD_MPP.get(instrument_id, 5.0)
    res_val = extract_float(["pixel_resolution", "spatial_resolution", "pixel_scale", "map_scale", "sampling_resolution"])
    if res_val is not None and res_val > 0:
        resolution_mpp = res_val

    # Normalize
    n_min_lat = min(_normalize_latitude(min_lat), _normalize_latitude(max_lat))
    n_max_lat = max(_normalize_latitude(min_lat), _normalize_latitude(max_lat))
    n_min_lon = min(_normalize_longitude(min_lon), _normalize_longitude(max_lon))
    n_max_lon = max(_normalize_longitude(min_lon), _normalize_longitude(max_lon))

    bounds = SelenographicBounds(
        min_lat=n_min_lat,
        max_lat=n_max_lat,
        min_lon=n_min_lon,
        max_lon=n_max_lon,
        center_lat=(n_min_lat + n_max_lat) / 2.0,
        center_lon=(n_min_lon + n_max_lon) / 2.0,
    )

    return ParsedMetadata(
        bounds=bounds,
        instrument=instrument_id,
        resolution_mpp=resolution_mpp,
        projection_name="Equirectangular",
        center_latitude=bounds.center_lat,
        center_longitude=bounds.center_lon,
    )


def parse_metadata_or_bounds(
    xml_path: Optional[str] = None,
    manual_bounds: Optional[SelenographicBounds] = None,
    instrument_hint: Optional[str] = None,
    fallback_res_mpp: Optional[float] = None,
) -> Optional[ParsedMetadata]:
    """
    Unified resolver: combines XML label parsing with manual overrides and instrument hints.
    """
    if xml_path and Path(xml_path).exists():
        parsed = parse_pds4_xml(xml_path)
        if parsed:
            if manual_bounds:
                parsed.bounds = manual_bounds
            if instrument_hint and parsed.instrument == "UNKNOWN":
                parsed.instrument = instrument_hint
                parsed.resolution_mpp = DEFAULT_INSTRUMENT_GSD_MPP.get(instrument_hint, parsed.resolution_mpp)
            return parsed

    if manual_bounds:
        inst = instrument_hint or "UNKNOWN"
        res = fallback_res_mpp or DEFAULT_INSTRUMENT_GSD_MPP.get(inst, 5.0)
        c_lat = manual_bounds.center_lat or (manual_bounds.min_lat + manual_bounds.max_lat) / 2.0
        c_lon = manual_bounds.center_lon or (manual_bounds.min_lon + manual_bounds.max_lon) / 2.0
        bounds = SelenographicBounds(
            min_lat=_normalize_latitude(manual_bounds.min_lat),
            max_lat=_normalize_latitude(manual_bounds.max_lat),
            min_lon=_normalize_longitude(manual_bounds.min_lon),
            max_lon=_normalize_longitude(manual_bounds.max_lon),
            center_lat=c_lat,
            center_lon=c_lon,
        )
        return ParsedMetadata(
            bounds=bounds,
            instrument=inst,
            resolution_mpp=res,
            projection_name="Equirectangular",
            center_latitude=c_lat,
            center_longitude=c_lon,
        )

    return None
