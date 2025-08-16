"""Tests for database models and validation."""

import pytest
from datetime import datetime
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from ..models.database import Base
from ..models.models import User, Class, Document, StudentAccess, AuditLog
from ..utils.validation import (
    ValidationUtils, validate_query_request, validate_document_create,
    validate_class_create, validate_login_request, validate_citation_data,
    validate_audit_log_data, ValidationError, raise_validation_error
)
from ..schemas.queries import QueryRequest
from ..schemas.documents import DocumentCreate
from ..schemas.classes import ClassCreate
from ..schemas.auth import LoginRequest


@pytest.fixture
def db_session():
    """Create test database session."""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


class TestModels:
    """Test database models."""
    
    def test_user_creation(self, db_session):
        """Test user model creation."""
        user = User(
            id="test_teacher_1",
            email="teacher@example.edu",
            name="Test Teacher",
            role="teacher",
            hashed_password="hashed_password"
        )
        db_session.add(user)
        db_session.commit()
        
        retrieved_user = db_session.query(User).filter(User.id == "test_teacher_1").first()
        assert retrieved_user is not None
        assert retrieved_user.email == "teacher@example.edu"
        assert retrieved_user.role == "teacher"
        assert retrieved_user.is_active is True
    
    def test_class_creation(self, db_session):
        """Test class model creation."""
        # Create teacher first
        teacher = User(
            id="teacher_1",
            email="teacher@example.edu",
            name="Test Teacher",
            role="teacher"
        )
        db_session.add(teacher)
        db_session.commit()
        
        # Create class
        class_obj = Class(
            id="class_1",
            name="Math 101",
            teacher_id="teacher_1",
            daily_question_limit=25,
            blocked_terms=["inappropriate", "banned"]
        )
        db_session.add(class_obj)
        db_session.commit()
        
        retrieved_class = db_session.query(Class).filter(Class.id == "class_1").first()
        assert retrieved_class is not None
        assert retrieved_class.name == "Math 101"
        assert retrieved_class.daily_question_limit == 25
        assert "inappropriate" in retrieved_class.blocked_terms
    
    def test_document_creation(self, db_session):
        """Test document model creation."""
        document = Document(
            id="doc_1",
            name="Algebra Textbook",
            file_path="/path/to/algebra.pdf",
            file_type="pdf",
            file_size=1024000,
            page_count=200,
            status="ready"
        )
        db_session.add(document)
        db_session.commit()
        
        retrieved_doc = db_session.query(Document).filter(Document.id == "doc_1").first()
        assert retrieved_doc is not None
        assert retrieved_doc.name == "Algebra Textbook"
        assert retrieved_doc.file_type == "pdf"
        assert retrieved_doc.status == "ready"
    
    def test_student_access_creation(self, db_session):
        """Test student access model creation."""
        # Create student and class
        student = User(id="student_1", email="student@example.edu", name="Test Student", role="student")
        teacher = User(id="teacher_1", email="teacher@example.edu", name="Test Teacher", role="teacher")
        class_obj = Class(id="class_1", name="Math 101", teacher_id="teacher_1")
        
        db_session.add_all([student, teacher, class_obj])
        db_session.commit()
        
        # Create access record
        access = StudentAccess(
            student_id="student_1",
            class_id="class_1",
            enabled=True,
            daily_question_count=5
        )
        db_session.add(access)
        db_session.commit()
        
        retrieved_access = db_session.query(StudentAccess).filter(
            StudentAccess.student_id == "student_1"
        ).first()
        assert retrieved_access is not None
        assert retrieved_access.enabled is True
        assert retrieved_access.daily_question_count == 5


