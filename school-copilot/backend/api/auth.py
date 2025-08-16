"""Authentication API endpoints."""

from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer
from sqlalchemy.orm import Session

from ..models.database import get_db
from ..models.models import User
from ..schemas.auth import LoginRequest, AuthResponse, UserInfo
from ..auth.auth_service import AuthService
from ..auth.dependencies import get_current_user, get_current_admin
from ..utils.validation import validate_login_request, ValidationError

router = APIRouter(prefix="/auth", tags=["authentication"])
security = HTTPBearer()


@router.post("/login", response_model=AuthResponse)
async def login(
    login_request: LoginRequest,
    db: Session = Depends(get_db)
):
    """Authenticate user and return JWT token."""
    try:
        # Validate login request
        validation_result = validate_login_request(login_request)
        if not validation_result["valid"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "message": "Invalid login request",
                    "errors": validation_result["errors"]
                }
            )
        
        # Authenticate user
        auth_service = AuthService(db)
        auth_response = await auth_service.authenticate_user(login_request)
        
        if not auth_response:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials or inactive account"
            )
        
        return auth_response
        
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=e.to_dict()
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Authentication service error"
        )


@router.get("/me", response_model=UserInfo)
async def get_current_user_info(
    current_user: User = Depends(get_current_user)
):
    """Get current authenticated user information."""
    return UserInfo(
        id=current_user.id,
        email=current_user.email,
        name=current_user.name,
        role=current_user.role,
        is_active=current_user.is_active,
        created_at=current_user.created_at,
        last_login=current_user.last_login
    )


@router.post("/refresh")
async def refresh_token(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Refresh JWT token for current user."""
    try:
        auth_service = AuthService(db)
        
        # Create new token
        from ..auth.jwt_handler import jwt_handler
        token = jwt_handler.create_user_token(current_user)
        expires_at = datetime.utcnow() + timedelta(minutes=jwt_handler.access_token_expire_minutes)
        
        return {
            "token": token,
            "expires_at": expires_at,
            "message": "Token refreshed successfully"
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Token refresh failed"
        )


@router.post("/logout")
async def logout(
    current_user: User = Depends(get_current_user)
):
    """Logout current user (client should discard token)."""
    return {
        "message": "Logged out successfully",
        "user_id": current_user.id
    }


@router.post("/create-demo-users")
async def create_demo_users(
    current_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Create demo users for development/testing (admin only)."""
    try:
        auth_service = AuthService(db)
        auth_service.create_demo_users()
        
        return {
            "message": "Demo users created successfully",
            "users": [
                {"email": "teacher@example.edu", "role": "teacher", "password": "demo123"},
                {"email": "student@example.edu", "role": "student", "password": "demo123"},
                {"email": "admin@example.edu", "role": "admin", "password": "admin123"}
            ]
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create demo users"
        )


@router.get("/check-permissions/{required_role}")
async def check_permissions(
    required_role: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Check if current user has required role permissions."""
    try:
        auth_service = AuthService(db)
        has_permission = auth_service.check_user_permissions(current_user.id, required_role)
        
        return {
            "user_id": current_user.id,
            "user_role": current_user.role,
            "required_role": required_role,
            "has_permission": has_permission
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Permission check failed"
        )


@router.post("/deactivate-user/{user_id}")
async def deactivate_user(
    user_id: str,
    current_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Deactivate user account (admin only)."""
    try:
        auth_service = AuthService(db)
        success = auth_service.deactivate_user(user_id)
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        return {
            "message": f"User {user_id} deactivated successfully",
            "deactivated_by": current_user.id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to deactivate user"
        )


@router.get("/users/{role}")
async def get_users_by_role(
    role: str,
    current_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Get all users with specific role (admin only)."""
    try:
        if role not in ["teacher", "student", "admin"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid role. Must be 'teacher', 'student', or 'admin'"
            )
        
        auth_service = AuthService(db)
        users = auth_service.get_users_by_role(role)
        
        return {
            "role": role,
            "count": len(users),
            "users": [
                {
                    "id": user.id,
                    "email": user.email,
                    "name": user.name,
                    "is_active": user.is_active,
                    "created_at": user.created_at,
                    "last_login": user.last_login
                }
                for user in users
            ]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve users"
        )


@router.get("/validate-token")
async def validate_token(
    current_user: User = Depends(get_current_user)
):
    """Validate current JWT token."""
    return {
        "valid": True,
        "user_id": current_user.id,
        "email": current_user.email,
        "role": current_user.role,
        "is_active": current_user.is_active,
        "message": "Token is valid"
    }