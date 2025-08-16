"""FastAPI dependencies for authentication and authorization."""

from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from ..models.database import get_db
from ..models.models import User
from ..schemas.auth import TokenData
from .jwt_handler import verify_token
from .auth_service import AuthService


# Security scheme for JWT tokens
security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    """Get current authenticated user from JWT token."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        token = credentials.credentials
        token_data: Optional[TokenData] = verify_token(token)
        
        if token_data is None:
            raise credentials_exception
        
        # Get user from database
        auth_service = AuthService(db)
        user = auth_service.get_user_by_id(token_data.user_id)
        
        if user is None or not user.is_active:
            raise credentials_exception
        
        # Update user activity
        auth_service.update_user_activity(user.id)
        
        return user
        
    except Exception:
        raise credentials_exception


def require_role(required_role: str):
    """Dependency factory for role-based access control."""
    
    async def role_checker(current_user: User = Depends(get_current_user)) -> User:
        """Check if current user has required role."""
        # Role hierarchy: admin > teacher > student
        role_hierarchy = {
            "admin": 3,
            "teacher": 2,
            "student": 1
        }
        
        user_level = role_hierarchy.get(current_user.role, 0)
        required_level = role_hierarchy.get(required_role, 0)
        
        if user_level < required_level:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Insufficient permissions. Required role: {required_role}"
            )
        
        return current_user
    
    return role_checker


# Convenience dependencies for specific roles
async def get_current_teacher(current_user: User = Depends(require_role("teacher"))) -> User:
    """Get current user if they are a teacher or admin."""
    return current_user


async def get_current_student(current_user: User = Depends(get_current_user)) -> User:
    """Get current user (any authenticated user can be a student)."""
    return current_user


async def get_current_admin(current_user: User = Depends(require_role("admin"))) -> User:
    """Get current user if they are an admin."""
    return current_user


class PermissionChecker:
    """Class for checking specific permissions."""
    
    def __init__(self, db: Session):
        self.db = db
        self.auth_service = AuthService(db)
    
    def can_access_class(self, user: User, class_id: str) -> bool:
        """Check if user can access a specific class."""
        if user.role == "admin":
            return True
        
        if user.role == "teacher":
            # Teachers can access classes they teach
            from ..models.models import Class
            class_obj = self.db.query(Class).filter(
                Class.id == class_id,
                Class.teacher_id == user.id
            ).first()
            return class_obj is not None
        
        if user.role == "student":
            # Students can access classes they're enrolled in
            from ..models.models import StudentAccess
            access = self.db.query(StudentAccess).filter(
                StudentAccess.student_id == user.id,
                StudentAccess.class_id == class_id,
                StudentAccess.enabled == True
            ).first()
            return access is not None
        
        return False
    
    def can_manage_document(self, user: User, document_id: str) -> bool:
        """Check if user can manage a specific document."""
        if user.role == "admin":
            return True
        
        if user.role == "teacher":
            # Teachers can manage documents assigned to their classes
            from ..models.models import Document, Class
            document = self.db.query(Document).filter(Document.id == document_id).first()
            if not document:
                return False
            
            # Check if any of the document's assigned classes belong to this teacher
            for class_obj in document.assigned_classes:
                if class_obj.teacher_id == user.id:
                    return True
        
        return False
    
    def can_view_audit_logs(self, user: User, class_id: Optional[str] = None) -> bool:
        """Check if user can view audit logs."""
        if user.role == "admin":
            return True
        
        if user.role == "teacher":
            if class_id:
                return self.can_access_class(user, class_id)
            else:
                # Teachers can view logs for all their classes
                return True
        
        return False


def get_permission_checker(db: Session = Depends(get_db)) -> PermissionChecker:
    """Get permission checker instance."""
    return PermissionChecker(db)