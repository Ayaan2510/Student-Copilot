"""Audit log schemas."""

from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field


class LogFilters(BaseModel):
    """Audit log filter schema."""
    class_id: Optional[str] = None
    student_id: Optional[str] = None
    from_date: Optional[datetime] = None
    to_date: Optional[datetime] = None
    success_only: Optional[bool] = None
    limit: int = Field(default=50, ge=1, le=1000)
    offset: int = Field(default=0, ge=0)


class AuditLogResponse(BaseModel):
    """Audit log response schema."""
    id: int
    student_id: str
    student_name: str
    student_email: str
    class_id: str
    class_name: str
    query_text: str
    response_time_ms: int
    success: bool
    citation_count: int
    confidence_score: Optional[float] = None
    error_message: Optional[str] = None
    timestamp: datetime
    
    class Config:
        from_attributes = True


class LogExportRequest(BaseModel):
    """Log export request schema."""
    filters: LogFilters
    format: str = Field(default="csv", pattern="^(csv|json)$")
    include_query_text: bool = True
    include_error_details: bool = False


class LogSummaryResponse(BaseModel):
    """Log summary statistics schema."""
    total_queries: int
    successful_queries: int
    failed_queries: int
    unique_students: int
    average_response_time: float
    most_active_class: Optional[str] = None
    date_range: dict
    top_error_types: List[dict] = Field(default_factory=list)