"""Data validation utilities."""

import re
import json
from typing import Any, Dict, List, Optional, Union
from datetime import datetime, date
from pydantic import ValidationError, validator
from ..schemas.queries import QueryRequest
from ..schemas.documents import DocumentCreate, DocumentUpdate
from ..schemas.classes import ClassCreate, ClassUpdate
from ..schemas.auth import LoginRequest


class ValidationUtils:
    """Utility class for data validation."""
    
    @staticmethod
    def validate_email_domain(email: str, allowed_domains: List[str]) -> bool:
        """Validate email domain against allowed domains."""
        if not email or "@" not in email:
            return False
        
        domain = email.split("@")[1].lower()
        return any(domain.endswith(allowed_domain.lower()) for allowed_domain in allowed_domains)
    
    @staticmethod
    def validate_student_id(student_id: str) -> bool:
        """Validate student ID format."""
        # Allow alphanumeric with hyphens and underscores, 3-50 characters
        pattern = r"^[a-zA-Z0-9_-]{3,50}$"
        return bool(re.match(pattern, student_id))
    
    @staticmethod
    def validate_class_id(class_id: str) -> bool:
        """Validate class ID format."""
        # Allow alphanumeric with hyphens and underscores, 3-50 characters
        pattern = r"^[a-zA-Z0-9_-]{3,50}$"
        return bool(re.match(pattern, class_id))
    
    @staticmethod
    def sanitize_query_text(query: str) -> str:
        """Sanitize query text to prevent injection attacks."""
        if not query:
            return ""
        
        # Remove potentially dangerous characters
        sanitized = re.sub(r'[<>"\';\\]', '', query)
        
        # Limit length
        sanitized = sanitized[:1000]
        
        # Remove excessive whitespace
        sanitized = re.sub(r'\s+', ' ', sanitized).strip()
        
        return sanitized
    
    @staticmethod
    def validate_blocked_terms(query: str, blocked_terms: List[str]) -> Optional[str]:
        """Check if query contains blocked terms."""
        if not blocked_terms:
            return None
        
        query_lower = query.lower()
        for term in blocked_terms:
            if term.lower() in query_lower:
                return term
        
        return None
    
    @staticmethod
    def validate_file_type(filename: str, allowed_types: List[str]) -> bool:
        """Validate file type based on extension."""
        if not filename or "." not in filename:
            return False
        
        extension = filename.split(".")[-1].lower()
        return extension in [t.lower() for t in allowed_types]
    
    @staticmethod
    def validate_file_size(file_size: int, max_size_mb: int = 50) -> bool:
        """Validate file size."""
        max_size_bytes = max_size_mb * 1024 * 1024
        return 0 < file_size <= max_size_bytes
    
    @staticmethod
    def validate_json_metadata(metadata: Dict[str, Any]) -> bool:
        """Validate JSON metadata structure."""
        try:
            # Check for reasonable size
            if len(str(metadata)) > 10000:  # 10KB limit
                return False
            
            # Check for dangerous keys
            dangerous_keys = ['__proto__', 'constructor', 'prototype']
            for key in metadata.keys():
                if key in dangerous_keys:
                    return False
            
            return True
        except Exception:
            return False
    
    @staticmethod
    def validate_session_id(session_id: str) -> bool:
        """Validate session ID format."""
        # UUID-like format or alphanumeric with hyphens
        pattern = r"^[a-zA-Z0-9_-]{8,64}$"
        return bool(re.match(pattern, session_id))
    
    @staticmethod
    def validate_document_name(name: str) -> bool:
        """Validate document name."""
        if not name or len(name.strip()) < 1:
            return False
        
        # Check length
        if len(name) > 255:
            return False
        
        # Check for dangerous characters
        dangerous_chars = ['<', '>', '"', '|', ':', '*', '?', '\\', '/']
        return not any(char in name for char in dangerous_chars)
    
    @staticmethod
    def validate_class_name(name: str) -> bool:
        """Validate class name."""
        if not name or len(name.strip()) < 1:
            return False
        
        # Check length
        if len(name) > 255:
            return False
        
        # Allow letters, numbers, spaces, hyphens, underscores
        pattern = r"^[a-zA-Z0-9\s_-]+$"
        return bool(re.match(pattern, name.strip()))
    
    @staticmethod
    def validate_daily_limit(limit: int) -> bool:
        """Validate daily question limit."""
        return isinstance(limit, int) and 1 <= limit <= 1000
    
    @staticmethod
    def validate_blocked_terms_list(terms: List[str]) -> bool:
        """Validate list of blocked terms."""
        if not isinstance(terms, list):
            return False
        
        if len(terms) > 100:  # Reasonable limit
            return False
        
        for term in terms:
            if not isinstance(term, str):
                return False
            if len(term) > 100:  # Individual term length limit
                return False
            if not term.strip():  # Empty terms not allowed
                return False
        
        return True
    
    @staticmethod
    def validate_confidence_score(score: float) -> bool:
        """Validate confidence score."""
        return isinstance(score, (int, float)) and 0.0 <= score <= 1.0
    
    @staticmethod
    def validate_response_time(time_ms: int) -> bool:
        """Validate response time in milliseconds."""
        return isinstance(time_ms, int) and 0 <= time_ms <= 300000  # Max 5 minutes
    
    @staticmethod
    def validate_page_number(page: Optional[int]) -> bool:
        """Validate page number."""
        if page is None:
            return True
        return isinstance(page, int) and page > 0
    
    @staticmethod
    def validate_token_count(count: int) -> bool:
        """Validate token count."""
        return isinstance(count, int) and 0 < count <= 10000  # Reasonable limits
    
    @staticmethod
    def validate_chunk_index(index: int) -> bool:
        """Validate chunk index."""
        return isinstance(index, int) and index >= 0
    
    @staticmethod
    def validate_relevance_score(score: float) -> bool:
        """Validate relevance score."""
        return isinstance(score, (int, float)) and 0.0 <= score <= 1.0


