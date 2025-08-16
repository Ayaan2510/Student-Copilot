"""SQLAlchemy models for School Co-Pilot."""

from datetime import datetime
from typing import List, Optional
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    JSON,
    Table,
)
from sqlalchemy.orm import relationship, Mapped, mapped_column
from .database import Base


# Association table for many-to-many relationship between classes and documents
class_documents = Table(
    "class_documents",
    Base.metadata,
    Column("class_id", String, ForeignKey("classes.id"), primary_key=True),
    Column("document_id", String, ForeignKey("documents.id"), primary_key=True),
)


class User(Base):
    """User model for teachers, students, and admins."""
    
    __tablename__ = "users"
    
    id: Mapped[str] = mapped_column(String, primary_key=True)
    email: Mapped[str] = mapped_column(String, unique=True, index=True)
    name: Mapped[str] = mapped_column(String)
    role: Mapped[str] = mapped_column(String)  # 'teacher', 'student', 'admin'
    hashed_password: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    last_login: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    
    # Relationships
    taught_classes: Mapped[List["Class"]] = relationship(
        "Class", back_populates="teacher", cascade="all, delete-orphan"
    )
    student_access: Mapped[List["StudentAccess"]] = relationship(
        "StudentAccess", back_populates="student", cascade="all, delete-orphan"
    )
    audit_logs: Mapped[List["AuditLog"]] = relationship(
        "AuditLog", back_populates="student", cascade="all, delete-orphan"
    )


class Class(Base):
    """Class model for organizing students and documents."""
    
    __tablename__ = "classes"
    
    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String)
    teacher_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"))
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    daily_question_limit: Mapped[int] = mapped_column(Integer, default=50)
    blocked_terms: Mapped[List[str]] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    
    # Relationships
    teacher: Mapped["User"] = relationship("User", back_populates="taught_classes")
    documents: Mapped[List["Document"]] = relationship(
        "Document", secondary=class_documents, back_populates="assigned_classes"
    )
    student_access: Mapped[List["StudentAccess"]] = relationship(
        "StudentAccess", back_populates="class_", cascade="all, delete-orphan"
    )
    audit_logs: Mapped[List["AuditLog"]] = relationship(
        "AuditLog", back_populates="class_", cascade="all, delete-orphan"
    )


class Document(Base):
    """Document model for storing uploaded files and metadata."""
    
    __tablename__ = "documents"
    
    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String)
    file_path: Mapped[str] = mapped_column(String)
    file_type: Mapped[str] = mapped_column(String)  # 'pdf', 'docx', 'pptx', 'txt', 'gdrive'
    file_size: Mapped[int] = mapped_column(Integer)
    page_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    author: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    status: Mapped[str] = mapped_column(String, default="processing")  # 'processing', 'ready', 'error'
    upload_date: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    last_indexed: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    doc_metadata: Mapped[dict] = mapped_column(JSON, default=dict)
    
    # Relationships
    assigned_classes: Mapped[List["Class"]] = relationship(
        "Class", secondary=class_documents, back_populates="documents"
    )
    chunks: Mapped[List["DocumentChunk"]] = relationship(
        "DocumentChunk", back_populates="document", cascade="all, delete-orphan"
    )


class DocumentChunk(Base):
    """Document chunk model for RAG pipeline."""
    
    __tablename__ = "document_chunks"
    
    id: Mapped[str] = mapped_column(String, primary_key=True)
    document_id: Mapped[str] = mapped_column(String, ForeignKey("documents.id"))
    content: Mapped[str] = mapped_column(Text)
    page_number: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    section: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    token_count: Mapped[int] = mapped_column(Integer)
    chunk_index: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    
    # Relationships
    document: Mapped["Document"] = relationship("Document", back_populates="chunks")


class StudentAccess(Base):
    """Student access control model."""
    
    __tablename__ = "student_access"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    student_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"))
    class_id: Mapped[str] = mapped_column(String, ForeignKey("classes.id"))
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    daily_question_count: Mapped[int] = mapped_column(Integer, default=0)
    last_question_date: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    student: Mapped["User"] = relationship("User", back_populates="student_access")
    class_: Mapped["Class"] = relationship("Class", back_populates="student_access")


class AuditLog(Base):
    """Audit log model for tracking student activities."""
    
    __tablename__ = "audit_logs"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    student_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"))
    class_id: Mapped[str] = mapped_column(String, ForeignKey("classes.id"))
    query_text: Mapped[str] = mapped_column(Text)
    response_time_ms: Mapped[int] = mapped_column(Integer)
    success: Mapped[bool] = mapped_column(Boolean)
    citation_count: Mapped[int] = mapped_column(Integer, default=0)
    confidence_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    
    # Relationships
    student: Mapped["User"] = relationship("User", back_populates="audit_logs")
    class_: Mapped["Class"] = relationship("Class", back_populates="audit_logs")