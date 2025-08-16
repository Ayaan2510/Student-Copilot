"""JWT token handling utilities."""

import os
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from jose import JWTError, jwt
from passlib.context import CryptContext

from ..schemas.auth import TokenData
from ..models.models import User


class JWTHandler:
    """JWT token handler for authentication."""
    
    def __init__(self):
        self.secret_key = os.getenv("JWT_SECRET_KEY", "your-secret-key-change-in-production")
        self.algorithm = "HS256"
        self.access_token_expire_minutes = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))
        self.pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    
    def create_access_token(self, data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
        """Create JWT access token."""
        to_encode = data.copy()
        
        if expires_delta:
            expire = datetime.utcnow() + expires_delta
        else:
            expire = datetime.utcnow() + timedelta(minutes=self.access_token_expire_minutes)
        
        to_encode.update({"exp": expire})
        encoded_jwt = jwt.encode(to_encode, self.secret_key, algorithm=self.algorithm)
        return encoded_jwt
    
    def verify_token(self, token: str) -> Optional[TokenData]:
        """Verify and decode JWT token."""
        try:
            payload = jwt.decode(token, self.secret_key, algorithms=[self.algorithm])
            user_id: str = payload.get("sub")
            email: str = payload.get("email")
            role: str = payload.get("role")
            exp: datetime = datetime.fromtimestamp(payload.get("exp"))
            
            if user_id is None or email is None or role is None:
                return None
            
            return TokenData(
                user_id=user_id,
                email=email,
                role=role,
                exp=exp
            )
        except JWTError:
            return None
    
    def hash_password(self, password: str) -> str:
        """Hash password using bcrypt."""
        return self.pwd_context.hash(password)
    
    def verify_password(self, plain_password: str, hashed_password: str) -> bool:
        """Verify password against hash."""
        return self.pwd_context.verify(plain_password, hashed_password)
    
    def create_user_token(self, user: User) -> str:
        """Create token for user."""
        token_data = {
            "sub": user.id,
            "email": user.email,
            "role": user.role,
            "iat": datetime.utcnow(),
        }
        return self.create_access_token(token_data)


# Global JWT handler instance
jwt_handler = JWTHandler()

# Convenience functions
def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """Create access token using global handler."""
    return jwt_handler.create_access_token(data, expires_delta)

def verify_token(token: str) -> Optional[TokenData]:
    """Verify token using global handler."""
    return jwt_handler.verify_token(token)