def validate_query_request(request: QueryRequest, blocked_terms: List[str]) -> Dict[str, Any]:
    """Validate query request and return validation results."""
    errors = []
    warnings = []
    
    # Validate student ID
    if not ValidationUtils.validate_student_id(request.student_id):
        errors.append("Invalid student ID format")
    
    # Validate class ID
    if not ValidationUtils.validate_class_id(request.class_id):
        errors.append("Invalid class ID format")
    
    # Sanitize and validate query
    original_query = request.query
    sanitized_query = ValidationUtils.sanitize_query_text(request.query)
    
    if not sanitized_query:
        errors.append("Query cannot be empty after sanitization")
    
    if len(sanitized_query) < 3:
        errors.append("Query too short (minimum 3 characters)")
    
    if original_query != sanitized_query:
        warnings.append("Query was sanitized for security")
    
    # Check blocked terms
    blocked_term = ValidationUtils.validate_blocked_terms(sanitized_query, blocked_terms)
    if blocked_term:
        errors.append(f"Query contains blocked term: {blocked_term}")
    
    return {
        "valid": len(errors) == 0,
        "errors": errors,
        "warnings": warnings,
        "sanitized_query": sanitized_query,
        "blocked_term": blocked_term
    }

def validate_document_create(request: DocumentCreate) -> Dict[str, Any]:
    """Validate document creation request."""
    errors = []
    warnings = []
    
    # Validate document name
    if not ValidationUtils.validate_document_name(request.name):
        errors.append("Invalid document name format or length")
    
    # Validate file type
    allowed_types = ['pdf', 'docx', 'pptx', 'txt', 'gdrive']
    if request.file_type not in allowed_types:
        errors.append(f"Invalid file type. Allowed: {', '.join(allowed_types)}")
    
    # Validate author if provided
    if request.author and len(request.author) > 255:
        errors.append("Author name too long (max 255 characters)")
    
    # Validate metadata
    if request.metadata and not ValidationUtils.validate_json_metadata(request.metadata):
        errors.append("Invalid metadata format or size")
    
    return {
        "valid": len(errors) == 0,
        "errors": errors,
        "warnings": warnings
    }


def validate_class_create(request: ClassCreate) -> Dict[str, Any]:
    """Validate class creation request."""
    errors = []
    warnings = []
    
    # Validate class name
    if not ValidationUtils.validate_class_name(request.name):
        errors.append("Invalid class name format")
    
    # Validate daily question limit
    if not ValidationUtils.validate_daily_limit(request.daily_question_limit):
        errors.append("Daily question limit must be between 1 and 1000")
    
    # Validate blocked terms if provided
    if hasattr(request, 'blocked_terms') and request.blocked_terms:
        if not ValidationUtils.validate_blocked_terms_list(request.blocked_terms):
            errors.append("Invalid blocked terms list")
    
    return {
        "valid": len(errors) == 0,
        "errors": errors,
        "warnings": warnings
    }


def validate_login_request(request: LoginRequest) -> Dict[str, Any]:
    """Validate login request."""
    errors = []
    warnings = []
    
    # Validate email format
    email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'$'
    if not re.match(email_pattern, request.email):
        errors.append("Invalid email format")
    
    # Validate domain
    if not ValidationUtils.validate_email_domain(request.email, [request.domain]):
        errors.append("Email domain does not match expected domain")
    
    # Check password if provided (for non-SSO login)
    if request.password is not None:
        if len(request.password) < 8:
            errors.append("Password too short (minimum 8 characters)")
        if len(request.password) > 128:
            errors.append("Password too long (maximum 128 characters)")
    
    return {
        "valid": len(errors) == 0,
        "errors": errors,
        "warnings": warnings
    }


