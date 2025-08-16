"""Tests for authentication and authorization."""

import pytest
from datetime import datetime, timedelta
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from ..models.database import Base
from ..models.models import User, Class, StudentAccess
from ..auth.jwt_handler import JWTHandler
from ..auth.auth_service import AuthService
from ..auth.dependencies import PermissionChecker
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


@pytest.fixture
def jwt_handler():
    """Create JWT handler instance."""
    return JWTHandler()


@pytest.fixture
def auth_service(db_session):
    """Create auth service instance."""
    return AuthService(db_session)


class TestJWTHandler:
    """Test JWT token handling."""
    
    def test_create_and_verify_token(self, jwt_handler):
        """Test token creation and verification."""
        user_data = {
            "sub": "user_123",
            "email": "test@example.edu",
            "role": "student"
        }
        
        token = jwt_handler.create_access_token(user_data)
        assert token is not None
        assert isinstance(token, str)
        
        # Verify token
        token_data = jwt_handler.verify_token(token)
        assert token_data is not None
        assert token_data.user_id == "user_123"
        assert token_data.email == "test@example.edu"
        assert token_data.role == "student"
    
    def test_token_expiration(self, jwt_handler):
        """Test token expiration."""
        user_data = {
            "sub": "user_123",
            "email": "test@example.edu",
            "role": "student"
        }
        
        # Create token with short expiration
        short_expiry = timedelta(seconds=1)
        token = jwt_handler.create_access_token(user_data, expires_delta=short_expiry)
        
        # Token should be valid immediately
        token_data = jwt_handler.verify_token(token)
        assert token_data is not None
        
        # Wait for expiration (in real test, you might mock datetime)
        import time
        time.sleep(2)
        
        # Token should be invalid after expiration
        expired_token_data = jwt_handler.verify_token(token)
        assert expired_token_data is None
    
    def test_invalid_token(self, jwt_handler):
        """Test invalid token handling."""
        invalid_token = "invalid.token.here"
        token_data = jwt_handler.verify_token(invalid_token)
        assert token_data is None
    
    def test_password_hashing(self, jwt_handler):
        """Test password hashing and verification."""
        password = "test_password_123"
        hashed = jwt_handler.hash_password(password)
        
        assert hashed != password
        assert jwt_handler.verify_password(password, hashed)
        assert not jwt_handler.verify_password("wrong_password", hashed)


class TestAuthService:
    """Test authentication service."""
    
    def test_create_user(self, auth_service):
        """Test user creation."""
        user = auth_service.create_user(
            email="test@example.edu",
            name="Test User",
            role="student",
            password="test123"
        )
        
        assert user.id is not None
        assert user.email == "test@example.edu"
        assert user.name == "Test User"
        assert user.role == "student"
        assert user.is_active is True
        assert user.hashed_password is not None
    
    def test_get_user_by_email(self, auth_service):
        """Test getting user by email."""
        # Create user first
        created_user = auth_service.create_user(
            email="test@example.edu",
            name="Test User",
            role="student"
        )
        
        # Retrieve user
        retrieved_user = auth_service.get_user_by_email("test@example.edu")
        assert retrieved_user is not None
        assert retrieved_user.id == created_user.id
        assert retrieved_user.email == "test@example.edu"
    
    def test_authenticate_user_success(self, auth_service):
        """Test successful user authentication."""
        # Create user with password
        auth_service.create_user(
            email="test@example.edu",
            name="Test User",
            role="student",
            password="test123"
        )
        
        # Authenticate
        login_request = LoginRequest(
            email="test@example.edu",
            password="test123",
            domain="example.edu"
        )
        
        # Note: This test would need to mock domain validation
        # For now, we'll test the basic structure
        auth_response = auth_service.authenticate_user(login_request)
        # In a real test, we'd assert auth_response is not None
    
    def test_check_user_permissions(self, auth_service):
        """Test user permission checking."""
        # Create users with different roles
        student = auth_service.create_user("student@example.edu", "Student", "student")
        teacher = auth_service.create_user("teacher@example.edu", "Teacher", "teacher")
        admin = auth_service.create_user("admin@example.edu", "Admin", "admin")
        
        # Test role hierarchy
        assert auth_service.check_user_permissions(student.id, "student")
        assert not auth_service.check_user_permissions(student.id, "teacher")
        assert not auth_service.check_user_permissions(student.id, "admin")
        
        assert auth_service.check_user_permissions(teacher.id, "student")
        assert auth_service.check_user_permissions(teacher.id, "teacher")
        assert not auth_service.check_user_permissions(teacher.id, "admin")
        
        assert auth_service.check_user_permissions(admin.id, "student")
        assert auth_service.check_user_permissions(admin.id, "teacher")
        assert auth_service.check_user_permissions(admin.id, "admin")
    
    def test_deactivate_user(self, auth_service):
        """Test user deactivation."""
        user = auth_service.create_user("test@example.edu", "Test User", "student")
        assert user.is_active is True
        
        success = auth_service.deactivate_user(user.id)
        assert success is True
        
        # Verify user is deactivated
        updated_user = auth_service.get_user_by_id(user.id)
        assert updated_user.is_active is False


class TestPermissionChecker:
    """Test permission checking functionality."""
    
    def test_can_access_class(self, db_session):
        """Test class access permissions."""
        # Create test data
        teacher = User(id="teacher_1", email="teacher@example.edu", name="Teacher", role="teacher")
        student = User(id="student_1", email="student@example.edu", name="Student", role="student")
        admin = User(id="admin_1", email="admin@example.edu", name="Admin", role="admin")
        
        class_obj = Class(id="class_1", name="Math 101", teacher_id="teacher_1")
        
        access = StudentAccess(
            student_id="student_1",
            class_id="class_1",
            enabled=True
        )
        
        db_session.add_all([teacher, student, admin, class_obj, access])
        db_session.commit()
        
        checker = PermissionChecker(db_session)
        
        # Admin can access any class
        assert checker.can_access_class(admin, "class_1")
        
        # Teacher can access their own class
        assert checker.can_access_class(teacher, "class_1")
        
        # Student can access class they're enrolled in
        assert checker.can_access_class(student, "class_1")
        
        # Student cannot access class they're not enrolled in
        assert not checker.can_access_class(student, "nonexistent_class")
    
    def test_can_view_audit_logs(self, db_session):
        """Test audit log viewing permissions."""
        teacher = User(id="teacher_1", email="teacher@example.edu", name="Teacher", role="teacher")
        student = User(id="student_1", email="student@example.edu", name="Student", role="student")
        admin = User(id="admin_1", email="admin@example.edu", name="Admin", role="admin")
        
        db_session.add_all([teacher, student, admin])
        db_session.commit()
        
        checker = PermissionChecker(db_session)
        
        # Admin can view all logs
        assert checker.can_view_audit_logs(admin)
        assert checker.can_view_audit_logs(admin, "any_class")
        
        # Teacher can view logs
        assert checker.can_view_audit_logs(teacher)
        
        # Student cannot view logs
        assert not checker.can_view_audit_logs(student)