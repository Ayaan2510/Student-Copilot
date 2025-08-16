"""Permission checking service for fine-grained access control."""

from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from datetime import datetime, date

from ..models.models import User, Class, Document, StudentAccess, AuditLog
from ..schemas.auth import TokenData


class PermissionService:
    """Service for checking user permissions and access control."""
    
    def __init__(self, db: Session):
        self.db = db
    
    def check_class_access(self, user: User, class_id: str) -> Dict[str, Any]:
        """Check if user can access a specific class."""
        result = {
            "has_access": False,
            "reason": None,
            "class_enabled": False,
            "student_enabled": False,
            "remaining_questions": 0,
            "daily_limit": 0,
            "blocked_terms": []
        }
        
        # Get class information
        class_obj = self.db.query(Class).filter(Class.id == class_id).first()
        if not class_obj:
            result["reason"] = "Class not found"
            return result
        
        result["class_enabled"] = class_obj.enabled
        result["daily_limit"] = class_obj.daily_question_limit
        result["blocked_terms"] = class_obj.blocked_terms or []
        
        # Admin has access to everything
        if user.role == "admin":
            result["has_access"] = True
            result["remaining_questions"] = result["daily_limit"]
            return result
        
        # Teacher access - can access classes they teach
        if user.role == "teacher":
            if class_obj.teacher_id == user.id:
                result["has_access"] = True
                result["remaining_questions"] = result["daily_limit"]
                return result
            else:
                result["reason"] = "Not authorized to access this class"
                return result
        
        # Student access - check enrollment and permissions
        if user.role == "student":
            if not class_obj.enabled:
                result["reason"] = "Class is disabled"
                return result
            
            # Check student access record
            student_access = self.db.query(StudentAccess).filter(
                StudentAccess.student_id == user.id,
                StudentAccess.class_id == class_id
            ).first()
            
            if not student_access:
                result["reason"] = "Not enrolled in this class"
                return result
            
            result["student_enabled"] = student_access.enabled
            
            if not student_access.enabled:
                result["reason"] = "Student access is disabled"
                return result
            
            # Check daily question limit
            today = date.today()
            if student_access.last_question_date == today:
                questions_used = student_access.daily_question_count
            else:
                questions_used = 0
            
            remaining = max(0, result["daily_limit"] - questions_used)
            result["remaining_questions"] = remaining
            
            if remaining <= 0:
                result["reason"] = "Daily question limit exceeded"
                return result
            
            result["has_access"] = True
            return result
        
        result["reason"] = "Invalid user role"
        return result
    
    def check_document_access(self, user: User, document_id: str) -> Dict[str, Any]:
        """Check if user can access a specific document."""
        result = {
            "has_access": False,
            "reason": None,
            "can_manage": False,
            "assigned_classes": []
        }
        
        # Get document
        document = self.db.query(Document).filter(Document.id == document_id).first()
        if not document:
            result["reason"] = "Document not found"
            return result
        
        result["assigned_classes"] = [cls.id for cls in document.assigned_classes]
        
        # Admin has full access
        if user.role == "admin":
            result["has_access"] = True
            result["can_manage"] = True
            return result
        
        # Teacher access - can access documents assigned to their classes
        if user.role == "teacher":
            teacher_classes = self.db.query(Class).filter(Class.teacher_id == user.id).all()
            teacher_class_ids = {cls.id for cls in teacher_classes}
            
            document_class_ids = {cls.id for cls in document.assigned_classes}
            
            if teacher_class_ids.intersection(document_class_ids):
                result["has_access"] = True
                result["can_manage"] = True
                return result
            else:
                result["reason"] = "Document not assigned to your classes"
                return result
        
        # Student access - can access documents assigned to classes they're enrolled in
        if user.role == "student":
            # Get student's accessible classes
            student_classes = self.db.query(StudentAccess).filter(
                StudentAccess.student_id == user.id,
                StudentAccess.enabled == True
            ).all()
            
            student_class_ids = {access.class_id for access in student_classes}
            document_class_ids = {cls.id for cls in document.assigned_classes}
            
            if student_class_ids.intersection(document_class_ids):
                result["has_access"] = True
                result["can_manage"] = False
                return result
            else:
                result["reason"] = "Document not available in your classes"
                return result
        
        result["reason"] = "Invalid user role"
        return result
    
    def check_audit_log_access(self, user: User, class_id: Optional[str] = None, student_id: Optional[str] = None) -> Dict[str, Any]:
        """Check if user can access audit logs."""
        result = {
            "has_access": False,
            "reason": None,
            "can_view_all": False,
            "accessible_classes": []
        }
        
        # Admin has full access
        if user.role == "admin":
            result["has_access"] = True
            result["can_view_all"] = True
            return result
        
        # Teacher access - can view logs for their classes
        if user.role == "teacher":
            teacher_classes = self.db.query(Class).filter(Class.teacher_id == user.id).all()
            accessible_class_ids = [cls.id for cls in teacher_classes]
            result["accessible_classes"] = accessible_class_ids
            
            if class_id:
                if class_id in accessible_class_ids:
                    result["has_access"] = True
                    return result
                else:
                    result["reason"] = "Cannot access logs for this class"
                    return result
            else:
                result["has_access"] = True
                return result
        
        # Students cannot access audit logs
        if user.role == "student":
            result["reason"] = "Students cannot access audit logs"
            return result
        
        result["reason"] = "Invalid user role"
        return result
    
    def increment_question_count(self, user_id: str, class_id: str) -> bool:
        """Increment daily question count for student."""
        if not user_id or not class_id:
            return False
        
        try:
            student_access = self.db.query(StudentAccess).filter(
                StudentAccess.student_id == user_id,
                StudentAccess.class_id == class_id
            ).first()
            
            if not student_access:
                return False
            
            today = date.today()
            
            # Reset count if it's a new day
            if student_access.last_question_date != today:
                student_access.daily_question_count = 0
                student_access.last_question_date = today
            
            # Increment count
            student_access.daily_question_count += 1
            student_access.updated_at = datetime.utcnow()
            
            self.db.commit()
            return True
            
        except Exception:
            self.db.rollback()
            return False
    
    def get_user_classes(self, user: User) -> List[Dict[str, Any]]:
        """Get classes accessible to user."""
        classes = []
        
        if user.role == "admin":
            # Admin can see all classes
            all_classes = self.db.query(Class).all()
            for cls in all_classes:
                classes.append({
                    "id": cls.id,
                    "name": cls.name,
                    "role": "admin",
                    "enabled": cls.enabled,
                    "daily_limit": cls.daily_question_limit
                })
        
        elif user.role == "teacher":
            # Teachers see classes they teach
            teacher_classes = self.db.query(Class).filter(Class.teacher_id == user.id).all()
            for cls in teacher_classes:
                classes.append({
                    "id": cls.id,
                    "name": cls.name,
                    "role": "teacher",
                    "enabled": cls.enabled,
                    "daily_limit": cls.daily_question_limit
                })
        
        elif user.role == "student":
            # Students see classes they're enrolled in
            student_access_records = self.db.query(StudentAccess).filter(
                StudentAccess.student_id == user.id
            ).all()
            
            for access in student_access_records:
                cls = self.db.query(Class).filter(Class.id == access.class_id).first()
                if cls:
                    today = date.today()
                    questions_used = access.daily_question_count if access.last_question_date == today else 0
                    remaining = max(0, cls.daily_question_limit - questions_used)
                    
                    classes.append({
                        "id": cls.id,
                        "name": cls.name,
                        "role": "student",
                        "enabled": cls.enabled and access.enabled,
                        "daily_limit": cls.daily_question_limit,
                        "questions_used": questions_used,
                        "remaining_questions": remaining
                    })
        
        return classes
    
    def validate_query_permissions(self, user: User, class_id: str, query: str) -> Dict[str, Any]:
        """Validate if user can submit a query to a class."""
        # Check basic class access
        access_result = self.check_class_access(user, class_id)
        
        if not access_result["has_access"]:
            return {
                "allowed": False,
                "reason": access_result["reason"],
                "blocked_term": None
            }
        
        # Check blocked terms for students
        if user.role == "student" and access_result["blocked_terms"]:
            query_lower = query.lower()
            for term in access_result["blocked_terms"]:
                if term.lower() in query_lower:
                    return {
                        "allowed": False,
                        "reason": "Query contains blocked content",
                        "blocked_term": term
                    }
        
        return {
            "allowed": True,
            "reason": None,
            "blocked_term": None,
            "remaining_questions": access_result["remaining_questions"]
        }
    
    def log_permission_check(self, user_id: str, resource_type: str, resource_id: str, granted: bool, reason: Optional[str] = None):
        """Log permission check for audit purposes."""
        try:
            # This could be expanded to create detailed permission audit logs
            # For now, we'll just track in the existing audit log system
            pass
        except Exception:
            # Don't fail the main operation if logging fails
            pass


def get_permission_service(db: Session) -> PermissionService:
    """Get permission service instance."""
    return PermissionService(db)