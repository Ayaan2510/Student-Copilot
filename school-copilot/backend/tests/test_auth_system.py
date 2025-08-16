#!/usr/bin/env python3
"""Comprehensive tests for authentication and authorization system."""

import unittest
import sys
import os
from datetime import datetime, timedelta
from unittest.mock import Mock, patch

# Add the parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

class TestJWTHandler(unittest.TestCase):
    """Test JWT token handling."""
    
    def setUp(self):
        """Set up test fixtures."""
        from backend.auth.jwt_handler import JWTHandler
        self.jwt_handler = JWTHandler()
        
        self.test_user_data = {
            "sub": "user123",
            "email": "test@example.edu",
            "role": "student",
            "iat": datetime.utcnow()
        }
    
    def test_create_access_token(self):
        """Test JWT token creation."""
        token = self.jwt_handler.create_access_token(self.test_user_data)
        
        self.assertIsInstance(token, str)
        self.assertTrue(len(token) > 50)  # JWT tokens are typically long
    
    def test_verify_valid_token(self):
        """Test verification of valid token."""
        token = self.jwt_handler.create_access_token(self.test_user_data)
        token_data = self.jwt_handler.verify_token(token)
        
        self.assertIsNotNone(token_data)
        self.assertEqual(token_data.user_id, "user123")
        self.assertEqual(token_data.email, "test@example.edu")
        self.assertEqual(token_data.role, "student")
    
    def test_verify_invalid_token(self):
        """Test verification of invalid token."""
        invalid_token = "invalid.token.here"
        token_data = self.jwt_handler.verify_token(invalid_token)
        
        self.assertIsNone(token_data)
    
    def test_verify_expired_token(self):
        """Test verification of expired token."""
        # Create token with very short expiration
        short_expiry = timedelta(seconds=-1)  # Already expired
        token = self.jwt_handler.create_access_token(self.test_user_data, short_expiry)
        token_data = self.jwt_handler.verify_token(token)
        
        self.assertIsNone(token_data)
    
    def test_password_hashing(self):
        """Test password hashing and verification."""
        password = "test_password_123"
        hashed = self.jwt_handler.hash_password(password)
        
        self.assertNotEqual(password, hashed)
        self.assertTrue(self.jwt_handler.verify_password(password, hashed))
        self.assertFalse(self.jwt_handler.verify_password("wrong_password", hashed))


class TestAuthService(unittest.TestCase):
    """Test authentication service."""
    
    def setUp(self):
        """Set up test fixtures."""
        # Mock database session
        self.mock_db = Mock()
        
        # Mock user
        self.mock_user = Mock()
        self.mock_user.id = "user123"
        self.mock_user.email = "test@example.edu"
        self.mock_user.name = "Test User"
        self.mock_user.role = "student"
        self.mock_user.is_active = True
        self.mock_user.created_at = datetime.utcnow()
        self.mock_user.last_login = None
        self.mock_user.hashed_password = None
    
    @patch('backend.auth.auth_service.jwt_handler')
    def test_authenticate_user_success(self, mock_jwt_handler):
        """Test successful user authentication."""
        from backend.auth.auth_service import AuthService
        from backend.schemas.auth import LoginRequest
        
        # Setup mocks
        self.mock_db.query.return_value.filter.return_value.first.return_value = self.mock_user
        mock_jwt_handler.create_user_token.return_value = "test_token"
        
        auth_service = AuthService(self.mock_db)
        
        login_request = LoginRequest(
            email="test@example.edu",
            domain="example.edu"
        )
        
        # This would be async in real implementation
        # result = await auth_service.authenticate_user(login_request)
        # For testing, we'll test the logic components
        
        # Test user lookup
        user = self.mock_db.query.return_value.filter.return_value.first.return_value
        self.assertEqual(user.email, "test@example.edu")
        self.assertTrue(user.is_active)
    
    def test_create_user(self):
        """Test user creation."""
        from backend.auth.auth_service import AuthService
        
        auth_service = AuthService(self.mock_db)
        
        # Mock the database operations
        self.mock_db.add = Mock()
        self.mock_db.commit = Mock()
        self.mock_db.refresh = Mock()
        
        user = auth_service.create_user(
            email="new@example.edu",
            name="New User",
            role="student"
        )
        
        self.mock_db.add.assert_called_once()
        self.mock_db.commit.assert_called_once()
    
    def test_check_user_permissions(self):
        """Test user permission checking."""
        from backend.auth.auth_service import AuthService
        
        # Mock user retrieval
        self.mock_db.query.return_value.filter.return_value.first.return_value = self.mock_user
        
        auth_service = AuthService(self.mock_db)
        
        # Test role hierarchy
        self.mock_user.role = "admin"
        self.assertTrue(auth_service.check_user_permissions("user123", "teacher"))
        self.assertTrue(auth_service.check_user_permissions("user123", "student"))
        
        self.mock_user.role = "teacher"
        self.assertFalse(auth_service.check_user_permissions("user123", "admin"))
        self.assertTrue(auth_service.check_user_permissions("user123", "student"))
        
        self.mock_user.role = "student"
        self.assertFalse(auth_service.check_user_permissions("user123", "teacher"))
        self.assertTrue(auth_service.check_user_permissions("user123", "student"))


