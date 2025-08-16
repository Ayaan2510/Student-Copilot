"""Tests for API endpoints."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from ..main import app
from ..models.database import Base, get_db
from ..models.models import User, Class, Document, StudentAccess
from ..auth.auth_service import AuthService


# Test database setup
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
def client(db_session):
    """Create test client with database override."""
    def override_get_db():
        try:
            yield db_session
        finally:
            pass
    
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def auth_headers(db_session):
    """Create authentication headers for testing."""
    # Create test user
    auth_service = AuthService(db_session)
    teacher = auth_service.create_user(
        email="teacher@example.edu",
        name="Test Teacher",
        role="teacher",
        password="test123"
    )
    
    # Create JWT token
    from ..auth.jwt_handler import jwt_handler
    token = jwt_handler.create_user_token(teacher)
    
    return {"Authorization": f"Bearer {token}"}


class TestHealthEndpoints:
    """Test health and basic endpoints."""
    
    def test_health_check(self, client):
        """Test health check endpoint."""
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "timestamp" in data
    
    def test_root_endpoint(self, client):
        """Test root endpoint."""
        response = client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "version" in data


class TestAuthEndpoints:
    """Test authentication endpoints."""
    
    def test_login_invalid_credentials(self, client):
        """Test login with invalid credentials."""
        response = client.post("/api/auth/login", json={
            "email": "nonexistent@example.edu",
            "password": "wrong",
            "domain": "example.edu"
        })
        assert response.status_code == 401
    
    def test_get_current_user_without_token(self, client):
        """Test getting current user without token."""
        response = client.get("/api/auth/me")
        assert response.status_code == 401
    
    def test_get_current_user_with_token(self, client, auth_headers):
        """Test getting current user with valid token."""
        response = client.get("/api/auth/me", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "email" in data
        assert "role" in data


class TestClassEndpoints:
    """Test class management endpoints."""
    
    def test_create_class(self, client, auth_headers):
        """Test creating a new class."""
        response = client.post("/api/classes/", headers=auth_headers, json={
            "name": "Test Class",
            "daily_question_limit": 30,
            "blocked_terms": ["inappropriate"]
        })
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Test Class"
        assert data["daily_question_limit"] == 30
    
    def test_list_classes(self, client, auth_headers):
        """Test listing classes."""
        response = client.get("/api/classes/", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_create_class_without_auth(self, client):
        """Test creating class without authentication."""
        response = client.post("/api/classes/", json={
            "name": "Test Class",
            "daily_question_limit": 30
        })
        assert response.status_code == 401


class TestDocumentEndpoints:
    """Test document management endpoints."""
    
    def test_list_documents(self, client, auth_headers):
        """Test listing documents."""
        response = client.get("/api/docs/", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_upload_document_without_file(self, client, auth_headers):
        """Test document upload without file."""
        response = client.post("/api/docs/upload", headers=auth_headers)
        assert response.status_code == 422  # Validation error
    
    def test_get_nonexistent_document(self, client, auth_headers):
        """Test getting non-existent document."""
        response = client.get("/api/docs/nonexistent", headers=auth_headers)
        assert response.status_code == 404


class TestQueryEndpoints:
    """Test query processing endpoints."""
    
    def test_query_without_auth(self, client):
        """Test query without authentication."""
        response = client.post("/api/query/", json={
            "student_id": "student_1",
            "class_id": "class_1",
            "query": "What is math?",
            "session_id": "session_1"
        })
        assert response.status_code == 401
    
    def test_permission_check_nonexistent_class(self, client, auth_headers):
        """Test permission check for non-existent class."""
        response = client.get("/api/query/permission-check?class_id=nonexistent", headers=auth_headers)
        assert response.status_code == 404


class TestLogEndpoints:
    """Test audit log endpoints."""
    
    def test_get_logs(self, client, auth_headers):
        """Test getting audit logs."""
        response = client.get("/api/logs/", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_get_logs_summary(self, client, auth_headers):
        """Test getting logs summary."""
        response = client.get("/api/logs/summary", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "total_queries" in data
        assert "successful_queries" in data
    
    def test_export_logs_csv(self, client, auth_headers):
        """Test exporting logs as CSV."""
        response = client.get("/api/logs/export", headers=auth_headers)
        assert response.status_code == 200
        assert response.headers["content-type"] == "text/csv; charset=utf-8"


class TestErrorHandling:
    """Test error handling and validation."""
    
    def test_validation_error(self, client, auth_headers):
        """Test validation error handling."""
        response = client.post("/api/classes/", headers=auth_headers, json={
            "name": "",  # Invalid: empty name
            "daily_question_limit": -1  # Invalid: negative limit
        })
        assert response.status_code == 422
        data = response.json()
        assert "error" in data
        assert "details" in data
    
    def test_404_error(self, client):
        """Test 404 error handling."""
        response = client.get("/nonexistent-endpoint")
        assert response.status_code == 404
    
    def test_cors_headers(self, client):
        """Test CORS headers are present."""
        response = client.options("/api/auth/login")
        # CORS headers should be present
        assert "access-control-allow-origin" in response.headers or response.status_code == 200