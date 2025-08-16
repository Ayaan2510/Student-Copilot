"""Class management API endpoints."""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..models.database import get_db
from ..models.models import User, Class, StudentAccess
from ..schemas.classes import (
    ClassCreate,
    ClassResponse,
    ClassUpdate,
    AccessRequest,
    StudentAccessResponse
)
from ..auth.dependencies import get_current_teacher, get_current_user, get_permission_checker, PermissionChecker


router = APIRouter()


@router.post("/", response_model=ClassResponse)
async def create_class(
    class_data: ClassCreate,
    current_user: User = Depends(get_current_teacher),
    db: Session = Depends(get_db)
):
    """Create a new class (teachers and admins only)."""
    import uuid
    
    class_id = str(uuid.uuid4())
    
    new_class = Class(
        id=class_id,
        name=class_data.name,
        teacher_id=current_user.id,
        enabled=True,
        daily_question_limit=class_data.daily_question_limit,
        blocked_terms=class_data.blocked_terms
    )
    
    db.add(new_class)
    db.commit()
    db.refresh(new_class)
    
    return ClassResponse(
        id=new_class.id,
        name=new_class.name,
        teacher_id=new_class.teacher_id,
        enabled=new_class.enabled,
        daily_question_limit=new_class.daily_question_limit,
        blocked_terms=new_class.blocked_terms,
        created_at=new_class.created_at,
        student_count=0,
        document_count=0
    )


