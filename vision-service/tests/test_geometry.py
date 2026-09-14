import os
import tempfile
import numpy as np
import cv2
import pytest

from app.schemas.geometry import SelenographicBounds
from app.geometry.metadata_parser import parse_pds4_xml, parse_metadata_or_bounds
from app.geometry.projection import (
    EquirectangularProjection,
    LunarPolarStereographicProjection,
    compute_selenographic_overlap,
    compute_spherical_surface_area,
)
from app.geometry.coarse_align import perform_coarse_alignment
from app.geometry.camera_geometry import align_camera_geometry


# Sample PDS4 XML for Chandrayaan-2 OHRC observation over Boguslawsky Crater (Lunar South Pole)
SAMPLE_OHRC_PDS4_XML = """<?xml version="1.0" encoding="UTF-8"?>
<pds:Product_Observational xmlns:pds="http://pds.nasa.gov/pds4/pds/v1"
                          xmlns:cart="http://pds.nasa.gov/pds4/cart/v1"
                          xmlns:isro="http://isro.gov.in/pds4/isro/v1">
    <pds:Identification_Area>
        <pds:logical_identifier>urn:isro:ch2:ohrc:ch2_ohr_ncp_20200815t041012345_d_img_d18</pds:logical_identifier>
        <pds:title>Chandrayaan-2 OHRC Calibrated Lunar Observation</pds:title>
    </pds:Identification_Area>
    <pds:Observation_Area>
        <pds:Time_Coordinates>
            <pds:start_date_time>2020-08-15T04:10:12.345Z</pds:start_date_time>
            <pds:stop_date_time>2020-08-15T04:10:25.678Z</pds:stop_date_time>
        </pds:Time_Coordinates>
        <pds:Investigation_Area>
            <pds:name>Chandrayaan-2</pds:name>
        </pds:Investigation_Area>
        <pds:Observing_System>
            <pds:Observing_System_Component>
                <pds:name>Orbiter High Resolution Camera</pds:name>
                <pds:type>Instrument</pds:type>
                <isro:instrument_id>OHRC</isro:instrument_id>
            </pds:Observing_System_Component>
        </pds:Observing_System>
        <cart:Cartographic>
            <cart:Spatial_Domain>
                <cart:Bounding_Coordinates>
                    <cart:west_bounding_coordinate>73.50</cart:west_bounding_coordinate>
                    <cart:east_bounding_coordinate>74.20</cart:east_bounding_coordinate>
                    <cart:south_bounding_coordinate>-73.20</cart:south_bounding_coordinate>
                    <cart:north_bounding_coordinate>-72.80</cart:north_bounding_coordinate>
                </cart:Bounding_Coordinates>
            </cart:Spatial_Domain>
            <cart:Spatial_Resolution>
                <cart:pixel_scale unit="m/pixel">0.32</cart:pixel_scale>
            </cart:Spatial_Resolution>
            <cart:Map_Projection>
                <cart:projection_name>Lunar_South_Polar_Stereographic</cart:projection_name>
            </cart:Map_Projection>
        </cart:Cartographic>
    </pds:Observation_Area>
</pds:Product_Observational>
"""

# Sample PDS4 XML for Chandrayaan-2 TMC-2 observation covering Boguslawsky Crater
SAMPLE_TMC_PDS4_XML = """<?xml version="1.0" encoding="UTF-8"?>
<pds:Product_Observational xmlns:pds="http://pds.nasa.gov/pds4/pds/v1"
                          xmlns:cart="http://pds.nasa.gov/pds4/cart/v1">
    <pds:Observation_Area>
        <pds:Observing_System>
            <pds:Observing_System_Component>
                <pds:name>Terrain Mapping Camera-2</pds:name>
                <pds:instrument_id>TMC</pds:instrument_id>
            </pds:Observing_System_Component>
        </pds:Observing_System>
        <cart:Cartographic>
            <cart:Spatial_Domain>
                <cart:Bounding_Coordinates>
                    <cart:west_bounding_coordinate>73.00</cart:west_bounding_coordinate>
                    <cart:east_bounding_coordinate>75.00</cart:east_bounding_coordinate>
                    <cart:south_bounding_coordinate>-74.00</cart:south_bounding_coordinate>
                    <cart:north_bounding_coordinate>-72.00</cart:north_bounding_coordinate>
                </cart:Bounding_Coordinates>
            </cart:Spatial_Domain>
            <cart:Spatial_Resolution>
                <cart:pixel_scale unit="m/pixel">5.0</cart:pixel_scale>
            </cart:Spatial_Resolution>
        </cart:Cartographic>
    </pds:Observation_Area>
</pds:Product_Observational>
"""