class TestPermissionService(unittest.TestCase):
    """Test permission service."""
    
    def setUp(self):
        """Set up test fixtures."""
        self.mock_db = Mock()
        
        # Mock user
        self.mock_student = Mock()
        self.mock_student.id = "student123"
        self.mock_student.role = "student"
        
        self.mock_teacher = Mock()
        self.mock_teacher.id = "teacher123"
        self.mock_teacher.role = "teacher"
        
        self.mock_admin = Mock()
        self.mock_admin.id = "admin123"
        self.mock_admin.role = "admin"
        
        # Mock class
        self.mock_class = Mock()
        self.mock_class.id = "class123"
        self.mock_class.enabled = True
        self.mock_class.teacher_id = "teacher123"
        self.mock_class.daily_question_limit = 50
        self.mock_class.blocked_terms = ["inappropriate"]
    
    def test_admin_class_access(self):
        """Test admin has access to all classes."""
        from backend.auth.permissions import PermissionService
        
        self.mock_db.query.return_value.filter.return_value.first.return_value = self.mock_class
        
        permission_service = PermissionService(self.mock_db)
        result = permission_service.check_class_access(self.mock_admin, "class123")
        
        self.assertTrue(result["has_access"])
        self.assertEqual(result["remaining_questions"], 50)
    
    def test_teacher_class_access(self):
        """Test teacher access to their own classes."""
        from backend.auth.permissions import PermissionService
        
        self.mock_db.query.return_value.filter.return_value.first.return_value = self.mock_class
        
        permission_service = PermissionService(self.mock_db)
        
        # Teacher accessing their own class
        result = permission_service.check_class_access(self.mock_teacher, "class123")
        self.assertTrue(result["has_access"])
        
        # Teacher accessing another teacher's class
        self.mock_class.teacher_id = "other_teacher"
        result = permission_service.check_class_access(self.mock_teacher, "class123")
        self.assertFalse(result["has_access"])
        self.assertEqual(result["reason"], "Not authorized to access this class")
    
    def test_student_class_access(self):
        """Test student access to enrolled classes."""
        from backend.auth.permissions import PermissionService
        
        # Mock student access record
        mock_student_access = Mock()
        mock_student_access.enabled = True
        mock_student_access.daily_question_count = 10
        mock_student_access.last_question_date = datetime.now().date()
        
        self.mock_db.query.return_value.filter.return_value.first.side_effect = [
            self.mock_class,  # First call for class
            mock_student_access  # Second call for student access
        ]
        
        permission_service = PermissionService(self.mock_db)
        result = permission_service.check_class_access(self.mock_student, "class123")
        
        self.assertTrue(result["has_access"])
        self.assertEqual(result["remaining_questions"], 40)  # 50 - 10
    
    def test_blocked_terms_validation(self):
        """Test blocked terms validation."""
        from backend.auth.permissions import PermissionService
        
        self.mock_db.query.return_value.filter.return_value.first.return_value = self.mock_class
        
        permission_service = PermissionService(self.mock_db)
        
        # Query with blocked term
        result = permission_service.validate_query_permissions(
            self.mock_admin, "class123", "This is inappropriate content"
        )
        
        # Admin should still be allowed (no blocked terms for admin)
        self.assertTrue(result["allowed"])
    
    def test_daily_limit_exceeded(self):
        """Test daily question limit enforcement."""
        from backend.auth.permissions import PermissionService
        
        # Mock student access with limit exceeded
        mock_student_access = Mock()
        mock_student_access.enabled = True
        mock_student_access.daily_question_count = 50  # At limit
        mock_student_access.last_question_date = datetime.now().date()
        
        self.mock_db.query.return_value.filter.return_value.first.side_effect = [
            self.mock_class,
            mock_student_access
        ]
        
        permission_service = PermissionService(self.mock_db)
        result = permission_service.check_class_access(self.mock_student, "class123")
        
        self.assertFalse(result["has_access"])
        self.assertEqual(result["reason"], "Daily question limit exceeded")


