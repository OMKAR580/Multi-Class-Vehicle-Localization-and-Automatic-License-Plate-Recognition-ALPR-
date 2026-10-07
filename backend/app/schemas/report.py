from typing import Optional, Dict, Any
from pydantic import BaseModel, ConfigDict

class ReportRequest(BaseModel):
    title: str
    report_type: str
    filter_params: Optional[Dict[str, Any]] = None

class ReportResponse(BaseModel):
    id: str
    title: str
    report_type: str
    download_url: Optional[str] = None
    created_at: str

    model_config = ConfigDict(from_attributes=True)
