"""Authentication and authorization middleware."""

import time
from typing import Optional, Callable
from fastapi import Request, Response, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.base import BaseHTTPMiddleware
from sqlalchemy.orm import Session

from ..models.database import SessionLocal
from ..models.models import User
from ..schemas.auth import TokenData
from .jwt_handler import verify_token
from .auth_service import AuthService


class AuthMiddleware(BaseHTTPMiddleware):
    """Middleware for handling authentication and basic security."""
    
    def __init__(self, app, exclude_paths: Optional[list] = None):
        super().__init__(app)
        self.exclude_paths = exclude_paths or [
            "/docs",
            "/redoc",
            "/openapi.json",
            "/auth/login",
            "/health",
            "/"
        ]
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Process request through authentication middleware."""
        start_time = time.time()
        
        # Skip authentication for excluded paths
        if any(request.url.path.startswith(path) for path in self.exclude_paths):
            response = await call_next(request)
            self._add_security_headers(response)
            return response
        
        # Add request ID for tracking
        request_id = f"req_{int(time.time() * 1000)}"
        request.state.request_id = request_id
        
        try:
            # Process request
            response = await call_next(request)
            
            # Add security headers
            self._add_security_headers(response)
            
            # Add performance headers
            process_time = time.time() - start_time
            response.headers["X-Process-Time"] = str(process_time)
            response.headers["X-Request-ID"] = request_id
            
            return response
            
        except Exception as e:
            # Log error (in production, use proper logging)
            print(f"Request {request_id} failed: {str(e)}")
            raise
    
    def _add_security_headers(self, response: Response) -> None:
        """Add security headers to response."""
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline'; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data: https:; "
            "font-src 'self'; "
            "connect-src 'self'; "
            "frame-ancestors 'none';"
        )


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Simple rate limiting middleware."""
    
    def __init__(self, app, requests_per_minute: int = 60):
        super().__init__(app)
        self.requests_per_minute = requests_per_minute
        self.request_counts = {}  # In production, use Redis or similar
        self.window_size = 60  # 1 minute window
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Apply rate limiting."""
        client_ip = self._get_client_ip(request)
        current_time = time.time()
        
        # Clean old entries
        self._cleanup_old_entries(current_time)
        
        # Check rate limit
        if self._is_rate_limited(client_ip, current_time):
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Rate limit exceeded. Please try again later."
            )
        
        # Record request
        self._record_request(client_ip, current_time)
        
        return await call_next(request)
    
    def _get_client_ip(self, request: Request) -> str:
        """Get client IP address."""
        # Check for forwarded headers (when behind proxy)
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            return forwarded_for.split(",")[0].strip()
        
        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip
        
        return request.client.host if request.client else "unknown"
    
    def _cleanup_old_entries(self, current_time: float) -> None:
        """Remove old entries outside the time window."""
        cutoff_time = current_time - self.window_size
        
        for ip in list(self.request_counts.keys()):
            self.request_counts[ip] = [
                timestamp for timestamp in self.request_counts[ip]
                if timestamp > cutoff_time
            ]
            
            if not self.request_counts[ip]:
                del self.request_counts[ip]
    
    def _is_rate_limited(self, client_ip: str, current_time: float) -> bool:
        """Check if client is rate limited."""
        if client_ip not in self.request_counts:
            return False
        
        return len(self.request_counts[client_ip]) >= self.requests_per_minute
    
    def _record_request(self, client_ip: str, current_time: float) -> None:
        """Record a request for rate limiting."""
        if client_ip not in self.request_counts:
            self.request_counts[client_ip] = []
        
        self.request_counts[client_ip].append(current_time)


class PermissionMiddleware:
    """Middleware for checking permissions on specific endpoints."""
    
    def __init__(self):
        self.security = HTTPBearer()
    
    async def check_class_permission(
        self,
        request: Request,
        class_id: str,
        required_access: str = "read"
    ) -> User:
        """Check if user has permission to access a class."""
        user = await self._get_authenticated_user(request)
        
        db = SessionLocal()
        try:
            from .permissions import get_permission_service
            permission_service = get_permission_service(db)
            
            access_result = permission_service.check_class_access(user, class_id)
            
            if not access_result["has_access"]:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Access denied: {access_result['reason']}"
                )
            
            # For write operations, check if user can manage
            if required_access == "write" and user.role == "student":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Students cannot modify class data"
                )
            
            return user
            
        finally:
            db.close()
    
    async def check_document_permission(
        self,
        request: Request,
        document_id: str,
        required_access: str = "read"
    ) -> User:
        """Check if user has permission to access a document."""
        user = await self._get_authenticated_user(request)
        
        db = SessionLocal()
        try:
            from .permissions import get_permission_service
            permission_service = get_permission_service(db)
            
            access_result = permission_service.check_document_access(user, document_id)
            
            if not access_result["has_access"]:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Access denied: {access_result['reason']}"
                )
            
            # For write operations, check management permissions
            if required_access == "write" and not access_result["can_manage"]:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Insufficient permissions to modify document"
                )
            
            return user
            
        finally:
            db.close()
    
    async def _get_authenticated_user(self, request: Request) -> User:
        """Get authenticated user from request."""
        # Extract token from Authorization header
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Missing or invalid authorization header"
            )
        
        token = auth_header.split(" ")[1]
        token_data = verify_token(token)
        
        if not token_data:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token"
            )
        
        # Get user from database
        db = SessionLocal()
        try:
            auth_service = AuthService(db)
            user = auth_service.get_user_by_id(token_data.user_id)
            
            if not user or not user.is_active:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="User not found or inactive"
                )
            
            return user
            
        finally:
            db.close()


# Global middleware instances
permission_middleware = PermissionMiddleware()


# Dependency functions for FastAPI
async def require_class_access(class_id: str, access_type: str = "read"):
    """Dependency factory for class access control."""
    
    async def check_access(request: Request) -> User:
        return await permission_middleware.check_class_permission(request, class_id, access_type)
    
    return check_access


async def require_document_access(document_id: str, access_type: str = "read"):
    """Dependency factory for document access control."""
    
    async def check_access(request: Request) -> User:
        return await permission_middleware.check_document_permission(request, document_id, access_type)
    
    return check_access


class SecurityConfig:
    """Security configuration settings."""
    
    # JWT settings
    JWT_SECRET_KEY = "your-secret-key-change-in-production"
    JWT_ALGORITHM = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES = 60
    
    # Rate limiting
    RATE_LIMIT_REQUESTS_PER_MINUTE = 60
    RATE_LIMIT_BURST = 10
    
    # CORS settings
    CORS_ORIGINS = ["http://localhost:3000", "http://localhost:8080"]
    CORS_METHODS = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    CORS_HEADERS = ["*"]
    
    # Security headers
    SECURITY_HEADERS = {
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "X-XSS-Protection": "1; mode=block",
        "Referrer-Policy": "strict-origin-when-cross-origin"
    }
    
    # Content Security Policy
    CSP_POLICY = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline'; "
        "style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data: https:; "
        "font-src 'self'; "
        "connect-src 'self'; "
        "frame-ancestors 'none';"
    )
    
    @classmethod
    def get_cors_config(cls):
        """Get CORS configuration."""
        return {
            "allow_origins": cls.CORS_ORIGINS,
            "allow_credentials": True,
            "allow_methods": cls.CORS_METHODS,
            "allow_headers": cls.CORS_HEADERS,
        }