class TestValidation:
    """Test validation utilities."""
    
    def test_email_domain_validation(self):
        """Test email domain validation."""
        allowed_domains = ["example.edu", "school.org"]
        
        assert ValidationUtils.validate_email_domain("student@example.edu", allowed_domains)
        assert ValidationUtils.validate_email_domain("teacher@school.org", allowed_domains)
        assert not ValidationUtils.validate_email_domain("user@gmail.com", allowed_domains)
        assert not ValidationUtils.validate_email_domain("invalid-email", allowed_domains)
    
    def test_student_id_validation(self):
        """Test student ID validation."""
        assert ValidationUtils.validate_student_id("student_123")
        assert ValidationUtils.validate_student_id("STU-456")
        assert ValidationUtils.validate_student_id("abc123def")
        assert not ValidationUtils.validate_student_id("ab")  # Too short
        assert not ValidationUtils.validate_student_id("student@123")  # Invalid character
        assert not ValidationUtils.validate_student_id("")  # Empty
    
    def test_query_sanitization(self):
        """Test query text sanitization."""
        dangerous_query = '<script>alert("xss")</script>What is algebra?'
        sanitized = ValidationUtils.sanitize_query_text(dangerous_query)
        assert "<script>" not in sanitized
        assert "What is algebra?" in sanitized
        
        long_query = "a" * 1500
        sanitized_long = ValidationUtils.sanitize_query_text(long_query)
        assert len(sanitized_long) <= 1000
    
    def test_blocked_terms_validation(self):
        """Test blocked terms validation."""
        blocked_terms = ["inappropriate", "banned", "forbidden"]
        
        assert ValidationUtils.validate_blocked_terms("What is math?", blocked_terms) is None
        assert ValidationUtils.validate_blocked_terms("This is inappropriate content", blocked_terms) == "inappropriate"
        assert ValidationUtils.validate_blocked_terms("BANNED word here", blocked_terms) == "banned"
    
    def test_file_validation(self):
        """Test file validation."""
        allowed_types = ["pdf", "docx", "txt"]
        
        assert ValidationUtils.validate_file_type("document.pdf", allowed_types)
        assert ValidationUtils.validate_file_type("Document.PDF", allowed_types)
        assert not ValidationUtils.validate_file_type("image.jpg", allowed_types)
        assert not ValidationUtils.validate_file_type("no_extension", allowed_types)
        
        # Test file size (50MB limit)
        assert ValidationUtils.validate_file_size(1024 * 1024)  # 1MB
        assert ValidationUtils.validate_file_size(50 * 1024 * 1024)  # 50MB
        assert not ValidationUtils.validate_file_size(100 * 1024 * 1024)  # 100MB
        assert not ValidationUtils.validate_file_size(0)  # Empty file
    
    def test_query_request_validation(self):
        """Test complete query request validation."""
        request = QueryRequest(
            student_id="student_123",
            class_id="class_456",
            query="What is algebra?",
            session_id="session_789"
        )
        
        result = validate_query_request(request, [])
        assert result["valid"] is True
        assert len(result["errors"]) == 0
        
        # Test with blocked terms
        result_blocked = validate_query_request(request, ["algebra"])
        assert result_blocked["valid"] is False
        assert "blocked term" in result_blocked["errors"][0].lower()
        
        # Test with invalid student ID
        request.student_id = "x"  # Too short
        result_invalid = validate_query_request(request, [])
        assert result_invalid["valid"] is False
        assert "Invalid student ID" in result_invalid["errors"][0]


