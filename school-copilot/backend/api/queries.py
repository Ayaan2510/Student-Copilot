"""Query processing API endpoints."""

import time
from datetime import datetime, date
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..models.database import get_db
from ..models.models import User, Class, StudentAccess, AuditLog
from ..schemas.queries import QueryRequest, QueryResponse, PermissionCheckResponse
from ..auth.dependencies import get_current_user
from ..utils.validation import validate_query_request


router = APIRouter()


@router.post("/", response_model=QueryResponse)
async def query_documents(
    query_request: QueryRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Process student query against document corpus."""
    start_time = time.time()
    
    # Verify user is the same as in request (security check)
    if current_user.id != query_request.student_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User ID mismatch"
        )
    
    # Get class and check access
    class_obj = db.query(Class).filter(Class.id == query_request.class_id).first()
    if not class_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Class not found"
        )
    
    # Check if class is enabled
    if not class_obj.enabled:
        await log_query_attempt(db, query_request, False, "Class disabled", 0)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access disabled by your teacher"
        )
    
    # Check student access
    student_access = db.query(StudentAccess).filter(
        StudentAccess.student_id == current_user.id,
        StudentAccess.class_id == query_request.class_id
    ).first()
    
    if not student_access or not student_access.enabled:
        await log_query_attempt(db, query_request, False, "Student access disabled", 0)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access disabled by your teacher"
        )
    
    # Check daily question limit
    today = date.today()
    if (student_access.last_question_date and 
        student_access.last_question_date.date() == today):
        if student_access.daily_question_count >= class_obj.daily_question_limit:
            await log_query_attempt(db, query_request, False, "Daily limit exceeded", 0)
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Daily question limit ({class_obj.daily_question_limit}) exceeded"
            )
    else:
        # Reset counter for new day
        student_access.daily_question_count = 0
        student_access.last_question_date = datetime.utcnow()
    
    # Validate query
    validation_result = validate_query_request(query_request, class_obj.blocked_terms)
    if not validation_result["valid"]:
        error_msg = "; ".join(validation_result["errors"])
        await log_query_attempt(db, query_request, False, error_msg, 0)
        
        if validation_result["blocked_term"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Your question contains content that is not allowed. Please rephrase and try again."
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid query format"
            )
    
    # Use sanitized query
    sanitized_query = validation_result["sanitized_query"]
    
    # Process query using RAG service
    from ..services.rag_service import RAGService
    rag_service = RAGService(db)
    
    rag_response = await rag_service.process_query(
        query=sanitized_query,
        class_id=query_request.class_id,
        student_id=current_user.id
    )
    
    # Add remaining questions count
    rag_response.remaining_questions = class_obj.daily_question_limit - student_access.daily_question_count - 1
    
    # Update question count
    student_access.daily_question_count += 1
    student_access.last_question_date = datetime.utcnow()
    db.commit()
    
    # Log query attempt
    await log_query_attempt(
        db, query_request, rag_response.success, 
        rag_response.error if not rag_response.success else "Success", 
        rag_response.processing_time,
        confidence=rag_response.confidence,
        citation_count=len(rag_response.citations)
    )
    
    return rag_response


@router.get("/permission-check", response_model=PermissionCheckResponse)
async def check_query_permission(
    class_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Check if user can query a specific class."""
    # Get class
    class_obj = db.query(Class).filter(Class.id == class_id).first()
    if not class_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Class not found"
        )
    
    # Check student access
    student_access = db.query(StudentAccess).filter(
        StudentAccess.student_id == current_user.id,
        StudentAccess.class_id == class_id
    ).first()
    
    class_enabled = class_obj.enabled
    student_enabled = student_access.enabled if student_access else False
    has_access = class_enabled and student_enabled
    
    # Calculate remaining questions
    remaining_questions = None
    if student_access:
        today = date.today()
        if (student_access.last_question_date and 
            student_access.last_question_date.date() == today):
            remaining_questions = max(0, class_obj.daily_question_limit - student_access.daily_question_count)
        else:
            remaining_questions = class_obj.daily_question_limit
    
    # Determine reason if no access
    reason = None
    if not has_access:
        if not class_enabled:
            reason = "Class access disabled by teacher"
        elif not student_enabled:
            reason = "Your access to this class has been disabled"
        else:
            reason = "Access denied"
    
    return PermissionCheckResponse(
        has_access=has_access,
        reason=reason,
        remaining_questions=remaining_questions,
        class_enabled=class_enabled,
        student_enabled=student_enabled,
        daily_limit=class_obj.daily_question_limit,
        blocked_terms=class_obj.blocked_terms
    )


async def log_query_attempt(
    db: Session,
    query_request: QueryRequest,
    success: bool,
    error_message: str = None,
    response_time_ms: int = 0,
    confidence: float = None,
    citation_count: int = 0
):
    """Log query attempt for audit purposes."""
    audit_log = AuditLog(
        student_id=query_request.student_id,
        class_id=query_request.class_id,
        query_text=query_request.query[:500],  # Truncate for storage
        response_time_ms=response_time_ms,
        success=success,
        citation_count=citation_count,
        confidence_score=confidence,
        error_message=error_message,
        timestamp=datetime.utcnow()
    )
    
    db.add(audit_log)
    db.commit()