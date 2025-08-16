"""Query and response schemas."""

from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field


class CitationResponse(BaseModel):
    """Citation response schema."""
    document_id: str
    document_name: str
    page_number: Optional[int] = None
    section: Optional[str] = None
    chunk_id: str
    relevance_score: float = Field(..., ge=0.0, le=1.0)
    content_preview: str = Field(..., max_length=200)


class DocumentReference(BaseModel):
    """Document reference schema."""
    id: str
    name: str
    type: str
    last_accessed: datetime


class QueryRequest(BaseModel):
    """Query request schema."""
    student_id: str
    class_id: str
    query: str = Field(..., min_length=1, max_length=1000)
    session_id: str
    quick_action: Optional[str] = Field(None, pattern="^(summarize|define|explain)$")
    
    class Config:
        # Validate assignment to prevent injection
        validate_assignment = True


class QueryResponse(BaseModel):
    """Query response schema."""
    answer: str
    citations: List[CitationResponse]
    used_documents: List[DocumentReference]
    confidence: float = Field(..., ge=0.0, le=1.0)
    processing_time: int  # milliseconds
    success: bool = True
    error: Optional[str] = None
    remaining_questions: Optional[int] = None
    
    class Config:
        from_attributes = True


class PermissionCheckResponse(BaseModel):
    """Permission check response schema."""
    has_access: bool
    reason: Optional[str] = None
    remaining_questions: Optional[int] = None
    class_enabled: bool
    student_enabled: bool
    daily_limit: int
    blocked_terms: List[str] = Field(default_factory=list)