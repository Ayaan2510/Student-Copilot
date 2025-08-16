"""Fixed validation utilities."""

import re
from typing import Dict, Any, List
from ..schemas.auth import LoginRequest

def validate_login_request(request: LoginRequest) -> Dict[str, Any]:
    """Validate login request."""
    errors = []
    warnings = []
    
    # Validate email format
    email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    if not re.match(email_pattern, request.email):
        errors.append("Invalid email format")
    
    # Validate domain
    if not request.email.endswith(f"@{request.domain}"):
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