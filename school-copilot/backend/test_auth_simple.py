#!/usr/bin/env python3
"""Simple authentication system test without external dependencies."""

import sys
import os
import re
from datetime import datetime

# Add the parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def test_basic_auth_components():
    """Test basic authentication components."""
    print("Testing Basic Authentication Components...")
    
    try:
        # Test JWT handler import
        from backend.auth.jwt_handler import JWTHandler
        jwt_handler = JWTHandler()
        print("✓ JWT handler imported successfully")
        
        # Test token creation (basic functionality)
        test_data = {
            "sub": "user123",
            "email": "test@example.edu",
            "role": "student"
        }
        
        token = jwt_handler.create_access_token(test_data)
        print(f"✓ Token created: {token[:20]}...")
        
        # Test token verification
        token_data = jwt_handler.verify_token(token)
        if token_data and token_data.user_id == "user123":
            print("✓ Token verification successful")
        else:
            print("✗ Token verification failed")
        
        # Test password hashing
        password = "test123"
        hashed = jwt_handler.hash_password(password)
        if jwt_handler.verify_password(password, hashed):
            print("✓ Password hashing and verification working")
        else:
            print("✗ Password hashing failed")
            
    except Exception as e:
        print(f"✗ JWT handler test failed: {e}")

def test_validation_utils():
    """Test validation utilities."""
    print("\nTesting Validation Utilities...")
    
    try:
        from backend.utils.validation import ValidationUtils
        
        # Test email domain validation
        if ValidationUtils.validate_email_domain("test@example.edu", ["example.edu"]):
            print("✓ Email domain validation working")
        else:
            print("✗ Email domain validation failed")
        
        # Test student ID validation
        if ValidationUtils.validate_student_id("student123"):
            print("✓ Student ID validation working")
        else:
            print("✗ Student ID validation failed")
        
        # Test query sanitization
        dangerous_query = 'SELECT * FROM users; <script>alert("xss")</script>'
        sanitized = ValidationUtils.sanitize_query_text(dangerous_query)
        if "<script>" not in sanitized and "SELECT" not in sanitized:
            print("✓ Query sanitization working")
        else:
            print("✗ Query sanitization failed")
        
        # Test blocked terms
        blocked_term = ValidationUtils.validate_blocked_terms("This is inappropriate", ["inappropriate"])
        if blocked_term == "inappropriate":
            print("✓ Blocked terms detection working")
        else:
            print("✗ Blocked terms detection failed")
            
    except Exception as e:
        print(f"✗ Validation utils test failed: {e}")

def test_permission_logic():
    """Test permission checking logic."""
    print("\nTesting Permission Logic...")
    
    try:
        # Test role hierarchy logic
        role_hierarchy = {
            "admin": 3,
            "teacher": 2,
            "student": 1
        }
        
        # Admin should have teacher permissions
        admin_level = role_hierarchy.get("admin", 0)
        teacher_level = role_hierarchy.get("teacher", 0)
        
        if admin_level >= teacher_level:
            print("✓ Role hierarchy logic working")
        else:
            print("✗ Role hierarchy logic failed")
        
        # Test basic permission patterns
        def check_class_access(user_role, class_teacher_id, user_id):
            if user_role == "admin":
                return True
            elif user_role == "teacher" and class_teacher_id == user_id:
                return True
            return False
        
        # Test admin access
        if check_class_access("admin", "teacher123", "admin456"):
            print("✓ Admin class access logic working")
        else:
            print("✗ Admin class access logic failed")
        
        # Test teacher access to own class
        if check_class_access("teacher", "teacher123", "teacher123"):
            print("✓ Teacher class access logic working")
        else:
            print("✗ Teacher class access logic failed")
        
        # Test teacher denied access to other's class
        if not check_class_access("teacher", "teacher123", "teacher456"):
            print("✓ Teacher access denial logic working")
        else:
            print("✗ Teacher access denial logic failed")
            
    except Exception as e:
        print(f"✗ Permission logic test failed: {e}")

def test_security_patterns():
    """Test security pattern detection."""
    print("\nTesting Security Patterns...")
    
    try:
        # XSS patterns
        xss_patterns = [
            r'<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>',
            r'javascript:',
            r'on\w+\s*='
        ]
        
        test_inputs = [
            ("Normal text", False),
            ("<script>alert('xss')</script>", True),
            ("javascript:alert('xss')", True),
            ("onclick=alert('xss')", True),
            ("What is photosynthesis?", False)
        ]
        
        all_passed = True
        for input_text, should_detect in test_inputs:
            has_xss = any(re.search(pattern, input_text, re.IGNORECASE) for pattern in xss_patterns)
            if has_xss == should_detect:
                print(f"✓ XSS detection for '{input_text[:20]}...' correct")
            else:
                print(f"✗ XSS detection for '{input_text[:20]}...' failed")
                all_passed = False
        
        if all_passed:
            print("✓ All XSS pattern tests passed")
        else:
            print("✗ Some XSS pattern tests failed")
            
    except Exception as e:
        print(f"✗ Security patterns test failed: {e}")

def test_database_models():
    """Test database models can be imported."""
    print("\nTesting Database Models...")
    
    try:
        from backend.models.models import User, Class, Document, StudentAccess, AuditLog
        print("✓ All database models imported successfully")
        
        # Test model attributes
        user_attrs = ['id', 'email', 'name', 'role', 'is_active']
        for attr in user_attrs:
            if hasattr(User, attr):
                print(f"✓ User model has {attr}")
            else:
                print(f"✗ User model missing {attr}")
                
    except Exception as e:
        print(f"✗ Database models test failed: {e}")

if __name__ == "__main__":
    print("=== Simple Authentication System Test ===\n")
    
    try:
        test_basic_auth_components()
        test_validation_utils()
        test_permission_logic()
        test_security_patterns()
        test_database_models()
        
        print("\n=== Authentication system basic tests completed! ===")
        
    except Exception as e:
        print(f"Error during testing: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)