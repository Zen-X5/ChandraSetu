import os
import pytest
from app.geometry.camera_geometry import align_camera_geometry

SAMPLE_DATA_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "sample_data"))

def test_files_received_by_rashel_module():
    pair_dir = os.path.join(SAMPLE_DATA_DIR, "pair_1_optical_crater")
    img_a = os.path.join(pair_dir, "ch2_ohrc_boguslawsky.png")
    xml_a = os.path.join(pair_dir, "ch2_ohrc_boguslawsky.xml")
    img_b = os.path.join(pair_dir, "ch2_tmc_boguslawsky.png")
    xml_b = os.path.join(pair_dir, "ch2_tmc_boguslawsky.xml")

    result = align_camera_geometry(
        image_a_path=img_a,
        image_b_path=img_b,
        xml_a_path=xml_a,
        xml_b_path=xml_b
    )

    assert result.status == "SUCCESS"
    assert result.message == "Files received by Rashel's Camera Geometry module."
