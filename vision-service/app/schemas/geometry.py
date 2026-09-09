from typing import Optional, List, Dict, Any, Literal
from pydantic import BaseModel, Field

class SelenographicBounds(BaseModel):
    min_lat: float = Field(..., description="South bounding latitude (-90 to +90)")
    max_lat: float = Field(..., description="North bounding latitude (-90 to +90)")
    min_lon: float = Field(..., description="West bounding longitude (-180 to +180)")
    max_lon: float = Field(..., description="East bounding longitude (-180 to +180)")
    center_lat: Optional[float] = None
    center_lon: Optional[float] = None

class ImageMetadataInput(BaseModel):
    image_id: Optional[str] = "img_source"
    instrument: Optional[str] = "OHRC" # OHRC, TMC, IIRS
    image_path: str = Field(..., description="Absolute path to the raw/browse image file on disk")
    xml_label_path: Optional[str] = Field(None, description="Absolute path to the companion PDS4 XML label")
    manual_bounds: Optional[SelenographicBounds] = None

class CoarseAlignmentRequest(BaseModel):
    image_a: ImageMetadataInput
    image_b: ImageMetadataInput

class CoarseAlignmentResponse(BaseModel):
    status: Literal["SUCCESS", "INSUFFICIENT_GEODATA", "NO_OVERLAP", "ERROR"]
    message: str
    image_a_bounds: Optional[SelenographicBounds] = None
    image_b_bounds: Optional[SelenographicBounds] = None
    overlap_bounds: Optional[SelenographicBounds] = None
    overlap_ratio: float = Field(0.0, description="Estimated overlapping area fraction (0.0 to 1.0)")
    coarse_affine_matrix: Optional[List[List[float]]] = Field(None, description="2x3 or 3x3 coarse alignment matrix")
    details: Optional[Dict[str, Any]] = None
