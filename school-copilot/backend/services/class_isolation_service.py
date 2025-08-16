"""Class-based document isolation service for strict data separation."""

import logging
from typing import List, Dict, Set, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_

from ..models.models import Class, Document, DocumentChunk, StudentAccess, User
from .embedding_service import VectorDatabase


logger = logging.getLogger(__name__)


class ClassIsolationService:
    """Service for managing strict class-based document isolation."""
    
    def __init__(self, db: Session):
        self.db = db
        self.vector_db = VectorDatabase()
    
    def create_class_collection(self, class_id: str) -> bool:
        """Create isolated document collection for a class."""
        try:
            # Verify class exists
            class_obj = self.db.query(Class).filter(Class.id == class_id).first()
            if not class_obj:
                logger.error(f"Class not found: {class_id}")
                return False
            
            # Create vector index for class
            success = self.vector_db.create_class_index(class_id)
            if success:
                logger.info(f"Created isolated collection for class: {class_obj.name}")
            
            return success
            
        except Exception as e:
            logger.error(f"Error creating class collection for {class_id}: {e}")
            return False
    
    def assign_document_to_class(self, document_id: str, class_id: str) -> bool:
        """Assign document to class with strict isolation."""
        try:
            # Verify document and class exist
            document = self.db.query(Document).filter(Document.id == document_id).first()
            class_obj = self.db.query(Class).filter(Class.id == class_id).first()
            
            if not document or not class_obj:
                logger.error(f"Document {document_id} or class {class_id} not found")
                return False
            
            # Check if already assigned
            if class_obj in document.assigned_classes:
                logger.info(f"Document {document.name} already assigned to class {class_obj.name}")
                return True
            
            # Add to class assignment
            document.assigned_classes.append(class_obj)
            self.db.commit()
            
            # Add document embeddings to class vector index
            chunks = self.db.query(DocumentChunk).filter(
                DocumentChunk.document_id == document_id
            ).all()
            
            if chunks:
                # Generate embeddings for chunks if not already done
                from .embedding_service import EmbeddingService
                embedding_service = EmbeddingService()
                
                chunk_texts = [chunk.content for chunk in chunks]
                embeddings = embedding_service.generate_embeddings(chunk_texts)
                chunk_ids = [chunk.id for chunk in chunks]
                
                # Add to class-specific vector index
                self.vector_db.add_embeddings(class_id, embeddings, chunk_ids)
                self.vector_db.save_index(class_id)
            
            logger.info(f"Assigned document {document.name} to class {class_obj.name}")
            return True
            
        except Exception as e:
            logger.error(f"Error assigning document {document_id} to class {class_id}: {e}")
            return False
    
    def remove_document_from_class(self, document_id: str, class_id: str) -> bool:
        """Remove document from class with cleanup."""
        try:
            document = self.db.query(Document).filter(Document.id == document_id).first()
            class_obj = self.db.query(Class).filter(Class.id == class_id).first()
            
            if not document or not class_obj:
                logger.error(f"Document {document_id} or class {class_id} not found")
                return False
            
            # Remove from class assignment
            if class_obj in document.assigned_classes:
                document.assigned_classes.remove(class_obj)
                self.db.commit()
            
            # Remove from vector index
            chunks = self.db.query(DocumentChunk).filter(
                DocumentChunk.document_id == document_id
            ).all()
            
            chunk_ids = [chunk.id for chunk in chunks]
            self.vector_db.remove_document_embeddings(class_id, document_id, chunk_ids)
            self.vector_db.save_index(class_id)
            
            logger.info(f"Removed document {document.name} from class {class_obj.name}")
            return True
            
        except Exception as e:
            logger.error(f"Error removing document {document_id} from class {class_id}: {e}")
            return False
    
    def get_class_documents(self, class_id: str) -> List[Document]:
        """Get all documents assigned to a specific class."""
        try:
            class_obj = self.db.query(Class).filter(Class.id == class_id).first()
            if not class_obj:
                return []
            
            return list(class_obj.documents)
            
        except Exception as e:
            logger.error(f"Error getting documents for class {class_id}: {e}")
            return []
    
    def verify_student_access(self, student_id: str, class_id: str) -> bool:
        """Verify student has access to a specific class."""
        try:
            # Check if class is enabled
            class_obj = self.db.query(Class).filter(Class.id == class_id).first()
            if not class_obj or not class_obj.enabled:
                return False
            
            # Check student access record
            student_access = self.db.query(StudentAccess).filter(
                and_(
                    StudentAccess.student_id == student_id,
                    StudentAccess.class_id == class_id,
                    StudentAccess.enabled == True
                )
            ).first()
            
            return student_access is not None
            
        except Exception as e:
            logger.error(f"Error verifying student access for {student_id} to class {class_id}: {e}")
            return False
    
    def get_student_classes(self, student_id: str) -> List[Class]:
        """Get all classes a student has access to."""
        try:
            # Get all enabled student access records
            access_records = self.db.query(StudentAccess).filter(
                and_(
                    StudentAccess.student_id == student_id,
                    StudentAccess.enabled == True
                )
            ).all()
            
            class_ids = [access.class_id for access in access_records]
            
            # Get enabled classes
            classes = self.db.query(Class).filter(
                and_(
                    Class.id.in_(class_ids),
                    Class.enabled == True
                )
            ).all()
            
            return classes
            
        except Exception as e:
            logger.error(f"Error getting classes for student {student_id}: {e}")
            return []
    
    def verify_query_isolation(self, student_id: str, class_id: str, query: str) -> Dict[str, any]:
        """Verify query can only access documents from student's assigned class."""
        try:
            # Verify student access
            if not self.verify_student_access(student_id, class_id):
                return {
                    "allowed": False,
                    "reason": "Student does not have access to this class",
                    "accessible_documents": []
                }
            
            # Get documents accessible to this student in this class
            accessible_docs = self.get_class_documents(class_id)
            
            # Get vector index stats for verification
            index_stats = self.vector_db.get_index_stats(class_id)
            
            return {
                "allowed": True,
                "reason": "Access granted",
                "accessible_documents": [doc.id for doc in accessible_docs],
                "document_count": len(accessible_docs),
                "vector_index_size": index_stats.get("total_vectors", 0),
                "class_enabled": True
            }
            
        except Exception as e:
            logger.error(f"Error verifying query isolation: {e}")
            return {
                "allowed": False,
                "reason": f"Error verifying access: {str(e)}",
                "accessible_documents": []
            }
    
    def audit_class_isolation(self, class_id: str) -> Dict[str, any]:
        """Audit class isolation to ensure no data leakage."""
        try:
            class_obj = self.db.query(Class).filter(Class.id == class_id).first()
            if not class_obj:
                return {"error": "Class not found"}
            
            # Get class documents
            class_documents = list(class_obj.documents)
            
            # Get students with access
            student_access = self.db.query(StudentAccess).filter(
                StudentAccess.class_id == class_id
            ).all()
            
            enabled_students = [access for access in student_access if access.enabled]
            
            # Get vector index stats
            index_stats = self.vector_db.get_index_stats(class_id)
            
            # Check for potential cross-class document access
            all_documents = self.db.query(Document).all()
            cross_class_docs = []
            
            for doc in all_documents:
                if doc not in class_documents:
                    # Check if any chunks from this doc might be in the class index
                    doc_chunks = self.db.query(DocumentChunk).filter(
                        DocumentChunk.document_id == doc.id
                    ).count()
                    
                    if doc_chunks > 0:
                        cross_class_docs.append({
                            "document_id": doc.id,
                            "document_name": doc.name,
                            "chunk_count": doc_chunks
                        })
            
            return {
                "class_id": class_id,
                "class_name": class_obj.name,
                "class_enabled": class_obj.enabled,
                "assigned_documents": len(class_documents),
                "document_details": [
                    {
                        "id": doc.id,
                        "name": doc.name,
                        "type": doc.file_type,
                        "status": doc.status
                    } for doc in class_documents
                ],
                "enabled_students": len(enabled_students),
                "total_students": len(student_access),
                "vector_index": index_stats,
                "isolation_status": "SECURE" if not cross_class_docs else "WARNING",
                "potential_leaks": cross_class_docs
            }
            
        except Exception as e:
            logger.error(f"Error auditing class isolation for {class_id}: {e}")
            return {"error": str(e)}
    
    def bulk_assign_documents(self, document_ids: List[str], class_id: str) -> Dict[str, any]:
        """Bulk assign multiple documents to a class."""
        try:
            results = {
                "successful": [],
                "failed": [],
                "total": len(document_ids)
            }
            
            for doc_id in document_ids:
                if self.assign_document_to_class(doc_id, class_id):
                    results["successful"].append(doc_id)
                else:
                    results["failed"].append(doc_id)
            
            logger.info(f"Bulk assignment to class {class_id}: {len(results['successful'])}/{len(document_ids)} successful")
            return results
            
        except Exception as e:
            logger.error(f"Error in bulk document assignment: {e}")
            return {
                "successful": [],
                "failed": document_ids,
                "total": len(document_ids),
                "error": str(e)
            }
    
    def migrate_class_documents(self, from_class_id: str, to_class_id: str) -> Dict[str, any]:
        """Migrate documents from one class to another (admin operation)."""
        try:
            from_class = self.db.query(Class).filter(Class.id == from_class_id).first()
            to_class = self.db.query(Class).filter(Class.id == to_class_id).first()
            
            if not from_class or not to_class:
                return {"error": "Source or destination class not found"}
            
            documents = list(from_class.documents)
            results = {
                "migrated": [],
                "failed": [],
                "total": len(documents)
            }
            
            for doc in documents:
                # Remove from source class
                if self.remove_document_from_class(doc.id, from_class_id):
                    # Add to destination class
                    if self.assign_document_to_class(doc.id, to_class_id):
                        results["migrated"].append({
                            "document_id": doc.id,
                            "document_name": doc.name
                        })
                    else:
                        results["failed"].append(doc.id)
                        # Re-add to source class if destination failed
                        self.assign_document_to_class(doc.id, from_class_id)
                else:
                    results["failed"].append(doc.id)
            
            logger.info(f"Migrated {len(results['migrated'])}/{len(documents)} documents from {from_class.name} to {to_class.name}")
            return results
            
        except Exception as e:
            logger.error(f"Error migrating documents from {from_class_id} to {to_class_id}: {e}")
            return {"error": str(e)}
    
    def cleanup_orphaned_data(self) -> Dict[str, any]:
        """Clean up orphaned data that might compromise isolation."""
        try:
            cleanup_results = {
                "orphaned_chunks": 0,
                "empty_indexes": 0,
                "invalid_assignments": 0
            }
            
            # Find document chunks without parent documents
            orphaned_chunks = self.db.query(DocumentChunk).filter(
                ~DocumentChunk.document_id.in_(
                    self.db.query(Document.id)
                )
            ).all()
            
            for chunk in orphaned_chunks:
                self.db.delete(chunk)
                cleanup_results["orphaned_chunks"] += 1
            
            # Find and clean empty vector indexes
            all_classes = self.db.query(Class).all()
            for class_obj in all_classes:
                stats = self.vector_db.get_index_stats(class_obj.id)
                if stats.get("total_vectors", 0) == 0 and len(class_obj.documents) > 0:
                    # Rebuild index for class with documents but no vectors
                    self.create_class_collection(class_obj.id)
                    cleanup_results["empty_indexes"] += 1
            
            self.db.commit()
            
            logger.info(f"Cleanup completed: {cleanup_results}")
            return cleanup_results
            
        except Exception as e:
            logger.error(f"Error during cleanup: {e}")
            return {"error": str(e)}