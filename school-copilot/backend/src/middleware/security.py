"""
Security Middleware and Headers
Comprehensive security hardening for the FastAPI backend
"""

import re
import time
import hashlib
import secrets
from typing import Dict, List, Optional, Set
from datetime import datetime, timedelta
from fastapi import FastAPI, Request, Response, HTTPException, status
from fastapi.middleware.base import BaseHTTPMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.cors import CORSMiddleware
from starlette.middleware.trustedhost import TrustedHostMiddleware
import logging

logger = logging.getLogger(__name__)

# Security configuration
class SecurityConfig:
    # Content Security Policy
    CSP_POLICY = {
        "default-src": ["'self'"],
        "script-src": ["'self'", "'unsafe-inline'", "https://apis.google.com"],
        "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        "font-src": ["'self'", "https://fonts.gstatic.com"],
        "img-src": ["'self'", "data:", "https:"],
        "connect-src": ["'self'", "https://api.openai.com", "wss:"],
        "frame-ancestors": ["'none'"],
        "base-uri": ["'self'"],
        "form-action": ["'self'"],
        "upgrade-insecure-requests": []
    }
    
    # Rate limiting configuration
    RATE_LIMITS = {
        "default": {"requests": 100, "window": 60},  # 100 requests per minute
        "auth": {"requests": 5, "window": 60},       # 5 auth attempts per minute
        "query": {"requests": 30, "window": 60},     # 30 queries per minute
        "upload": {"requests": 10, "window": 300},   # 10 uploads per 5 minutes
    }
    
    # Trusted hosts
    TRUSTED_HOSTS = [
        "localhost",
        "127.0.0.1",
        "*.school-copilot.com",
        "school-copilot.com"
    ]
    
    # Security headers
    SECURITY_HEADERS = {
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "X-XSS-Protection": "1; mode=block",
        "Referrer-Policy": "strict-origin-when-cross-origin",
        "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
        "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        "Pragma": "no-cache",
        "Expires": "0"
    }

# Rate limiting store
class RateLimitStore:
    def __init__(self):
        self.requests: Dict[str, List[float]] = {}
        self.blocked_ips: Dict[str, float] = {}
    
    def is_rate_limited(self, key: str, limit: int, window: int) -> bool:
        now = time.time()
        
        # Check if IP is temporarily blocked
        if key in self.blocked_ips:
            if now < self.blocked_ips[key]:
                return True
            else:
                del self.blocked_ips[key]
        
        # Get request history for this key
        if key not in self.requests:
            self.requests[key] = []
        
        # Remove old requests outside the window
        self.requests[key] = [req_time for req_time in self.requests[key] 
                             if now - req_time < window]
        
        # Check if limit exceeded
        if len(self.requests[key]) >= limit:
            # Block IP for additional time if severely over limit
            if len(self.requests[key]) > limit * 2:
                self.blocked_ips[key] = now + 300  # Block for 5 minutes
            return True
        
        # Add current request
        self.requests[key].append(now)
        return False
    
    def get_remaining(self, key: str, limit: int, window: int) -> int:
        now = time.time()
        if key not in self.requests:
            return limit
        
        # Count valid requests in window
        valid_requests = [req_time for req_time in self.requests[key] 
                         if now - req_time < window]
        
        return max(0, limit - len(valid_requests))
    
    def clear_expired(self):
        """Clean up expired entries"""
        now = time.time()
        
        # Clean request history
        for key in list(self.requests.keys()):
            self.requests[key] = [req_time for req_time in self.requests[key] 
                                 if now - req_time < 3600]  # Keep 1 hour history
            if not self.requests[key]:
                del self.requests[key]
        
        # Clean blocked IPs
        for key in list(self.blocked_ips.keys()):
            if now >= self.blocked_ips[key]:
                del self.blocked_ips[key]

