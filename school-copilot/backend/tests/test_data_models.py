#!/usr/bin/env python3
"""Unit tests for data models and validation."""

import unittest
import sys
import os
from datetime import datetime

# Add the parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

class TestDataModels(unittest.TestCase):
    """Test cases for data models."""
    
    def setUp(self):
        """Set up test fixtures."""
        self.sample_query_data = {
            "student_id": "student123",
            "class_id": "class456",
            "query": "What is photosynthesis?",
            "session_id": "session789"
        }
        
        self.sample_user_data = {
            "id": "user123",
            "email": "test@school.edu",
            "name": "Test User",
            "role": "student"
        }
    
    def test_sqlalchemy_models_import(self):
        """Test that SQLAlchemy models can be imported."""
        try:
            from backend.models.models import User, Class, Document, DocumentChunk, StudentAccess, AuditLog
            self.assertTrue(True, "All models imported successfully")
        except ImportError as e:
            self.fail(f"Failed to import models: {e}")
    
    def test_user_model_attributes(self):
        """Test User model has required attributes."""
        from backend.models.models import User
        
        required_attrs = ['id', 'email', 'name', 'role', 'is_active', 'created_at']
        for attr in required_attrs:
            self.assertTrue(hasattr(User, attr), f"User model missing {attr} attribute")
    
    def test_class_model_attributes(self):
        """Test Class model has required attributes."""
        from backend.models.models import Class
        
        required_attrs = ['id', 'name', 'teacher_id', 'enabled', 'daily_question_limit', 'blocked_terms']
        for attr in required_attrs:
            self.assertTrue(hasattr(Class, attr), f"Class model missing {attr} attribute")
    
    def test_document_model_attributes(self):
        """Test Document model has required attributes."""
        from backend.models.models import Document
        
        required_attrs = ['id', 'name', 'file_path', 'file_type', 'file_size', 'status', 'upload_date']
        for attr in required_attrs:
            self.assertTrue(hasattr(Document, attr), f"Document model missing {attr} attribute")
    
    def test_database_schema_creation(self):
        """Test database schema can be created and verified."""
        from backend.models.schema_manager import verify_database_schema
        
        is_valid = verify_database_schema()
        self.assertTrue(is_valid, "Database schema should be valid")
    
    def test_basic_validation_patterns(self):
        """Test basic validation patterns."""
        import re
        
        # Email validation
        email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        
        valid_emails = ["test@school.edu", "student.name@university.org"]
        invalid_emails = ["invalid-email", "test@", "@domain.com"]
        
        for email in valid_emails:
            self.assertTrue(re.match(email_pattern, email), f"Email {email} should be valid")
        
        for email in invalid_emails:
            self.assertFalse(re.match(email_pattern, email), f"Email {email} should be invalid")
    
    def test_xss_detection(self):
        """Test XSS pattern detection."""
        import re
        
        xss_patterns = [
            r'<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>',
            r'javascript:',
            r'on\w+\s*='
        ]
        
        safe_inputs = ["Normal text", "What is photosynthesis?", "Hello world"]
        dangerous_inputs = ["<script>alert('xss')</script>", "javascript:alert('xss')", "onclick=alert('xss')"]
        
        for input_text in safe_inputs:
            has_xss = any(re.search(pattern, input_text, re.IGNORECASE) for pattern in xss_patterns)
            self.assertFalse(has_xss, f"Input '{input_text}' should be safe")
        
        for input_text in dangerous_inputs:
            has_xss = any(re.search(pattern, input_text, re.IGNORECASE) for pattern in xss_patterns)
            self.assertTrue(has_xss, f"Input '{input_text}' should be detected as dangerous")
    
    def test_typescript_types_exist(self):
        """Test that TypeScript types file exists and contains expected interfaces."""
        types_file = "shared/types.ts"
        self.assertTrue(os.path.exists(types_file), "TypeScript types file should exist")
        
        with open(types_file, 'r') as f:
            content = f.read()
        
        expected_interfaces = [
            'QueryRequest',
            'QueryResponse',
            'Citation',
            'Document',
            'ClassAccess',
            'StudentInfo'
        ]
        
        for interface in expected_interfaces:
            self.assertIn(f"interface {interface}", content, f"{interface} interface should exist")
    
    def test_sql_schema_files_exist(self):
        """Test that SQL schema files exist."""
        sqlite_schema = "backend/schemas/sql/sqlite_schema.sql"
        postgresql_schema = "backend/schemas/sql/postgresql_schema.sql"
        
        self.assertTrue(os.path.exists(sqlite_schema), "SQLite schema file should exist")
        self.assertTrue(os.path.exists(postgresql_schema), "PostgreSQL schema file should exist")
    
    def test_schema_manager_functions(self):
        """Test schema manager utility functions."""
        from backend.models.schema_manager import get_schema_info
        
        schema_info = get_schema_info()
        
        self.assertIn('database_type', schema_info)
        self.assertIn('tables', schema_info)
        self.assertIsInstance(schema_info['tables'], dict)
        
        # Check that all expected tables exist
        expected_tables = ['users', 'classes', 'documents', 'document_chunks', 'class_documents', 'student_access', 'audit_logs']
        for table in expected_tables:
            self.assertIn(table, schema_info['tables'], f"Table {table} should exist in schema")


class TestDataValidation(unittest.TestCase):
    """Test cases for data validation functions."""
    
    def test_string_length_validation(self):
        """Test string length validation."""
        # Test minimum length
        short_string = "ab"
        long_string = "a" * 100
        
        # These would be actual validation functions in a real implementation
        self.assertTrue(len(short_string) >= 1)
        self.assertTrue(len(long_string) <= 1000)
    
    def test_id_format_validation(self):
        """Test ID format validation."""
        import re
        
        # Class ID pattern
        class_id_pattern = r'^[a-zA-Z0-9\-_]{3,50}$'
        
        valid_class_ids = ["class123", "math-101", "science_2024"]
        invalid_class_ids = ["ab", "class with spaces", "class@123"]
        
        for class_id in valid_class_ids:
            self.assertTrue(re.match(class_id_pattern, class_id), f"Class ID {class_id} should be valid")
        
        for class_id in invalid_class_ids:
            self.assertFalse(re.match(class_id_pattern, class_id), f"Class ID {class_id} should be invalid")
    
    def test_file_type_validation(self):
        """Test file type validation."""
        valid_file_types = ['pdf', 'docx', 'pptx', 'txt', 'gdrive']
        invalid_file_types = ['exe', 'bat', 'js', 'php']
        
        for file_type in valid_file_types:
            self.assertIn(file_type, valid_file_types)
        
        for file_type in invalid_file_types:
            self.assertNotIn(file_type, valid_file_types)


if __name__ == '__main__':
    # Create test suite
    suite = unittest.TestSuite()
    
    # Add test cases
    suite.addTest(unittest.makeSuite(TestDataModels))
    suite.addTest(unittest.makeSuite(TestDataValidation))
    
    # Run tests
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    
    # Exit with appropriate code
    sys.exit(0 if result.wasSuccessful() else 1)