def validate_citation_data(citation: Dict[str, Any]) -> Dict[str, Any]:
    """Validate citation data structure."""
    errors = []
    warnings = []
    
    required_fields = ['document_id', 'document_name', 'chunk_id', 'relevance_score']
    for field in required_fields:
        if field not in citation:
            errors.append(f"Missing required field: {field}")
    
    # Validate document ID
    if 'document_id' in citation and not ValidationUtils.validate_student_id(citation['document_id']):
        errors.append("Invalid document ID format")
    
    # Validate document name
    if 'document_name' in citation and not ValidationUtils.validate_document_name(citation['document_name']):
        errors.append("Invalid document name")
    
    # Validate page number
    if 'page_number' in citation and not ValidationUtils.validate_page_number(citation['page_number']):
        errors.append("Invalid page number")
    
    # Validate relevance score
    if 'relevance_score' in citation and not ValidationUtils.validate_relevance_score(citation['relevance_score']):
        errors.append("Invalid relevance score (must be between 0.0 and 1.0)")
    
    # Validate content preview
    if 'content_preview' in citation:
        if not isinstance(citation['content_preview'], str):
            errors.append("Content preview must be a string")
        elif len(citation['content_preview']) > 500:
            warnings.append("Content preview is quite long")
    
    return {
        "valid": len(errors) == 0,
        "errors": errors,
        "warnings": warnings
    }


def validate_audit_log_data(log_data: Dict[str, Any]) -> Dict[str, Any]:
    """Validate audit log data."""
    errors = []
    warnings = []
    
    # Validate required fields
    required_fields = ['student_id', 'class_id', 'query_text', 'response_time_ms', 'success']
    for field in required_fields:
        if field not in log_data:
            errors.append(f"Missing required field: {field}")
    
    # Validate student ID
    if 'student_id' in log_data and not ValidationUtils.validate_student_id(log_data['student_id']):
        errors.append("Invalid student ID format")
    
    # Validate class ID
    if 'class_id' in log_data and not ValidationUtils.validate_class_id(log_data['class_id']):
        errors.append("Invalid class ID format")
    
    # Validate query text
    if 'query_text' in log_data:
        if not isinstance(log_data['query_text'], str):
            errors.append("Query text must be a string")
        elif len(log_data['query_text']) > 2000:
            errors.append("Query text too long (max 2000 characters)")
    
    # Validate response time
    if 'response_time_ms' in log_data and not ValidationUtils.validate_response_time(log_data['response_time_ms']):
        errors.append("Invalid response time")
    
    # Validate success flag
    if 'success' in log_data and not isinstance(log_data['success'], bool):
        errors.append("Success field must be boolean")
    
    # Validate confidence score if provided
    if 'confidence_score' in log_data and log_data['confidence_score'] is not None:
        if not ValidationUtils.validate_confidence_score(log_data['confidence_score']):
            errors.append("Invalid confidence score")
    
    # Validate citation count
    if 'citation_count' in log_data:
        if not isinstance(log_data['citation_count'], int) or log_data['citation_count'] < 0:
            errors.append("Citation count must be a non-negative integer")
    
    return {
        "valid": len(errors) == 0,
        "errors": errors,
        "warnings": warnings
    }


def validate_bulk_data(data_list: List[Dict[str, Any]], validator_func) -> Dict[str, Any]:
    """Validate a list of data items using the specified validator function."""
    errors = []
    warnings = []
    valid_items = []
    invalid_items = []
    
    for i, item in enumerate(data_list):
        result = validator_func(item)
        if result["valid"]:
            valid_items.append(item)
        else:
            invalid_items.append({
                "index": i,
                "item": item,
                "errors": result["errors"]
            })
            errors.extend([f"Item {i}: {error}" for error in result["errors"]])
        
        if result["warnings"]:
            warnings.extend([f"Item {i}: {warning}" for warning in result["warnings"]])
    
    return {
        "valid": len(invalid_items) == 0,
        "errors": errors,
        "warnings": warnings,
        "valid_items": valid_items,
        "invalid_items": invalid_items,
        "total_items": len(data_list),
        "valid_count": len(valid_items),
        "invalid_count": len(invalid_items)
    }


class ValidationError(Exception):
    """Custom validation error with detailed information."""
    
    def __init__(self, message: str, errors: List[str], warnings: List[str] = None):
        super().__init__(message)
        self.errors = errors
        self.warnings = warnings or []
        self.message = message
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for API responses."""
        return {
            "message": self.message,
            "errors": self.errors,
            "warnings": self.warnings
        }


def raise_validation_error(validation_result: Dict[str, Any], context: str = "Validation"):
    """Raise ValidationError if validation result indicates failure."""
    if not validation_result["valid"]:
        raise ValidationError(
            message=f"{context} failed",
            errors=validation_result["errors"],
            warnings=validation_result.get("warnings", [])
        )