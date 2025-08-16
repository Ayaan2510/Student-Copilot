"""Document schemas."""

from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class DocumentChunkResponse(BaseModel):
    """Document chunk response schema."""
    id: str
    content: str
    page_number: Optional[int] = None
    section: Optional[str] = None
    token_count: int
    chunk_index: int
    
    class Config:
        from_attributes = True


class DocumentCreate(BaseModel):
    """Document creation schema."""
    name: str = Field(..., min_length=1, max_length=255)
    file_type: str = Field(..., pattern="^(pdf|docx|pptx|txt|gdrive)$")
    author: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)


class DocumentUpdate(BaseModel):
    """Document update schema."""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    author: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class DocumentResponse(BaseModel):
    """Document response schema."""
    id: str
    name: str
    file_path: str
    file_type: str
    file_size: int
    page_count: Optional[int] = None
    author: Optional[str] = None
    status: str
    upload_date: datetime
    last_indexed: Optional[datetime] = None
    metadata: Dict[str, Any]
    assigned_classes: List[str] = Field(default_factory=list)
    chunk_count: int = 0
    
    class Config:
        from_attributes = True


class UploadResponse(BaseModel):
    """File upload response schema."""
    document_id: str
    status: str = Field(..., pattern="^(uploaded|processing|error)$")
    message: Optional[str] = None
    file_size: int
    estimated_processing_time: Optional[int] = None  # seconds


class DocumentAssignRequest(BaseModel):
    """Document assignment request schema."""
    document_id: str
    class_ids: List[str]
    action: str = Field(..., pattern="^(assign|unassign)$")


class ReindexRequest(BaseModel):
    """Document reindexing request schema."""
    document_ids: Optional[List[str]] = None  # If None, reindex all
    force: bool = False