# Input validation patterns
class InputValidator:
    # Dangerous patterns to block
    XSS_PATTERNS = [
        re.compile(r'<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>', re.IGNORECASE),
        re.compile(r'javascript:', re.IGNORECASE),
        re.compile(r'vbscript:', re.IGNORECASE),
        re.compile(r'on\w+\s*=', re.IGNORECASE),
        re.compile(r'<iframe\b', re.IGNORECASE),
        re.compile(r'<object\b', re.IGNORECASE),
        re.compile(r'<embed\b', re.IGNORECASE),
    ]
    
    SQL_INJECTION_PATTERNS = [
        re.compile(r'\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b', re.IGNORECASE),
        re.compile(r'[\'";]|--|\*|\|'),
        re.compile(r'\b(OR|AND)\s+\d+\s*=\s*\d+', re.IGNORECASE),
    ]
    
    COMMAND_INJECTION_PATTERNS = [
        re.compile(r'[;&|`$(){}[\]]'),
        re.compile(r'\b(eval|exec|system|shell_exec|passthru)\b', re.IGNORECASE),
    ]
    
    PATH_TRAVERSAL_PATTERNS = [
        re.compile(r'\.\.[\/\\]'),
        re.compile(r'[\/\\]etc[\/\\]'),
        re.compile(r'[\/\\]proc[\/\\]'),
    ]
    
    @classmethod
    def is_suspicious(cls, text: str) -> tuple[bool, str]:
        """Check if text contains suspicious patterns"""
        if not isinstance(text, str):
            return False, ""
        
        # Check XSS patterns
        for pattern in cls.XSS_PATTERNS:
            if pattern.search(text):
                return True, "XSS_DETECTED"
        
        # Check SQL injection patterns
        for pattern in cls.SQL_INJECTION_PATTERNS:
            if pattern.search(text):
                return True, "SQL_INJECTION_DETECTED"
        
        # Check command injection patterns
        for pattern in cls.COMMAND_INJECTION_PATTERNS:
            if pattern.search(text):
                return True, "COMMAND_INJECTION_DETECTED"
        
        # Check path traversal patterns
        for pattern in cls.PATH_TRAVERSAL_PATTERNS:
            if pattern.search(text):
                return True, "PATH_TRAVERSAL_DETECTED"
        
        return False, ""
    
    @classmethod
    def sanitize_input(cls, text: str) -> str:
        """Sanitize input by removing dangerous patterns"""
        if not isinstance(text, str):
            return str(text)
        
        # Remove XSS patterns
        for pattern in cls.XSS_PATTERNS:
            text = pattern.sub('', text)
        
        # Remove SQL injection patterns
        for pattern in cls.SQL_INJECTION_PATTERNS:
            text = pattern.sub('', text)
        
        # Remove command injection patterns
        for pattern in cls.COMMAND_INJECTION_PATTERNS:
            text = pattern.sub('', text)
        
        # Remove path traversal patterns
        for pattern in cls.PATH_TRAVERSAL_PATTERNS:
            text = pattern.sub('', text)
        
        return text.strip()

