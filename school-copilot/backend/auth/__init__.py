"""Authentication and authorization module."""

from .jwt_handler import JWTHandler, create_access_token, verify_token
from .auth_service import AuthService
from .dependencies import get_current_user, get_current_teacher, get_current_admin, require_role
from .permissions import PermissionService, get_permission_service
from .middleware import AuthMiddleware, RateLimitMiddleware, SecurityConfig

__all__ = [
    "JWTHandler",
    "create_access_token", 
    "verify_token",
    "AuthService",
    "get_current_user",
    "get_current_teacher",
    "get_current_admin",
    "require_role",
    "PermissionService",
    "get_permission_service",
    "AuthMiddleware",
    "RateLimitMiddleware",
    "SecurityConfig"
]