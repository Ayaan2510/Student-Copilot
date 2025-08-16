"""Document management API endpoints."""

import os
import uuid
import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.orm import Session

from ..models.database import get_db
from ..models.models import User, Document, Class
from ..schemas.documents import (
    DocumentResponse,
    UploadResponse,
    DocumentAssignRequest,
    ReindexRequest
)
from ..auth.dependencies import get_current_teacher, get_permission_checker, PermissionChecker
from ..utils.validation import ValidationUtils


logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/upload", response_model=UploadResponse)
async def upload_document(
    file: UploadFile = File(...),
    class_id: Optional[str] = Form(None),
    current_user: User = Depends(get_current_teacher),
    db: Session = Depends(get_db)
):
    """Upload a new document."""
    # Validate file type
    allowed_types = ["pdf", "docx", "pptx", "txt"]
    if not ValidationUtils.validate_file_type(file.filename, allowed_types):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file type. Allowed: {', '.join(allowed_types)}"
        )
    
    # Read file content to check size
    content = await file.read()
    file_size = len(content)
    
    if not ValidationUtils.validate_file_size(file_size):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File too large. Maximum size: 50MB"
        )
    
    # Generate document ID and file path
    document_id = str(uuid.uuid4())
    file_extension = file.filename.split(".")[-1].lower()
    file_path = f"data/documents/{document_id}.{file_extension}"
    
    # Ensure documents directory exists
    os.makedirs("data/documents", exist_ok=True)
    
    # Save file to disk
    with open(file_path, "wb") as f:
        f.write(content)
    
    # Create document record
    document = Document(
        id=document_id,
        name=file.filename,
        file_path=file_path,
        file_type=file_extension,
        file_size=file_size,
        status="processing"
    )
    
    db.add(document)
    
    # Assign to class if specified
    if class_id:
        class_obj = db.query(Class).filter(Class.id == class_id).first()
        if class_obj and class_obj.teacher_id == current_user.id:
            document.assigned_classes.append(class_obj)
    
    db.commit()
    
    # Process document with RAG service in background
    try:
        from ..services.rag_service import RAGService
        rag_service = RAGService(db)
        
        # Index the document (this would typically be done in a background task)
        success = await rag_service.index_document(document)
        
        if not success:
            document.status = "error"
            db.commit()
    except Exception as e:
        logger.error(f"Error indexing document: {e}")
        document.status = "error"
        db.commit()
    
    return UploadResponse(
        document_id=document_id,
        status="uploaded",
        message="Document uploaded successfully",
        file_size=file_size,
        estimated_processing_time=30  # seconds
    )


@router.get("/", response_model=List[DocumentResponse])
async def list_documents(
    class_id: Optional[str] = None,
    current_user: User = Depends(get_current_teacher),
    db: Session = Depends(get_db)
):
    """List documents accessible to current user."""
    if current_user.role == "admin":
        # Admins can see all documents
        if class_id:
            class_obj = db.query(Class).filter(Class.id == class_id).first()
            documents = class_obj.documents if class_obj else []
        else:
            documents = db.query(Document).all()
    else:
        # Teachers can see documents from their classes
        if class_id:
            class_obj = db.query(Class).filter(
                Class.id == class_id,
                Class.teacher_id == current_user.id
            ).first()
            documents = class_obj.documents if class_obj else []
        else:
            # Get all documents from teacher's classes
            teacher_classes = db.query(Class).filter(Class.teacher_id == current_user.id).all()
            documents = []
            for class_obj in teacher_classes:
                documents.extend(class_obj.documents)
            # Remove duplicates
            documents = list(set(documents))
    
    # Convert to response format
    response_documents = []
    for doc in documents:
        assigned_class_ids = [cls.id for cls in doc.assigned_classes]
        chunk_count = len(doc.chunks)
        
        response_documents.append(DocumentResponse(
            id=doc.id,
            name=doc.name,
            file_path=doc.file_path,
            file_type=doc.file_type,
            file_size=doc.file_size,
            page_count=doc.page_count,
            author=doc.author,
            status=doc.status,
            upload_date=doc.upload_date,
            last_indexed=doc.last_indexed,
            metadata=doc.metadata,
            assigned_classes=assigned_class_ids,
            chunk_count=chunk_count
        ))
    
    return response_documents