# Security middleware
class SecurityMiddleware(BaseHTTPMiddleware):
    def __init__(self, app: FastAPI, config: SecurityConfig = None):
        super().__init__(app)
        self.config = config or SecurityConfig()
        self.rate_limit_store = RateLimitStore()
        self.validator = InputValidator()
        
        # Start cleanup task
        self._setup_cleanup_task()
    
    def _setup_cleanup_task(self):
        """Set up periodic cleanup of rate limit store"""
        import asyncio
        import threading
        
        def cleanup_task():
            while True:
                time.sleep(300)  # Clean every 5 minutes
                self.rate_limit_store.clear_expired()
        
        cleanup_thread = threading.Thread(target=cleanup_task, daemon=True)
        cleanup_thread.start()
    
    async def dispatch(self, request: Request, call_next):
        # Get client IP
        client_ip = self._get_client_ip(request)
        
        # Apply rate limiting
        rate_limit_result = self._check_rate_limit(request, client_ip)
        if rate_limit_result:
            return rate_limit_result
        
        # Validate input
        validation_result = await self._validate_input(request)
        if validation_result:
            return validation_result
        
        # Process request
        response = await call_next(request)
        
        # Add security headers
        self._add_security_headers(response)
        
        return response
    
    def _get_client_ip(self, request: Request) -> str:
        """Get client IP address with proxy support"""
        # Check for forwarded headers (in order of preference)
        forwarded_headers = [
            "X-Forwarded-For",
            "X-Real-IP",
            "CF-Connecting-IP",  # Cloudflare
            "X-Client-IP"
        ]
        
        for header in forwarded_headers:
            if header in request.headers:
                # Take the first IP in case of multiple
                ip = request.headers[header].split(',')[0].strip()
                if self._is_valid_ip(ip):
                    return ip
        
        # Fallback to direct connection
        return request.client.host if request.client else "unknown"
    
    def _is_valid_ip(self, ip: str) -> bool:
        """Validate IP address format"""
        import ipaddress
        try:
            ipaddress.ip_address(ip)
            return True
        except ValueError:
            return False
    
    def _check_rate_limit(self, request: Request, client_ip: str) -> Optional[Response]:
        """Check and apply rate limiting"""
        # Determine rate limit category
        path = request.url.path
        if path.startswith("/api/auth"):
            category = "auth"
        elif path.startswith("/api/query"):
            category = "query"
        elif path.startswith("/api/docs/upload"):
            category = "upload"
        else:
            category = "default"
        
        # Get rate limit config
        limit_config = self.config.RATE_LIMITS[category]
        limit = limit_config["requests"]
        window = limit_config["window"]
        
        # Create rate limit key
        rate_key = f"{client_ip}:{category}"
        
        # Check rate limit
        if self.rate_limit_store.is_rate_limited(rate_key, limit, window):
            remaining = self.rate_limit_store.get_remaining(rate_key, limit, window)
            
            logger.warning(f"Rate limit exceeded for {client_ip} on {path}")
            
            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={
                    "error": "Rate limit exceeded",
                    "message": f"Too many requests. Try again later.",
                    "retry_after": window
                },
                headers={
                    "Retry-After": str(window),
                    "X-RateLimit-Limit": str(limit),
                    "X-RateLimit-Remaining": str(remaining),
                    "X-RateLimit-Reset": str(int(time.time() + window))
                }
            )
        
        return None
    
    async def _validate_input(self, request: Request) -> Optional[Response]:
        """Validate request input for security threats"""
        try:
            # Check URL path
            suspicious, threat_type = self.validator.is_suspicious(str(request.url))
            if suspicious:
                logger.warning(f"Suspicious URL detected: {request.url} - {threat_type}")
                return JSONResponse(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    content={"error": "Invalid request", "code": "SUSPICIOUS_INPUT"}
                )
            
            # Check query parameters
            for key, value in request.query_params.items():
                suspicious, threat_type = self.validator.is_suspicious(f"{key}={value}")
                if suspicious:
                    logger.warning(f"Suspicious query parameter: {key}={value} - {threat_type}")
                    return JSONResponse(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        content={"error": "Invalid query parameter", "code": threat_type}
                    )
            
            # Check headers for suspicious content
            for header_name, header_value in request.headers.items():
                if header_name.lower() not in ['user-agent', 'accept', 'accept-language']:
                    suspicious, threat_type = self.validator.is_suspicious(header_value)
                    if suspicious:
                        logger.warning(f"Suspicious header: {header_name}={header_value} - {threat_type}")
                        return JSONResponse(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            content={"error": "Invalid header", "code": threat_type}
                        )
            
            # Check request body for POST/PUT requests
            if request.method in ["POST", "PUT", "PATCH"]:
                content_type = request.headers.get("content-type", "")
                
                if "application/json" in content_type:
                    # For JSON requests, we'll validate after parsing
                    pass
                elif "multipart/form-data" in content_type:
                    # For file uploads, basic validation
                    pass
                else:
                    # For other content types, read and validate
                    body = await request.body()
                    if body:
                        body_str = body.decode('utf-8', errors='ignore')
                        suspicious, threat_type = self.validator.is_suspicious(body_str)
                        if suspicious:
                            logger.warning(f"Suspicious request body - {threat_type}")
                            return JSONResponse(
                                status_code=status.HTTP_400_BAD_REQUEST,
                                content={"error": "Invalid request body", "code": threat_type}
                            )
            
        except Exception as e:
            logger.error(f"Error validating input: {e}")
            # Don't block request on validation errors, but log them
        
        return None
    
    def _add_security_headers(self, response: Response):
        """Add security headers to response"""
        # Add all security headers
        for header, value in self.config.SECURITY_HEADERS.items():
            response.headers[header] = value
        
        # Add CSP header
        csp_parts = []
        for directive, sources in self.config.CSP_POLICY.items():
            if sources:
                csp_parts.append(f"{directive} {' '.join(sources)}")
            else:
                csp_parts.append(directive)
        
        response.headers["Content-Security-Policy"] = "; ".join(csp_parts)
        
        # Add nonce for inline scripts if needed
        nonce = secrets.token_urlsafe(16)
        response.headers["X-CSP-Nonce"] = nonce

# HTTPS enforcement middleware
class HTTPSRedirectMiddleware(BaseHTTPMiddleware):
    def __init__(self, app: FastAPI, force_https: bool = True):
        super().__init__(app)
        self.force_https = force_https
    
    async def dispatch(self, request: Request, call_next):
        if self.force_https and request.url.scheme != "https":
            # Check if this is a health check or local development
            if request.url.hostname in ["localhost", "127.0.0.1"] or request.url.path == "/health":
                return await call_next(request)
            
            # Redirect to HTTPS
            https_url = request.url.replace(scheme="https")
            return Response(
                status_code=status.HTTP_301_MOVED_PERMANENTLY,
                headers={"Location": str(https_url)}
            )
        
        return await call_next(request)