def test_pds4_metadata_parsing():
    """Test standard PDS4 XML ingestion for OHRC and TMC labels."""
    meta_ohrc = parse_pds4_xml(SAMPLE_OHRC_PDS4_XML)
    assert meta_ohrc is not None
    assert meta_ohrc.instrument == "OHRC"
    assert pytest.approx(meta_ohrc.bounds.min_lat, rel=1e-3) == -73.20
    assert pytest.approx(meta_ohrc.bounds.max_lat, rel=1e-3) == -72.80
    assert pytest.approx(meta_ohrc.bounds.min_lon, rel=1e-3) == 73.50
    assert pytest.approx(meta_ohrc.bounds.max_lon, rel=1e-3) == 74.20
    assert pytest.approx(meta_ohrc.resolution_mpp, rel=1e-2) == 0.32

    meta_tmc = parse_pds4_xml(SAMPLE_TMC_PDS4_XML)
    assert meta_tmc is not None
    assert meta_tmc.instrument == "TMC"
    assert pytest.approx(meta_tmc.resolution_mpp, rel=1e-2) == 5.0


def test_equirectangular_projection_roundtrip():
    """Test forward and inverse conversions for Equirectangular projection."""
    proj = EquirectangularProjection(standard_parallel_deg=0.0, center_lon_deg=0.0)
    lat_orig, lon_orig = 12.3456, 45.6789
    x, y = proj.forward(lat_orig, lon_orig)
    lat_rec, lon_rec = proj.inverse(x, y)
    assert pytest.approx(lat_rec, abs=1e-5) == lat_orig
    assert pytest.approx(lon_rec, abs=1e-5) == lon_orig


def test_lunar_polar_stereographic_roundtrip():
    """Test forward and inverse conversions for Lunar South Polar Stereographic projection."""
    proj = LunarPolarStereographicProjection(pole_lat_deg=-90.0, standard_parallel_deg=-70.0, center_lon_deg=0.0)
    lat_orig, lon_orig = -75.4321, 62.1234
    x, y = proj.forward(lat_orig, lon_orig)
    lat_rec, lon_rec = proj.inverse(x, y)
    assert pytest.approx(lat_rec, abs=1e-4) == lat_orig
    assert pytest.approx(lon_rec, abs=1e-4) == lon_orig


def test_selenographic_overlap_computation():
    """Test overlap area and IoU ratio for overlapping and disjoint regions."""
    box_a = SelenographicBounds(min_lat=-73.2, max_lat=-72.8, min_lon=73.5, max_lon=74.2)
    box_b = SelenographicBounds(min_lat=-74.0, max_lat=-72.0, min_lon=73.0, max_lon=75.0)

    overlap, ratio = compute_selenographic_overlap(box_a, box_b)
    assert overlap is not None
    assert overlap.min_lat == -73.2
    assert overlap.max_lat == -72.8
    assert overlap.min_lon == 73.5
    assert overlap.max_lon == 74.2
    assert ratio > 0.99  # Box A is entirely contained in Box B

    # Disjoint test
    box_disjoint = SelenographicBounds(min_lat=10.0, max_lat=12.0, min_lon=0.0, max_lon=2.0)
    overlap_none, ratio_none = compute_selenographic_overlap(box_a, box_disjoint)
    assert overlap_none is None
    assert ratio_none == 0.0


