"""Pydantic schemas for API request/response validation."""

from .auth import LoginRequest, AuthResponse, TokenData
from .documents import (
    DocumentCreate,
    DocumentResponse,
    DocumentUpdate,
    UploadResponse,
    DocumentChunkResponse,
)
from .classes import (
    ClassCreate,
    ClassResponse,
    ClassUpdate,
    AccessRequest,
    StudentAccessResponse,
)
from .queries import QueryRequest, QueryResponse, CitationResponse
from .logs import AuditLogResponse, LogFilters
from .users import UserCreate, UserResponse, UserUpdate

__all__ = [
    # Auth
    "LoginRequest",
    "AuthResponse", 
    "TokenData",
    # Documents
    "DocumentCreate",
    "DocumentResponse",
    "DocumentUpdate",
    "UploadResponse",
    "DocumentChunkResponse",
    # Classes
    "ClassCreate",
    "ClassResponse",
    "ClassUpdate",
    "AccessRequest",
    "StudentAccessResponse",
    # Queries
    "QueryRequest",
    "QueryResponse",
    "CitationResponse",
    # Logs
    "AuditLogResponse",
    "LogFilters",
    # Users
    "UserCreate",
    "UserResponse",
    "UserUpdate",
]