# CSRF protection
class CSRFProtection:
    def __init__(self, secret_key: str):
        self.secret_key = secret_key
    
    def generate_token(self, session_id: str) -> str:
        """Generate CSRF token for session"""
        timestamp = str(int(time.time()))
        data = f"{session_id}:{timestamp}:{self.secret_key}"
        token = hashlib.sha256(data.encode()).hexdigest()
        return f"{timestamp}:{token}"
    
    def validate_token(self, token: str, session_id: str, max_age: int = 3600) -> bool:
        """Validate CSRF token"""
        try:
            timestamp_str, token_hash = token.split(":", 1)
            timestamp = int(timestamp_str)
            
            # Check if token is expired
            if time.time() - timestamp > max_age:
                return False
            
            # Regenerate expected token
            data = f"{session_id}:{timestamp_str}:{self.secret_key}"
            expected_hash = hashlib.sha256(data.encode()).hexdigest()
            
            # Compare tokens
            return secrets.compare_digest(token_hash, expected_hash)
            
        except (ValueError, IndexError):
            return False

# Security utilities
class SecurityUtils:
    @staticmethod
    def generate_secure_token(length: int = 32) -> str:
        """Generate cryptographically secure random token"""
        return secrets.token_urlsafe(length)
    
    @staticmethod
    def hash_password(password: str, salt: str = None) -> tuple[str, str]:
        """Hash password with salt"""
        if salt is None:
            salt = secrets.token_hex(16)
        
        # Use PBKDF2 with SHA-256
        import hashlib
        import binascii
        
        pwdhash = hashlib.pbkdf2_hmac('sha256', 
                                     password.encode('utf-8'), 
                                     salt.encode('ascii'), 
                                     100000)  # 100k iterations
        
        return binascii.hexlify(pwdhash).decode('ascii'), salt
    
    @staticmethod
    def verify_password(password: str, hashed: str, salt: str) -> bool:
        """Verify password against hash"""
        expected_hash, _ = SecurityUtils.hash_password(password, salt)
        return secrets.compare_digest(hashed, expected_hash)
    
    @staticmethod
    def sanitize_filename(filename: str) -> str:
        """Sanitize filename for safe storage"""
        # Remove path components
        filename = filename.split('/')[-1].split('\\')[-1]
        
        # Remove dangerous characters
        filename = re.sub(r'[^a-zA-Z0-9\-_. ]', '', filename)
        
        # Limit length
        if len(filename) > 255:
            name, ext = filename.rsplit('.', 1) if '.' in filename else (filename, '')
            filename = name[:250] + ('.' + ext if ext else '')
        
        return filename
    
    @staticmethod
    def is_safe_redirect_url(url: str, allowed_hosts: List[str]) -> bool:
        """Check if redirect URL is safe"""
        try:
            from urllib.parse import urlparse
            parsed = urlparse(url)
            
            # Must be relative or to allowed host
            if not parsed.netloc:
                return True  # Relative URL
            
            return any(parsed.netloc == host or parsed.netloc.endswith('.' + host) 
                      for host in allowed_hosts)
        except:
            return False

# Setup function for FastAPI app
def setup_security(app: FastAPI, config: SecurityConfig = None, force_https: bool = True):
    """Set up all security middleware and configurations"""
    config = config or SecurityConfig()
    
    # Add HTTPS redirect middleware (first)
    if force_https:
        app.add_middleware(HTTPSRedirectMiddleware, force_https=force_https)
    
    # Add trusted host middleware
    app.add_middleware(
        TrustedHostMiddleware, 
        allowed_hosts=config.TRUSTED_HOSTS
    )
    
    # Add CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["https://school-copilot.com"],  # Specific origins only
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE"],
        allow_headers=["*"],
        max_age=3600,
    )
    
    # Add security middleware (last)
    app.add_middleware(SecurityMiddleware, config=config)
    
    logger.info("Security middleware configured successfully")

# Export main components
__all__ = [
    'SecurityConfig',
    'SecurityMiddleware', 
    'HTTPSRedirectMiddleware',
    'CSRFProtection',
    'SecurityUtils',
    'InputValidator',
    'setup_security'
]