#!/usr/bin/env python3
"""Simple test script for data models without external dependencies."""

import sys
import os
import re
from datetime import datetime

# Add the parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def test_basic_validation():
    """Test basic validation patterns without external dependencies."""
    print("Testing Basic Validation Patterns...")
    
    # Email validation pattern
    EMAIL_PATTERN = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    
    test_emails = [
        "student@school.edu",
        "teacher.name@university.org", 
        "invalid-email",
        "test@",
        "@domain.com"
    ]
    
    for email in test_emails:
        is_valid = bool(re.match(EMAIL_PATTERN, email))
        print(f"Email '{email}': {'Valid' if is_valid else 'Invalid'}")
    
    # XSS detection pattern
    XSS_PATTERNS = [
        r'<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>',
        r'javascript:',
        r'on\w+\s*='
    ]
    
    test_inputs = [
        "Normal text input",
        "<script>alert('xss')</script>",
        "javascript:alert('xss')",
        "onclick=alert('xss')",
        "What is photosynthesis?"
    ]
    
    print("\nTesting XSS Detection...")
    for input_text in test_inputs:
        has_xss = any(re.search(pattern, input_text, re.IGNORECASE) for pattern in XSS_PATTERNS)
        print(f"Input '{input_text}': {'Contains XSS' if has_xss else 'Safe'}")

def test_data_model_structure():
    """Test that our data models can be imported and have correct structure."""
    print("\nTesting Data Model Structure...")
    
    try:
        from backend.models.models import User, Class, Document, DocumentChunk, StudentAccess, AuditLog
        print("✓ All SQLAlchemy models imported successfully")
        
        # Test model attributes
        user_attrs = ['id', 'email', 'name', 'role', 'is_active', 'created_at']
        for attr in user_attrs:
            if hasattr(User, attr):
                print(f"✓ User model has {attr} attribute")
            else:
                print(f"✗ User model missing {attr} attribute")
        
        class_attrs = ['id', 'name', 'teacher_id', 'enabled', 'daily_question_limit']
        for attr in class_attrs:
            if hasattr(Class, attr):
                print(f"✓ Class model has {attr} attribute")
            else:
                print(f"✗ Class model missing {attr} attribute")
                
    except Exception as e:
        print(f"✗ Error importing models: {e}")

def test_pydantic_schemas():
    """Test that Pydantic schemas can be imported."""
    print("\nTesting Pydantic Schemas...")
    
    try:
        from backend.schemas.queries import QueryRequest, QueryResponse, CitationResponse
        from backend.schemas.users import UserCreate, UserResponse, StudentInfo
        from backend.schemas.documents import DocumentCreate, DocumentResponse, UploadResponse
        
        print("✓ All Pydantic schemas imported successfully")
        
        # Test creating a QueryRequest
        query_data = {
            "student_id": "student123",
            "class_id": "class456",
            "query": "What is photosynthesis?",
            "session_id": "session789"
        }
        
        query_request = QueryRequest(**query_data)
        print(f"✓ QueryRequest created: {query_request.query[:30]}...")
        
    except Exception as e:
        print(f"✗ Error with Pydantic schemas: {e}")

def test_typescript_types():
    """Test that TypeScript types file exists and has expected content."""
    print("\nTesting TypeScript Types...")
    
    types_file = "shared/types.ts"
    if os.path.exists(types_file):
        print("✓ TypeScript types file exists")
        
        with open(types_file, 'r') as f:
            content = f.read()
            
        # Check for key interfaces
        expected_interfaces = [
            'QueryRequest',
            'QueryResponse', 
            'Citation',
            'Document',
            'ClassAccess',
            'StudentInfo'
        ]
        
        for interface in expected_interfaces:
            if f"interface {interface}" in content:
                print(f"✓ {interface} interface found")
            else:
                print(f"✗ {interface} interface missing")
    else:
        print("✗ TypeScript types file not found")

def test_database_schema():
    """Test database schema creation."""
    print("\nTesting Database Schema...")
    
    try:
        from backend.models.schema_manager import verify_database_schema, get_schema_info
        
        # Verify schema
        is_valid = verify_database_schema()
        print(f"Database schema valid: {is_valid}")
        
        # Get schema info
        schema_info = get_schema_info()
        print(f"Database type: {schema_info['database_type']}")
        print(f"Number of tables: {len(schema_info['tables'])}")
        
        for table_name, table_info in schema_info['tables'].items():
            print(f"  - {table_name}: {table_info['column_count']} columns")
            
    except Exception as e:
        print(f"✗ Error testing database schema: {e}")

if __name__ == "__main__":
    print("=== Simple Data Model Testing ===\n")
    
    try:
        test_basic_validation()
        test_data_model_structure()
        test_pydantic_schemas()
        test_typescript_types()
        test_database_schema()
        
        print("\n=== All basic tests completed! ===")
        
    except Exception as e:
        print(f"Error during testing: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)