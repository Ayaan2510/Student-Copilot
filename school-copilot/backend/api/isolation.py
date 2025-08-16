"""API endpoints for class-based document isolation management."""

from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..models.database import get_db
from ..models.models import User, Class
from ..services.class_isolation_service import ClassIsolationService
from ..auth.dependencies import get_current_teacher, get_current_admin, get_permission_checker, PermissionChecker


router = APIRouter()


@router.post("/classes/{class_id}/create-collection")
async def create_class_collection(
    class_id: str,
    current_user: User = Depends(get_current_teacher),
    permission_checker: PermissionChecker = Depends(get_permission_checker),
    db: Session = Depends(get_db)
):
    """Create isolated document collection for a class."""
    if not permission_checker.can_access_class(current_user, class_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this class"
        )
    
    isolation_service = ClassIsolationService(db)
    success = isolation_service.create_class_collection(class_id)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create class collection"
        )
    
    return {
        "message": "Class collection created successfully",
        "class_id": class_id,
        "status": "created"
    }


@router.post("/documents/{document_id}/assign/{class_id}")
async def assign_document_to_class(
    document_id: str,
    class_id: str,
    current_user: User = Depends(get_current_teacher),
    permission_checker: PermissionChecker = Depends(get_permission_checker),
    db: Session = Depends(get_db)
):
    """Assign document to class with strict isolation."""
    if not permission_checker.can_access_class(current_user, class_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this class"
        )
    
    if not permission_checker.can_manage_document(current_user, document_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this document"
        )
    
    isolation_service = ClassIsolationService(db)
    success = isolation_service.assign_document_to_class(document_id, class_id)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to assign document to class"
        )
    
    return {
        "message": "Document assigned to class successfully",
        "document_id": document_id,
        "class_id": class_id,
        "status": "assigned"
    }


@router.delete("/documents/{document_id}/remove/{class_id}")
async def remove_document_from_class(
    document_id: str,
    class_id: str,
    current_user: User = Depends(get_current_teacher),
    permission_checker: PermissionChecker = Depends(get_permission_checker),
    db: Session = Depends(get_db)
):
    """Remove document from class with cleanup."""
    if not permission_checker.can_access_class(current_user, class_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this class"
        )
    
    if not permission_checker.can_manage_document(current_user, document_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this document"
        )
    
    isolation_service = ClassIsolationService(db)
    success = isolation_service.remove_document_from_class(document_id, class_id)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to remove document from class"
        )
    
    return {
        "message": "Document removed from class successfully",
        "document_id": document_id,
        "class_id": class_id,
        "status": "removed"
    }


@router.get("/classes/{class_id}/documents")
async def get_class_documents(
    class_id: str,
    current_user: User = Depends(get_current_teacher),
    permission_checker: PermissionChecker = Depends(get_permission_checker),
    db: Session = Depends(get_db)
):
    """Get all documents assigned to a specific class."""
    if not permission_checker.can_access_class(current_user, class_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this class"
        )
    
    isolation_service = ClassIsolationService(db)
    documents = isolation_service.get_class_documents(class_id)
    
    return {
        "class_id": class_id,
        "document_count": len(documents),
        "documents": [
            {
                "id": doc.id,
                "name": doc.name,
                "type": doc.file_type,
                "status": doc.status,
                "upload_date": doc.upload_date,
                "last_indexed": doc.last_indexed
            } for doc in documents
        ]
    }


@router.get("/students/{student_id}/verify-access/{class_id}")
async def verify_student_access(
    student_id: str,
    class_id: str,
    current_user: User = Depends(get_current_teacher),
    permission_checker: PermissionChecker = Depends(get_permission_checker),
    db: Session = Depends(get_db)
):
    """Verify student has access to a specific class."""
    if not permission_checker.can_access_class(current_user, class_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this class"
        )
    
    isolation_service = ClassIsolationService(db)
    has_access = isolation_service.verify_student_access(student_id, class_id)
    
    return {
        "student_id": student_id,
        "class_id": class_id,
        "has_access": has_access,
        "status": "verified"
    }


@router.get("/students/{student_id}/classes")
async def get_student_classes(
    student_id: str,
    current_user: User = Depends(get_current_teacher),
    db: Session = Depends(get_db)
):
    """Get all classes a student has access to."""
    # Teachers can only see classes they teach
    if current_user.role == "teacher":
        # Verify student is in one of teacher's classes
        isolation_service = ClassIsolationService(db)
        student_classes = isolation_service.get_student_classes(student_id)
        teacher_classes = current_user.taught_classes
        
        # Filter to only classes taught by this teacher
        accessible_classes = [
            cls for cls in student_classes 
            if cls.teacher_id == current_user.id
        ]
    else:
        # Admins can see all student classes
        isolation_service = ClassIsolationService(db)
        accessible_classes = isolation_service.get_student_classes(student_id)
    
    return {
        "student_id": student_id,
        "class_count": len(accessible_classes),
        "classes": [
            {
                "id": cls.id,
                "name": cls.name,
                "enabled": cls.enabled,
                "teacher_id": cls.teacher_id,
                "document_count": len(cls.documents)
            } for cls in accessible_classes
        ]
    }


