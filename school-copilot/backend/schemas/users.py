"""User schemas."""

from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field


class UserCreate(BaseModel):
    """User creation schema."""
    email: str
    name: str = Field(..., min_length=1, max_length=255)
    role: str = Field(..., pattern="^(teacher|student|admin)$")
    password: Optional[str] = None  # For local auth, None for SSO


class UserUpdate(BaseModel):
    """User update schema."""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    is_active: Optional[bool] = None
    role: Optional[str] = Field(None, pattern="^(teacher|student|admin)$")


class UserResponse(BaseModel):
    """User response schema."""
    id: str
    email: str
    name: str
    role: str
    is_active: bool
    created_at: datetime
    last_login: Optional[datetime] = None
    class_count: int = 0  # Number of classes (taught for teachers, enrolled for students)
    
    class Config:
        from_attributes = True


class StudentInfo(BaseModel):
    """Student information schema."""
    id: str
    email: str
    name: str
    class_ids: List[str]
    enabled: bool
    daily_question_count: int
    last_activity: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class TeacherInfo(BaseModel):
    """Teacher information schema."""
    id: str
    email: str
    name: str
    role: str
    class_ids: List[str]
    total_students: int = 0
    total_documents: int = 0
    
    class Config:
        from_attributes = True