class TestAdvancedValidation:
    """Test advanced validation functions."""
    
    def test_session_id_validation(self):
        """Test session ID validation."""
        assert ValidationUtils.validate_session_id("session_123456789")
        assert ValidationUtils.validate_session_id("abc-def-123-456")
        assert ValidationUtils.validate_session_id("SESSION_ID_123")
        assert not ValidationUtils.validate_session_id("short")  # Too short
        assert not ValidationUtils.validate_session_id("a" * 65)  # Too long
        assert not ValidationUtils.validate_session_id("session@123")  # Invalid character
    
    def test_document_name_validation(self):
        """Test document name validation."""
        assert ValidationUtils.validate_document_name("Math Textbook.pdf")
        assert ValidationUtils.validate_document_name("Chapter_1_Notes")
        assert ValidationUtils.validate_document_name("Science-Lab-Report")
        assert not ValidationUtils.validate_document_name("")  # Empty
        assert not ValidationUtils.validate_document_name("   ")  # Whitespace only
        assert not ValidationUtils.validate_document_name("file<script>")  # Dangerous chars
        assert not ValidationUtils.validate_document_name("a" * 256)  # Too long
    
    def test_class_name_validation(self):
        """Test class name validation."""
        assert ValidationUtils.validate_class_name("Math 101")
        assert ValidationUtils.validate_class_name("Advanced_Physics")
        assert ValidationUtils.validate_class_name("Chemistry-Lab")
        assert ValidationUtils.validate_class_name("AP Biology 2024")
        assert not ValidationUtils.validate_class_name("")  # Empty
        assert not ValidationUtils.validate_class_name("Class@Home")  # Invalid character
        assert not ValidationUtils.validate_class_name("a" * 256)  # Too long
    
    def test_daily_limit_validation(self):
        """Test daily question limit validation."""
        assert ValidationUtils.validate_daily_limit(1)
        assert ValidationUtils.validate_daily_limit(50)
        assert ValidationUtils.validate_daily_limit(1000)
        assert not ValidationUtils.validate_daily_limit(0)  # Too low
        assert not ValidationUtils.validate_daily_limit(1001)  # Too high
        assert not ValidationUtils.validate_daily_limit(-5)  # Negative
        assert not ValidationUtils.validate_daily_limit("50")  # Wrong type
    
    def test_blocked_terms_validation(self):
        """Test blocked terms list validation."""
        assert ValidationUtils.validate_blocked_terms_list([])
        assert ValidationUtils.validate_blocked_terms_list(["inappropriate", "banned"])
        assert ValidationUtils.validate_blocked_terms_list(["term1", "term2", "term3"])
        assert not ValidationUtils.validate_blocked_terms_list("not a list")
        assert not ValidationUtils.validate_blocked_terms_list([123, "term"])  # Mixed types
        assert not ValidationUtils.validate_blocked_terms_list([""])  # Empty term
        assert not ValidationUtils.validate_blocked_terms_list(["a" * 101])  # Term too long
        assert not ValidationUtils.validate_blocked_terms_list(["term"] * 101)  # Too many terms
    
    def test_confidence_score_validation(self):
        """Test confidence score validation."""
        assert ValidationUtils.validate_confidence_score(0.0)
        assert ValidationUtils.validate_confidence_score(0.5)
        assert ValidationUtils.validate_confidence_score(1.0)
        assert ValidationUtils.validate_confidence_score(0)  # Integer 0
        assert ValidationUtils.validate_confidence_score(1)  # Integer 1
        assert not ValidationUtils.validate_confidence_score(-0.1)  # Below range
        assert not ValidationUtils.validate_confidence_score(1.1)  # Above range
        assert not ValidationUtils.validate_confidence_score("0.5")  # Wrong type
    
    def test_response_time_validation(self):
        """Test response time validation."""
        assert ValidationUtils.validate_response_time(0)
        assert ValidationUtils.validate_response_time(1000)
        assert ValidationUtils.validate_response_time(300000)  # 5 minutes
        assert not ValidationUtils.validate_response_time(-1)  # Negative
        assert not ValidationUtils.validate_response_time(300001)  # Too high
        assert not ValidationUtils.validate_response_time(1000.5)  # Float
    
    def test_page_number_validation(self):
        """Test page number validation."""
        assert ValidationUtils.validate_page_number(None)  # None is valid
        assert ValidationUtils.validate_page_number(1)
        assert ValidationUtils.validate_page_number(100)
        assert not ValidationUtils.validate_page_number(0)  # Zero not valid
        assert not ValidationUtils.validate_page_number(-1)  # Negative not valid
        assert not ValidationUtils.validate_page_number("1")  # Wrong type
    
    def test_token_count_validation(self):
        """Test token count validation."""
        assert ValidationUtils.validate_token_count(1)
        assert ValidationUtils.validate_token_count(500)
        assert ValidationUtils.validate_token_count(10000)
        assert not ValidationUtils.validate_token_count(0)  # Zero not valid
        assert not ValidationUtils.validate_token_count(10001)  # Too high
        assert not ValidationUtils.validate_token_count(-1)  # Negative
    
    def test_chunk_index_validation(self):
        """Test chunk index validation."""
        assert ValidationUtils.validate_chunk_index(0)
        assert ValidationUtils.validate_chunk_index(1)
        assert ValidationUtils.validate_chunk_index(100)
        assert not ValidationUtils.validate_chunk_index(-1)  # Negative
        assert not ValidationUtils.validate_chunk_index(1.5)  # Float


class TestDocumentValidation:
    """Test document-related validation."""
    
    def test_valid_document_create(self):
        """Test valid document creation request."""
        request = DocumentCreate(
            name="Math Textbook",
            file_type="pdf",
            author="Dr. Smith",
            metadata={"subject": "mathematics", "grade": 10}
        )
        
        result = validate_document_create(request)
        assert result["valid"] is True
        assert len(result["errors"]) == 0
    
    def test_invalid_document_create(self):
        """Test invalid document creation request."""
        request = DocumentCreate(
            name="",  # Empty name
            file_type="exe",  # Invalid type
            author="a" * 256,  # Author too long
            metadata={"key": "value" * 1000}  # Metadata too large
        )
        
        result = validate_document_create(request)
        assert result["valid"] is False
        assert len(result["errors"]) > 0
        assert any("name" in error.lower() for error in result["errors"])
        assert any("file type" in error.lower() for error in result["errors"])


