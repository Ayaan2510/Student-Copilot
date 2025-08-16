"""Class and access control schemas."""

from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field


class ClassCreate(BaseModel):
    """Class creation schema."""
    name: str = Field(..., min_length=1, max_length=255)
    daily_question_limit: int = Field(default=50, ge=1, le=1000)
    blocked_terms: List[str] = Field(default_factory=list)


class ClassUpdate(BaseModel):
    """Class update schema."""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    enabled: Optional[bool] = None
    daily_question_limit: Optional[int] = Field(None, ge=1, le=1000)
    blocked_terms: Optional[List[str]] = None


class ClassResponse(BaseModel):
    """Class response schema."""
    id: str
    name: str
    teacher_id: str
    enabled: bool
    daily_question_limit: int
    blocked_terms: List[str]
    created_at: datetime
    student_count: int = 0
    document_count: int = 0
    
    class Config:
        from_attributes = True


class AccessRequest(BaseModel):
    """Access control request schema."""
    class_id: str
    student_id: Optional[str] = None
    enabled: bool
    action: str = Field(..., pattern="^(enable_class|disable_class|enable_student|disable_student)$")


class StudentAccessResponse(BaseModel):
    """Student access response schema."""
    student_id: str
    student_name: str
    student_email: str
    class_id: str
    enabled: bool
    daily_question_count: int
    last_question_date: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class StudentRosterImport(BaseModel):
    """Student roster import schema."""
    class_id: str
    students: List[dict] = Field(..., description="List of student data from CSV")
    overwrite_existing: bool = False