@router.post("/queries/verify-isolation")
async def verify_query_isolation(
    student_id: str,
    class_id: str,
    query: str,
    current_user: User = Depends(get_current_teacher),
    permission_checker: PermissionChecker = Depends(get_permission_checker),
    db: Session = Depends(get_db)
):
    """Verify query can only access documents from student's assigned class."""
    if not permission_checker.can_access_class(current_user, class_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this class"
        )
    
    isolation_service = ClassIsolationService(db)
    verification = isolation_service.verify_query_isolation(student_id, class_id, query)
    
    return verification


@router.get("/classes/{class_id}/audit")
async def audit_class_isolation(
    class_id: str,
    current_user: User = Depends(get_current_teacher),
    permission_checker: PermissionChecker = Depends(get_permission_checker),
    db: Session = Depends(get_db)
):
    """Audit class isolation to ensure no data leakage."""
    if not permission_checker.can_access_class(current_user, class_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this class"
        )
    
    isolation_service = ClassIsolationService(db)
    audit_result = isolation_service.audit_class_isolation(class_id)
    
    if "error" in audit_result:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=audit_result["error"]
        )
    
    return audit_result


@router.post("/documents/bulk-assign")
async def bulk_assign_documents(
    document_ids: List[str],
    class_id: str,
    current_user: User = Depends(get_current_teacher),
    permission_checker: PermissionChecker = Depends(get_permission_checker),
    db: Session = Depends(get_db)
):
    """Bulk assign multiple documents to a class."""
    if not permission_checker.can_access_class(current_user, class_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this class"
        )
    
    # Verify user can manage all documents
    for doc_id in document_ids:
        if not permission_checker.can_manage_document(current_user, doc_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied to document {doc_id}"
            )
    
    isolation_service = ClassIsolationService(db)
    results = isolation_service.bulk_assign_documents(document_ids, class_id)
    
    return {
        "message": f"Bulk assignment completed: {len(results['successful'])}/{results['total']} successful",
        "class_id": class_id,
        "results": results
    }


@router.post("/classes/{from_class_id}/migrate/{to_class_id}")
async def migrate_class_documents(
    from_class_id: str,
    to_class_id: str,
    current_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Migrate documents from one class to another (admin only)."""
    isolation_service = ClassIsolationService(db)
    results = isolation_service.migrate_class_documents(from_class_id, to_class_id)
    
    if "error" in results:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=results["error"]
        )
    
    return {
        "message": f"Migration completed: {len(results['migrated'])}/{results['total']} documents migrated",
        "from_class_id": from_class_id,
        "to_class_id": to_class_id,
        "results": results
    }


@router.post("/cleanup/orphaned-data")
async def cleanup_orphaned_data(
    current_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Clean up orphaned data that might compromise isolation (admin only)."""
    isolation_service = ClassIsolationService(db)
    results = isolation_service.cleanup_orphaned_data()
    
    if "error" in results:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=results["error"]
        )
    
    return {
        "message": "Cleanup completed successfully",
        "results": results
    }


@router.get("/isolation/system-audit")
async def system_isolation_audit(
    current_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Comprehensive system audit for isolation integrity (admin only)."""
    isolation_service = ClassIsolationService(db)
    
    # Get all classes
    all_classes = db.query(Class).all()
    audit_results = []
    
    for class_obj in all_classes:
        class_audit = isolation_service.audit_class_isolation(class_obj.id)
        audit_results.append(class_audit)
    
    # Summary statistics
    total_classes = len(all_classes)
    secure_classes = len([audit for audit in audit_results if audit.get("isolation_status") == "SECURE"])
    warning_classes = len([audit for audit in audit_results if audit.get("isolation_status") == "WARNING"])
    
    return {
        "system_status": "SECURE" if warning_classes == 0 else "WARNING",
        "total_classes": total_classes,
        "secure_classes": secure_classes,
        "warning_classes": warning_classes,
        "class_audits": audit_results,
        "recommendations": [
            "Run cleanup if orphaned data detected",
            "Review document assignments for warning classes",
            "Verify vector index integrity",
            "Check student access permissions"
        ] if warning_classes > 0 else ["System isolation is secure"]
    }