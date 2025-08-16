#!/usr/bin/env python3
"""Test script for data model validation."""

import sys
import os
# Add the parent directory to path to access shared module
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from shared.validation import (
    validateQueryRequest,
    validateLoginRequest,
    validateClassInfo,
    validateDocumentUpload,
    sanitizeInput,
    isRateLimited,
    SecurityUtils
)

def test_query_validation():
    """Test query request validation."""
    print("Testing Query Request Validation...")
    
    # Valid query
    valid_query = {
        "studentId": "student123",
        "classId": "class456", 
        "query": "What is photosynthesis?",
        "sessionId": "session789"
    }
    
    result = validateQueryRequest(valid_query)
    print(f"Valid query result: {result.isValid}")
    
    # Invalid query (XSS attempt)
    invalid_query = {
        "studentId": "student123",
        "classId": "class456",
        "query": "<script>alert('xss')</script>What is photosynthesis?",
        "sessionId": "session789"
    }
    
    result = validateQueryRequest(invalid_query)
    print(f"XSS query result: {result.isValid}")
    if not result.isValid:
        print(f"Errors: {[e.message for e in result.errors]}")

def test_sanitization():
    """Test input sanitization."""
    print("\nTesting Input Sanitization...")
    
    dangerous_input = "<script>alert('xss')</script>Hello world"
    sanitized = sanitizeInput(dangerous_input, 'text')
    print(f"Original: {dangerous_input}")
    print(f"Sanitized: {sanitized}")
    
    query_input = "SELECT * FROM users; DROP TABLE users;"
    sanitized_query = sanitizeInput(query_input, 'query')
    print(f"Query input: {query_input}")
    print(f"Sanitized query: {sanitized_query}")

def test_rate_limiting():
    """Test rate limiting functionality."""
    print("\nTesting Rate Limiting...")
    
    user_id = "test_user"
    
    # Test multiple requests
    for i in range(5):
        is_limited = isRateLimited(user_id)
        print(f"Request {i+1}: Rate limited = {is_limited}")

def test_security_utils():
    """Test security utilities."""
    print("\nTesting Security Utils...")
    
    # Test token generation
    token = SecurityUtils.generateSecureToken(16)
    print(f"Generated token: {token} (length: {len(token)})")
    
    # Test suspicious input detection
    suspicious_inputs = [
        "normal text",
        "<script>alert('xss')</script>",
        "SELECT * FROM users",
        "eval(malicious_code)"
    ]
    
    for input_text in suspicious_inputs:
        is_suspicious = SecurityUtils.isSuspiciousInput(input_text)
        print(f"'{input_text}' is suspicious: {is_suspicious}")

if __name__ == "__main__":
    print("=== Data Model and Validation Testing ===\n")
    
    try:
        test_query_validation()
        test_sanitization()
        test_rate_limiting()
        test_security_utils()
        
        print("\n=== All validation tests completed successfully! ===")
        
    except Exception as e:
        print(f"Error during testing: {e}")
        sys.exit(1)