class TestClassValidation:
    """Test class-related validation."""
    
    def test_valid_class_create(self):
        """Test valid class creation request."""
        request = ClassCreate(
            name="AP Biology",
            daily_question_limit=25
        )
        
        result = validate_class_create(request)
        assert result["valid"] is True
        assert len(result["errors"]) == 0
    
    def test_invalid_class_create(self):
        """Test invalid class creation request."""
        request = ClassCreate(
            name="Class@Home!",  # Invalid characters
            daily_question_limit=2000  # Too high
        )
        
        result = validate_class_create(request)
        assert result["valid"] is False
        assert len(result["errors"]) > 0


class TestLoginValidation:
    """Test login-related validation."""
    
    def test_valid_login_request(self):
        """Test valid login request."""
        request = LoginRequest(
            email="teacher@example.edu",
            password="securepassword123",
            domain="example.edu"
        )
        
        result = validate_login_request(request)
        assert result["valid"] is True
        assert len(result["errors"]) == 0
    
    def test_invalid_login_request(self):
        """Test invalid login request."""
        request = LoginRequest(
            email="invalid-email",  # Invalid format
            password="short",  # Too short
            domain="example.edu"
        )
        
        result = validate_login_request(request)
        assert result["valid"] is False
        assert len(result["errors"]) > 0
        assert any("email" in error.lower() for error in result["errors"])
        assert any("password" in error.lower() for error in result["errors"])


class TestCitationValidation:
    """Test citation data validation."""
    
    def test_valid_citation_data(self):
        """Test valid citation data."""
        citation = {
            "document_id": "doc_123",
            "document_name": "Math Textbook",
            "chunk_id": "chunk_456",
            "relevance_score": 0.85,
            "page_number": 42,
            "section": "Chapter 3",
            "content_preview": "This is a preview of the content..."
        }
        
        result = validate_citation_data(citation)
        assert result["valid"] is True
        assert len(result["errors"]) == 0
    
    def test_invalid_citation_data(self):
        """Test invalid citation data."""
        citation = {
            "document_id": "x",  # Too short
            "document_name": "",  # Empty
            "relevance_score": 1.5,  # Out of range
            "page_number": -1,  # Invalid
            "content_preview": "a" * 1000  # Too long
        }
        
        result = validate_citation_data(citation)
        assert result["valid"] is False
        assert len(result["errors"]) > 0


class TestAuditLogValidation:
    """Test audit log validation."""
    
    def test_valid_audit_log_data(self):
        """Test valid audit log data."""
        log_data = {
            "student_id": "student_123",
            "class_id": "class_456",
            "query_text": "What is photosynthesis?",
            "response_time_ms": 1500,
            "success": True,
            "citation_count": 3,
            "confidence_score": 0.92
        }
        
        result = validate_audit_log_data(log_data)
        assert result["valid"] is True
        assert len(result["errors"]) == 0
    
    def test_invalid_audit_log_data(self):
        """Test invalid audit log data."""
        log_data = {
            "student_id": "x",  # Too short
            "class_id": "",  # Empty
            "query_text": "a" * 2001,  # Too long
            "response_time_ms": -100,  # Negative
            "success": "yes",  # Wrong type
            "citation_count": -1,  # Negative
            "confidence_score": 2.0  # Out of range
        }
        
        result = validate_audit_log_data(log_data)
        assert result["valid"] is False
        assert len(result["errors"]) > 0


class TestValidationError:
    """Test custom validation error class."""
    
    def test_validation_error_creation(self):
        """Test ValidationError creation and methods."""
        errors = ["Error 1", "Error 2"]
        warnings = ["Warning 1"]
        
        error = ValidationError("Test validation failed", errors, warnings)
        
        assert error.message == "Test validation failed"
        assert error.errors == errors
        assert error.warnings == warnings
        
        error_dict = error.to_dict()
        assert error_dict["message"] == "Test validation failed"
        assert error_dict["errors"] == errors
        assert error_dict["warnings"] == warnings
    
    def test_raise_validation_error(self):
        """Test raise_validation_error function."""
        validation_result = {
            "valid": False,
            "errors": ["Test error"],
            "warnings": ["Test warning"]
        }
        
        with pytest.raises(ValidationError) as exc_info:
            raise_validation_error(validation_result, "Test context")
        
        assert "Test context failed" in str(exc_info.value)
        assert exc_info.value.errors == ["Test error"]
        assert exc_info.value.warnings == ["Test warning"]
    
    def test_no_error_on_valid_result(self):
        """Test that no error is raised for valid results."""
        validation_result = {
            "valid": True,
            "errors": [],
            "warnings": []
        }
        
        # Should not raise an exception
        raise_validation_error(validation_result, "Test context")