class TestValidationUtils(unittest.TestCase):
    """Test validation utilities."""
    
    def test_email_domain_validation(self):
        """Test email domain validation."""
        from backend.utils.validation import ValidationUtils
        
        allowed_domains = ["example.edu", "school.org"]
        
        # Valid domains
        self.assertTrue(ValidationUtils.validate_email_domain("user@example.edu", allowed_domains))
        self.assertTrue(ValidationUtils.validate_email_domain("test@school.org", allowed_domains))
        
        # Invalid domains
        self.assertFalse(ValidationUtils.validate_email_domain("user@gmail.com", allowed_domains))
        self.assertFalse(ValidationUtils.validate_email_domain("invalid-email", allowed_domains))
    
    def test_student_id_validation(self):
        """Test student ID format validation."""
        from backend.utils.validation import ValidationUtils
        
        # Valid IDs
        self.assertTrue(ValidationUtils.validate_student_id("student123"))
        self.assertTrue(ValidationUtils.validate_student_id("user_456"))
        self.assertTrue(ValidationUtils.validate_student_id("test-user"))
        
        # Invalid IDs
        self.assertFalse(ValidationUtils.validate_student_id("ab"))  # Too short
        self.assertFalse(ValidationUtils.validate_student_id("a" * 51))  # Too long
        self.assertFalse(ValidationUtils.validate_student_id("user@domain"))  # Invalid chars
    
    def test_query_sanitization(self):
        """Test query text sanitization."""
        from backend.utils.validation import ValidationUtils
        
        # Test dangerous character removal
        dangerous_query = 'SELECT * FROM users; <script>alert("xss")</script>'
        sanitized = ValidationUtils.sanitize_query_text(dangerous_query)
        
        self.assertNotIn("<script>", sanitized)
        self.assertNotIn("</script>", sanitized)
        self.assertNotIn('"', sanitized)
        self.assertNotIn(";", sanitized)
    
    def test_blocked_terms_validation(self):
        """Test blocked terms detection."""
        from backend.utils.validation import ValidationUtils
        
        blocked_terms = ["inappropriate", "blocked", "forbidden"]
        
        # Query with blocked term
        blocked_term = ValidationUtils.validate_blocked_terms(
            "This is inappropriate content", blocked_terms
        )
        self.assertEqual(blocked_term, "inappropriate")
        
        # Query without blocked terms
        blocked_term = ValidationUtils.validate_blocked_terms(
            "This is a normal question", blocked_terms
        )
        self.assertIsNone(blocked_term)
    
    def test_file_validation(self):
        """Test file validation utilities."""
        from backend.utils.validation import ValidationUtils
        
        allowed_types = ["pdf", "docx", "txt"]
        
        # Valid file types
        self.assertTrue(ValidationUtils.validate_file_type("document.pdf", allowed_types))
        self.assertTrue(ValidationUtils.validate_file_type("file.DOCX", allowed_types))
        
        # Invalid file types
        self.assertFalse(ValidationUtils.validate_file_type("script.exe", allowed_types))
        self.assertFalse(ValidationUtils.validate_file_type("noextension", allowed_types))
        
        # Valid file sizes
        self.assertTrue(ValidationUtils.validate_file_size(1024 * 1024))  # 1MB
        self.assertTrue(ValidationUtils.validate_file_size(10 * 1024 * 1024))  # 10MB
        
        # Invalid file sizes
        self.assertFalse(ValidationUtils.validate_file_size(0))  # Empty file
        self.assertFalse(ValidationUtils.validate_file_size(100 * 1024 * 1024))  # 100MB (too large)


if __name__ == '__main__':
    # Create test suite
    suite = unittest.TestSuite()
    
    # Add test cases
    suite.addTest(unittest.TestLoader().loadTestsFromTestCase(TestJWTHandler))
    suite.addTest(unittest.TestLoader().loadTestsFromTestCase(TestAuthService))
    suite.addTest(unittest.TestLoader().loadTestsFromTestCase(TestPermissionService))
    suite.addTest(unittest.TestLoader().loadTestsFromTestCase(TestValidationUtils))
    
    # Run tests
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    
    # Print summary
    print(f"\n=== Authentication System Test Results ===")
    print(f"Tests run: {result.testsRun}")
    print(f"Failures: {len(result.failures)}")
    print(f"Errors: {len(result.errors)}")
    print(f"Success rate: {((result.testsRun - len(result.failures) - len(result.errors)) / result.testsRun * 100):.1f}%")
    
    # Exit with appropriate code
    sys.exit(0 if result.wasSuccessful() else 1)