@router.get("/{document_id}", response_model=DocumentResponse)
async def get_document(
    document_id: str,
    current_user: User = Depends(get_current_teacher),
    permission_checker: PermissionChecker = Depends(get_permission_checker),
    db: Session = Depends(get_db)
):
    """Get specific document details."""
    if not permission_checker.can_manage_document(current_user, document_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this document"
        )
    
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    assigned_class_ids = [cls.id for cls in document.assigned_classes]
    chunk_count = len(document.chunks)
    
    return DocumentResponse(
        id=document.id,
        name=document.name,
        file_path=document.file_path,
        file_type=document.file_type,
        file_size=document.file_size,
        page_count=document.page_count,
        author=document.author,
        status=document.status,
        upload_date=document.upload_date,
        last_indexed=document.last_indexed,
        metadata=document.metadata,
        assigned_classes=assigned_class_ids,
        chunk_count=chunk_count
    )


@router.post("/assign")
async def assign_document_to_classes(
    assign_request: DocumentAssignRequest,
    current_user: User = Depends(get_current_teacher),
    permission_checker: PermissionChecker = Depends(get_permission_checker),
    db: Session = Depends(get_db)
):
    """Assign or unassign document to/from classes."""
    if not permission_checker.can_manage_document(current_user, assign_request.document_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this document"
        )
    
    document = db.query(Document).filter(Document.id == assign_request.document_id).first()
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    # Get classes that the teacher can access
    accessible_classes = []
    for class_id in assign_request.class_ids:
        if permission_checker.can_access_class(current_user, class_id):
            class_obj = db.query(Class).filter(Class.id == class_id).first()
            if class_obj:
                accessible_classes.append(class_obj)
    
    if assign_request.action == "assign":
        # Add classes to document
        for class_obj in accessible_classes:
            if class_obj not in document.assigned_classes:
                document.assigned_classes.append(class_obj)
        
        message = f"Document assigned to {len(accessible_classes)} classes"
    
    elif assign_request.action == "unassign":
        # Remove classes from document
        for class_obj in accessible_classes:
            if class_obj in document.assigned_classes:
                document.assigned_classes.remove(class_obj)
        
        message = f"Document unassigned from {len(accessible_classes)} classes"
    
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid action. Use 'assign' or 'unassign'"
        )
    
    db.commit()
    
    return {
        "message": message,
        "document_id": assign_request.document_id,
        "affected_classes": len(accessible_classes),
        "current_assignments": [cls.id for cls in document.assigned_classes]
    }


@router.post("/reindex")
async def reindex_documents(
    reindex_request: ReindexRequest,
    current_user: User = Depends(get_current_teacher),
    db: Session = Depends(get_db)
):
    """Trigger document reindexing for RAG pipeline."""
    if reindex_request.document_ids:
        # Reindex specific documents
        documents = []
        for doc_id in reindex_request.document_ids:
            doc = db.query(Document).filter(Document.id == doc_id).first()
            if doc:
                # Check if user can manage this document
                permission_checker = PermissionChecker(db)
                if permission_checker.can_manage_document(current_user, doc_id):
                    documents.append(doc)
        
        if not documents:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No accessible documents found for reindexing"
            )
    
    else:
        # Reindex all documents accessible to user
        if current_user.role == "admin":
            documents = db.query(Document).all()
        else:
            # Get documents from teacher's classes
            teacher_classes = db.query(Class).filter(Class.teacher_id == current_user.id).all()
            documents = []
            for class_obj in teacher_classes:
                documents.extend(class_obj.documents)
            documents = list(set(documents))  # Remove duplicates
    
    # Reindex documents using RAG service
    from ..services.rag_service import RAGService
    rag_service = RAGService(db)
    
    successful_reindex = 0
    for doc in documents:
        try:
            success = await rag_service.reindex_document(doc)
            if success:
                successful_reindex += 1
        except Exception as e:
            logger.error(f"Error reindexing document {doc.name}: {e}")
            doc.status = "error"
    
    db.commit()
    
    return {
        "message": f"Reindexing completed for {successful_reindex}/{len(documents)} documents",
        "document_count": len(documents),
        "successful_count": successful_reindex,
        "failed_count": len(documents) - successful_reindex,
        "status": "completed"
    }


@router.delete("/{document_id}")
async def delete_document(
    document_id: str,
    current_user: User = Depends(get_current_teacher),
    permission_checker: PermissionChecker = Depends(get_permission_checker),
    db: Session = Depends(get_db)
):
    """Delete a document and its file."""
    if not permission_checker.can_manage_document(current_user, document_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this document"
        )
    
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    # Delete file from disk
    try:
        if os.path.exists(document.file_path):
            os.remove(document.file_path)
    except Exception as e:
        # Log error but continue with database deletion
        print(f"Error deleting file {document.file_path}: {e}")
    
    # Delete from database (cascades to chunks and class assignments)
    db.delete(document)
    db.commit()
    
    return {
        "message": "Document deleted successfully",
        "document_id": document_id,
        "name": document.name
    }