def test_camera_geometry_end_to_end_with_synthetic_images():
    """Test align_camera_geometry facade with synthetic image files and XML metadata."""
    with tempfile.TemporaryDirectory() as tmp_dir:
        img_a_path = os.path.join(tmp_dir, "test_ohrc.png")
        img_b_path = os.path.join(tmp_dir, "test_tmc.png")
        xml_a_path = os.path.join(tmp_dir, "test_ohrc.xml")
        xml_b_path = os.path.join(tmp_dir, "test_tmc.xml")

        # Create dummy synthetic raster images
        cv2.imwrite(img_a_path, np.full((512, 512, 3), 128, dtype=np.uint8))
        cv2.imwrite(img_b_path, np.full((256, 256, 3), 160, dtype=np.uint8))

        with open(xml_a_path, "w", encoding="utf-8") as f:
            f.write(SAMPLE_OHRC_PDS4_XML)
        with open(xml_b_path, "w", encoding="utf-8") as f:
            f.write(SAMPLE_TMC_PDS4_XML)

        result = align_camera_geometry(
            image_a_path=img_a_path,
            image_b_path=img_b_path,
            xml_a_path=xml_a_path,
            xml_b_path=xml_b_path,
        )

        assert result.status == "SUCCESS"
        assert result.overlap_bounds is not None
        assert result.overlap_ratio > 0.0
        assert result.coarse_affine_matrix is not None
        assert len(result.coarse_affine_matrix) == 3
        assert "details" in result.model_dump()


def test_camera_geometry_insufficient_geodata():
    """Test response when no XML or manual bounds are provided."""
    with tempfile.TemporaryDirectory() as tmp_dir:
        img_a_path = os.path.join(tmp_dir, "img_a.png")
        img_b_path = os.path.join(tmp_dir, "img_b.png")
        cv2.imwrite(img_a_path, np.zeros((100, 100, 3), dtype=np.uint8))
        cv2.imwrite(img_b_path, np.zeros((100, 100, 3), dtype=np.uint8))

        result = align_camera_geometry(
            image_a_path=img_a_path,
            image_b_path=img_b_path,
            xml_a_path=None,
            xml_b_path=None,
        )

        assert result.status == "INSUFFICIENT_GEODATA"


def test_isro_issdc_isda_metadata_parsing():
    """Test official ISRO ISSDC ISDA PDS4 label with Geometry_Parameters and corner coordinates."""
    isro_xml = """<?xml version="1.0" encoding="UTF-8"?>
    <Product_Observational xmlns="http://pds.nasa.gov/pds4/pds/v1" xmlns:isda="https://isda.issdc.gov.in/pds4/isda/v1">
        <Observation_Area>
            <Observing_System>
                <Observing_System_Component>
                    <name>orbiter high resolution camera</name>
                </Observing_System_Component>
            </Observing_System>
            <Mission_Area>
                <isda:Product_Parameters>
                    <isda:pixel_resolution unit="m/pixel">0.24</isda:pixel_resolution>
                    <isda:projection>Polar stereographic</isda:projection>
                    <isda:sun_azimuth unit="deg">180.299967</isda:sun_azimuth>
                    <isda:sun_elevation unit="deg">-0.169616</isda:sun_elevation>
                    <isda:solar_incidence unit="deg">90.169616</isda:solar_incidence>
                </isda:Product_Parameters>
                <isda:Geometry_Parameters>
                    <isda:Refined_Corner_Coordinates>
                        <isda:upper_left_latitude unit="deg">-89.199860</isda:upper_left_latitude>
                        <isda:upper_left_longitude unit="deg">222.259328</isda:upper_left_longitude>
                        <isda:upper_right_latitude unit="deg">-89.209060</isda:upper_right_latitude>
                        <isda:upper_right_longitude unit="deg">229.728973</isda:upper_right_longitude>
                        <isda:lower_left_latitude unit="deg">-89.908842</isda:lower_left_latitude>
                        <isda:lower_left_longitude unit="deg">110.268353</isda:lower_left_longitude>
                        <isda:lower_right_latitude unit="deg">-89.946885</isda:lower_right_latitude>
                        <isda:lower_right_longitude unit="deg">22.453651</isda:lower_right_longitude>
                    </isda:Refined_Corner_Coordinates>
                </isda:Geometry_Parameters>
            </Mission_Area>
        </Observation_Area>
    </Product_Observational>
    """
    meta = parse_pds4_xml(isro_xml)
    assert meta is not None
    assert meta.instrument == "OHRC"
    assert pytest.approx(meta.resolution_mpp, rel=1e-2) == 0.24
    assert meta.projection_name == "Polar stereographic"
    assert meta.bounds.min_lat < -89.0
    assert meta.sun_azimuth_deg == 180.299967
    assert meta.corner_coordinates is not None
    assert "upper_left" in meta.corner_coordinates

