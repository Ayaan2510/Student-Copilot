"""Audit logging API endpoints."""

import csv
import io
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, Response
from sqlalchemy.orm import Session
from sqlalchemy import and_, desc

from ..models.database import get_db
from ..models.models import User, AuditLog, Class
from ..schemas.logs import AuditLogResponse, LogFilters, LogSummaryResponse
from ..auth.dependencies import get_current_teacher, get_permission_checker, PermissionChecker


router = APIRouter()


@router.get("/", response_model=List[AuditLogResponse])
async def get_audit_logs(
    class_id: str = None,
    student_id: str = None,
    from_date: str = None,
    to_date: str = None,
    success_only: bool = None,
    limit: int = 50,
    offset: int = 0,
    current_user: User = Depends(get_current_teacher),
    permission_checker: PermissionChecker = Depends(get_permission_checker),
    db: Session = Depends(get_db)
):
    """Get audit logs with filtering options."""
    # Build query
    query = db.query(AuditLog).join(User, AuditLog.student_id == User.id).join(Class, AuditLog.class_id == Class.id)
    
    # Filter by teacher's classes if not admin
    if current_user.role != "admin":
        teacher_class_ids = [cls.id for cls in current_user.taught_classes]
        query = query.filter(AuditLog.class_id.in_(teacher_class_ids))
    
    # Apply filters
    if class_id:
        if not permission_checker.can_view_audit_logs(current_user, class_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to logs for this class"
            )
        query = query.filter(AuditLog.class_id == class_id)
    
    if student_id:
        query = query.filter(AuditLog.student_id == student_id)
    
    if from_date:
        try:
            from datetime import datetime
            from_dt = datetime.fromisoformat(from_date.replace('Z', '+00:00'))
            query = query.filter(AuditLog.timestamp >= from_dt)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid from_date format. Use ISO format."
            )
    
    if to_date:
        try:
            from datetime import datetime
            to_dt = datetime.fromisoformat(to_date.replace('Z', '+00:00'))
            query = query.filter(AuditLog.timestamp <= to_dt)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid to_date format. Use ISO format."
            )
    
    if success_only is not None:
        query = query.filter(AuditLog.success == success_only)
    
    # Order by timestamp (newest first) and apply pagination
    query = query.order_by(desc(AuditLog.timestamp)).offset(offset).limit(limit)
    
    logs = query.all()
    
    # Convert to response format
    response_logs = []
    for log in logs:
        student = db.query(User).filter(User.id == log.student_id).first()
        class_obj = db.query(Class).filter(Class.id == log.class_id).first()
        
        response_logs.append(AuditLogResponse(
            id=log.id,
            student_id=log.student_id,
            student_name=student.name if student else "Unknown",
            student_email=student.email if student else "Unknown",
            class_id=log.class_id,
            class_name=class_obj.name if class_obj else "Unknown",
            query_text=log.query_text,
            response_time_ms=log.response_time_ms,
            success=log.success,
            citation_count=log.citation_count,
            confidence_score=log.confidence_score,
            error_message=log.error_message,
            timestamp=log.timestamp
        ))
    
    return response_logs


