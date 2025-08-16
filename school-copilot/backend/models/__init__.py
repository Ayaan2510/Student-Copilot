"""Database models for School Co-Pilot backend."""

from .database import Base, engine, get_db
from .models import (
    User,
    Class,
    Document,
    class_documents,
    AuditLog,
    StudentAccess,
    DocumentChunk,
)

__all__ = [
    "Base",
    "engine", 
    "get_db",
    "User",
    "Class",
    "Document",
    "class_documents",
    "AuditLog",
    "StudentAccess",
    "DocumentChunk",
]