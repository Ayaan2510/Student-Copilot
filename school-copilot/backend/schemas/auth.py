"""Authentication schemas."""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class LoginRequest(BaseModel):
    """Login request schema."""
    email: str
    password: Optional[str] = None
    domain: str


class TokenData(BaseModel):
    """JWT token data schema."""
    user_id: str
    email: str
    role: str
    exp: datetime


class UserInfo(BaseModel):
    """User information schema."""
    id: str
    email: str
    name: str
    role: str
    is_active: bool
    created_at: datetime
    last_login: Optional[datetime] = None


class AuthResponse(BaseModel):
    """Authentication response schema."""
    token: str
    user: UserInfo
    role: str
    expires_at: datetime
    
    class Config:
        from_attributes = True