@router.get("/summary", response_model=LogSummaryResponse)
async def get_logs_summary(
    class_id: str = None,
    from_date: str = None,
    to_date: str = None,
    current_user: User = Depends(get_current_teacher),
    permission_checker: PermissionChecker = Depends(get_permission_checker),
    db: Session = Depends(get_db)
):
    """Get summary statistics for audit logs."""
    # Build base query
    query = db.query(AuditLog)
    
    # Filter by teacher's classes if not admin
    if current_user.role != "admin":
        teacher_class_ids = [cls.id for cls in current_user.taught_classes]
        query = query.filter(AuditLog.class_id.in_(teacher_class_ids))
    
    # Apply filters
    if class_id:
        if not permission_checker.can_view_audit_logs(current_user, class_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to logs for this class"
            )
        query = query.filter(AuditLog.class_id == class_id)
    
    if from_date:
        try:
            from datetime import datetime
            from_dt = datetime.fromisoformat(from_date.replace('Z', '+00:00'))
            query = query.filter(AuditLog.timestamp >= from_dt)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid from_date format"
            )
    
    if to_date:
        try:
            from datetime import datetime
            to_dt = datetime.fromisoformat(to_date.replace('Z', '+00:00'))
            query = query.filter(AuditLog.timestamp <= to_dt)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid to_date format"
            )
    
    # Get all logs for analysis
    logs = query.all()
    
    if not logs:
        return LogSummaryResponse(
            total_queries=0,
            successful_queries=0,
            failed_queries=0,
            unique_students=0,
            average_response_time=0.0,
            date_range={},
            top_error_types=[]
        )
    
    # Calculate statistics
    total_queries = len(logs)
    successful_queries = sum(1 for log in logs if log.success)
    failed_queries = total_queries - successful_queries
    unique_students = len(set(log.student_id for log in logs))
    
    # Average response time
    response_times = [log.response_time_ms for log in logs if log.response_time_ms > 0]
    average_response_time = sum(response_times) / len(response_times) if response_times else 0.0
    
    # Date range
    timestamps = [log.timestamp for log in logs]
    date_range = {
        "start": min(timestamps).isoformat() if timestamps else None,
        "end": max(timestamps).isoformat() if timestamps else None
    }
    
    # Most active class
    if current_user.role == "admin":
        from collections import Counter
        class_counts = Counter(log.class_id for log in logs)
        most_active_class_id = class_counts.most_common(1)[0][0] if class_counts else None
        most_active_class = None
        if most_active_class_id:
            class_obj = db.query(Class).filter(Class.id == most_active_class_id).first()
            most_active_class = class_obj.name if class_obj else most_active_class_id
    else:
        most_active_class = None
    
    # Top error types
    error_logs = [log for log in logs if not log.success and log.error_message]
    from collections import Counter
    error_counter = Counter(log.error_message for log in error_logs)
    top_error_types = [
        {"error": error, "count": count}
        for error, count in error_counter.most_common(5)
    ]
    
    return LogSummaryResponse(
        total_queries=total_queries,
        successful_queries=successful_queries,
        failed_queries=failed_queries,
        unique_students=unique_students,
        average_response_time=average_response_time,
        most_active_class=most_active_class,
        date_range=date_range,
        top_error_types=top_error_types
    )


@router.get("/export")
async def export_logs_csv(
    class_id: str = None,
    student_id: str = None,
    from_date: str = None,
    to_date: str = None,
    include_query_text: bool = True,
    include_error_details: bool = False,
    current_user: User = Depends(get_current_teacher),
    permission_checker: PermissionChecker = Depends(get_permission_checker),
    db: Session = Depends(get_db)
):
    """Export audit logs as CSV file."""
    # Get logs using same filtering logic as get_audit_logs
    query = db.query(AuditLog).join(User, AuditLog.student_id == User.id).join(Class, AuditLog.class_id == Class.id)
    
    # Filter by teacher's classes if not admin
    if current_user.role != "admin":
        teacher_class_ids = [cls.id for cls in current_user.taught_classes]
        query = query.filter(AuditLog.class_id.in_(teacher_class_ids))
    
    # Apply filters (same as get_audit_logs)
    if class_id:
        if not permission_checker.can_view_audit_logs(current_user, class_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to logs for this class"
            )
        query = query.filter(AuditLog.class_id == class_id)
    
    if student_id:
        query = query.filter(AuditLog.student_id == student_id)
    
    if from_date:
        try:
            from datetime import datetime
            from_dt = datetime.fromisoformat(from_date.replace('Z', '+00:00'))
            query = query.filter(AuditLog.timestamp >= from_dt)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid from_date format"
            )
    
    if to_date:
        try:
            from datetime import datetime
            to_dt = datetime.fromisoformat(to_date.replace('Z', '+00:00'))
            query = query.filter(AuditLog.timestamp <= to_dt)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid to_date format"
            )
    
    # Order by timestamp and limit to reasonable size
    logs = query.order_by(desc(AuditLog.timestamp)).limit(10000).all()
    
    # Create CSV content
    output = io.StringIO()
    
    # Define CSV headers based on options
    headers = [
        "timestamp", "student_email", "class_name", "success", 
        "response_time_ms", "citation_count"
    ]
    
    if include_query_text:
        headers.append("query_text")
    
    if include_error_details:
        headers.extend(["error_message", "confidence_score"])
    
    writer = csv.writer(output)
    writer.writerow(headers)
    
    # Write data rows
    for log in logs:
        student = db.query(User).filter(User.id == log.student_id).first()
        class_obj = db.query(Class).filter(Class.id == log.class_id).first()
        
        row = [
            log.timestamp.isoformat(),
            student.email if student else "Unknown",
            class_obj.name if class_obj else "Unknown",
            log.success,
            log.response_time_ms,
            log.citation_count
        ]
        
        if include_query_text:
            # Sanitize query text for CSV
            query_text = log.query_text.replace('\n', ' ').replace('\r', '') if log.query_text else ""
            row.append(query_text)
        
        if include_error_details:
            row.extend([
                log.error_message or "",
                log.confidence_score or ""
            ])
        
        writer.writerow(row)
    
    # Return CSV as response
    csv_content = output.getvalue()
    output.close()
    
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=audit_logs_{class_id or 'all'}_{from_date or 'all'}.csv"
        }
    )