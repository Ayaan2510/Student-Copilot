"""Authentication service for user management."""

import uuid
from datetime import datetime, timedelta
from typing import Optional, List
from sqlalchemy.orm import Session

from ..models.models import User
from ..schemas.auth import LoginRequest, AuthResponse, UserInfo
from ..utils.validation import ValidationUtils
from .jwt_handler import jwt_handler


class AuthService:
    """Service for handling authentication operations."""
    
    def __init__(self, db: Session):
        self.db = db
    
    async def authenticate_user(self, login_request: LoginRequest) -> Optional[AuthResponse]:
        """Authenticate user and return auth response."""
        # Validate email domain
        allowed_domains = ["example.edu"]  # TODO: Load from config
        if not ValidationUtils.validate_email_domain(login_request.email, allowed_domains):
            return None
        
        # Find user by email
        user = self.db.query(User).filter(User.email == login_request.email).first()
        
        if not user or not user.is_active:
            return None
        
        # For now, we'll use placeholder authentication
        # In production, this would integrate with SSO or verify password
        if login_request.password:
            if not jwt_handler.verify_password(login_request.password, user.hashed_password or ""):
                return None
        
        # Update last login
        user.last_login = datetime.utcnow()
        self.db.commit()
        
        # Create token
        token = jwt_handler.create_user_token(user)
        expires_at = datetime.utcnow() + timedelta(minutes=jwt_handler.access_token_expire_minutes)
        
        return AuthResponse(
            token=token,
            user=UserInfo(
                id=user.id,
                email=user.email,
                name=user.name,
                role=user.role,
                is_active=user.is_active,
                created_at=user.created_at,
                last_login=user.last_login
            ),
            role=user.role,
            expires_at=expires_at
        )
    
    def create_user(self, email: str, name: str, role: str, password: Optional[str] = None) -> User:
        """Create new user."""
        user_id = str(uuid.uuid4())
        
        hashed_password = None
        if password:
            hashed_password = jwt_handler.hash_password(password)
        
        user = User(
            id=user_id,
            email=email,
            name=name,
            role=role,
            hashed_password=hashed_password,
            is_active=True,
            created_at=datetime.utcnow()
        )
        
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        
        return user
    
    def get_user_by_id(self, user_id: str) -> Optional[User]:
        """Get user by ID."""
        return self.db.query(User).filter(User.id == user_id).first()
    
    def get_user_by_email(self, email: str) -> Optional[User]:
        """Get user by email."""
        return self.db.query(User).filter(User.email == email).first()
    
    def update_user_activity(self, user_id: str) -> None:
        """Update user's last activity timestamp."""
        user = self.get_user_by_id(user_id)
        if user:
            user.last_login = datetime.utcnow()
            self.db.commit()
    
    def deactivate_user(self, user_id: str) -> bool:
        """Deactivate user account."""
        user = self.get_user_by_id(user_id)
        if user:
            user.is_active = False
            self.db.commit()
            return True
        return False
    
    def check_user_permissions(self, user_id: str, required_role: str) -> bool:
        """Check if user has required role permissions."""
        user = self.get_user_by_id(user_id)
        if not user or not user.is_active:
            return False
        
        # Role hierarchy: admin > teacher > student
        role_hierarchy = {
            "admin": 3,
            "teacher": 2,
            "student": 1
        }
        
        user_level = role_hierarchy.get(user.role, 0)
        required_level = role_hierarchy.get(required_role, 0)
        
        return user_level >= required_level
    
    def get_users_by_role(self, role: str) -> List[User]:
        """Get all users with specific role."""
        return self.db.query(User).filter(User.role == role, User.is_active == True).all()
    
    def create_demo_users(self) -> None:
        """Create demo users for development/testing."""
        # Create demo teacher
        if not self.get_user_by_email("teacher@example.edu"):
            self.create_user(
                email="teacher@example.edu",
                name="Demo Teacher",
                role="teacher",
                password="demo123"
            )
        
        # Create demo student
        if not self.get_user_by_email("student@example.edu"):
            self.create_user(
                email="student@example.edu",
                name="Demo Student",
                role="student",
                password="demo123"
            )
        
        # Create demo admin
        if not self.get_user_by_email("admin@example.edu"):
            self.create_user(
                email="admin@example.edu",
                name="Demo Admin",
                role="admin",
                password="admin123"
            )