@router.get("/", response_model=List[ClassResponse])
async def list_classes(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List classes accessible to current user."""
    if current_user.role == "admin":
        # Admins can see all classes
        classes = db.query(Class).all()
    elif current_user.role == "teacher":
        # Teachers can see their own classes
        classes = db.query(Class).filter(Class.teacher_id == current_user.id).all()
    else:
        # Students can see classes they're enrolled in
        student_access = db.query(StudentAccess).filter(
            StudentAccess.student_id == current_user.id,
            StudentAccess.enabled == True
        ).all()
        class_ids = [access.class_id for access in student_access]
        classes = db.query(Class).filter(Class.id.in_(class_ids)).all() if class_ids else []
    
    # Convert to response format with counts
    response_classes = []
    for class_obj in classes:
        student_count = db.query(StudentAccess).filter(
            StudentAccess.class_id == class_obj.id,
            StudentAccess.enabled == True
        ).count()
        
        document_count = len(class_obj.documents)
        
        response_classes.append(ClassResponse(
            id=class_obj.id,
            name=class_obj.name,
            teacher_id=class_obj.teacher_id,
            enabled=class_obj.enabled,
            daily_question_limit=class_obj.daily_question_limit,
            blocked_terms=class_obj.blocked_terms,
            created_at=class_obj.created_at,
            student_count=student_count,
            document_count=document_count
        ))
    
    return response_classes


@router.get("/{class_id}", response_model=ClassResponse)
async def get_class(
    class_id: str,
    current_user: User = Depends(get_current_user),
    permission_checker: PermissionChecker = Depends(get_permission_checker),
    db: Session = Depends(get_db)
):
    """Get specific class details."""
    if not permission_checker.can_access_class(current_user, class_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this class"
        )
    
    class_obj = db.query(Class).filter(Class.id == class_id).first()
    if not class_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Class not found"
        )
    
    student_count = db.query(StudentAccess).filter(
        StudentAccess.class_id == class_id,
        StudentAccess.enabled == True
    ).count()
    
    document_count = len(class_obj.documents)
    
    return ClassResponse(
        id=class_obj.id,
        name=class_obj.name,
        teacher_id=class_obj.teacher_id,
        enabled=class_obj.enabled,
        daily_question_limit=class_obj.daily_question_limit,
        blocked_terms=class_obj.blocked_terms,
        created_at=class_obj.created_at,
        student_count=student_count,
        document_count=document_count
    )


@router.put("/{class_id}", response_model=ClassResponse)
async def update_class(
    class_id: str,
    class_update: ClassUpdate,
    current_user: User = Depends(get_current_teacher),
    permission_checker: PermissionChecker = Depends(get_permission_checker),
    db: Session = Depends(get_db)
):
    """Update class settings (teachers and admins only)."""
    if not permission_checker.can_access_class(current_user, class_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this class"
        )
    
    class_obj = db.query(Class).filter(Class.id == class_id).first()
    if not class_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Class not found"
        )
    
    # Update fields if provided
    if class_update.name is not None:
        class_obj.name = class_update.name
    if class_update.enabled is not None:
        class_obj.enabled = class_update.enabled
    if class_update.daily_question_limit is not None:
        class_obj.daily_question_limit = class_update.daily_question_limit
    if class_update.blocked_terms is not None:
        class_obj.blocked_terms = class_update.blocked_terms
    
    db.commit()
    db.refresh(class_obj)
    
    return ClassResponse(
        id=class_obj.id,
        name=class_obj.name,
        teacher_id=class_obj.teacher_id,
        enabled=class_obj.enabled,
        daily_question_limit=class_obj.daily_question_limit,
        blocked_terms=class_obj.blocked_terms,
        created_at=class_obj.created_at,
        student_count=0,  # Could calculate if needed
        document_count=len(class_obj.documents)
    )


@router.post("/set-access")
async def set_class_access(
    access_request: AccessRequest,
    current_user: User = Depends(get_current_teacher),
    permission_checker: PermissionChecker = Depends(get_permission_checker),
    db: Session = Depends(get_db)
):
    """Set access control for class or individual student."""
    if not permission_checker.can_access_class(current_user, access_request.class_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this class"
        )
    
    class_obj = db.query(Class).filter(Class.id == access_request.class_id).first()
    if not class_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Class not found"
        )
    
    if access_request.action in ["enable_class", "disable_class"]:
        # Class-wide access control
        class_obj.enabled = access_request.enabled
        db.commit()
        
        return {
            "message": f"Class access {'enabled' if access_request.enabled else 'disabled'}",
            "class_id": access_request.class_id,
            "enabled": access_request.enabled
        }
    
    elif access_request.action in ["enable_student", "disable_student"]:
        # Individual student access control
        if not access_request.student_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Student ID required for student access control"
            )
        
        # Find or create student access record
        student_access = db.query(StudentAccess).filter(
            StudentAccess.student_id == access_request.student_id,
            StudentAccess.class_id == access_request.class_id
        ).first()
        
        if not student_access:
            student_access = StudentAccess(
                student_id=access_request.student_id,
                class_id=access_request.class_id,
                enabled=access_request.enabled
            )
            db.add(student_access)
        else:
            student_access.enabled = access_request.enabled
        
        db.commit()
        
        return {
            "message": f"Student access {'enabled' if access_request.enabled else 'disabled'}",
            "class_id": access_request.class_id,
            "student_id": access_request.student_id,
            "enabled": access_request.enabled
        }
    
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid action"
        )


@router.get("/{class_id}/students", response_model=List[StudentAccessResponse])
async def list_class_students(
    class_id: str,
    current_user: User = Depends(get_current_teacher),
    permission_checker: PermissionChecker = Depends(get_permission_checker),
    db: Session = Depends(get_db)
):
    """List students in a class with their access status."""
    if not permission_checker.can_access_class(current_user, class_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this class"
        )
    
    # Get all student access records for this class
    student_access_records = db.query(StudentAccess).filter(
        StudentAccess.class_id == class_id
    ).all()
    
    response_students = []
    for access in student_access_records:
        student = db.query(User).filter(User.id == access.student_id).first()
        if student:
            response_students.append(StudentAccessResponse(
                student_id=student.id,
                student_name=student.name,
                student_email=student.email,
                class_id=access.class_id,
                enabled=access.enabled,
                daily_question_count=access.daily_question_count,
                last_question_date=access.last_question_date,
                created_at=access.created_at,
                updated_at=access.updated_at
            ))
    
    return response_students