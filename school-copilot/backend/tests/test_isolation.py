"""Tests for class-based document isolation system."""

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from ..models.database import Base
from ..models.models import User, Class, Document, DocumentChunk, StudentAccess
from ..services.class_isolation_service import ClassIsolationService


@pytest.fixture
def db_session():
    """Create test database session."""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def sample_data(db_session):
    """Create sample data for testing."""
    # Create users
    teacher1 = User(id="teacher1", email="teacher1@example.edu", name="Teacher 1", role="teacher")
    teacher2 = User(id="teacher2", email="teacher2@example.edu", name="Teacher 2", role="teacher")
    student1 = User(id="student1", email="student1@example.edu", name="Student 1", role="student")
    student2 = User(id="student2", email="student2@example.edu", name="Student 2", role="student")
    
    # Create classes
    class1 = Class(id="class1", name="Math 101", teacher_id="teacher1", enabled=True)
    class2 = Class(id="class2", name="Science 101", teacher_id="teacher2", enabled=True)
    
    # Create documents
    doc1 = Document(id="doc1", name="Math Textbook", file_path="/path/math.pdf", file_type="pdf", file_size=1000, status="ready")
    doc2 = Document(id="doc2", name="Science Textbook", file_path="/path/science.pdf", file_type="pdf", file_size=1000, status="ready")
    doc3 = Document(id="doc3", name="Shared Resource", file_path="/path/shared.pdf", file_type="pdf", file_size=1000, status="ready")
    
    # Create document chunks
    chunk1 = DocumentChunk(id="chunk1", document_id="doc1", content="Math content", token_count=10, chunk_index=0)
    chunk2 = DocumentChunk(id="chunk2", document_id="doc2", content="Science content", token_count=10, chunk_index=0)
    chunk3 = DocumentChunk(id="chunk3", document_id="doc3", content="Shared content", token_count=10, chunk_index=0)
    
    # Create student access
    access1 = StudentAccess(student_id="student1", class_id="class1", enabled=True)
    access2 = StudentAccess(student_id="student2", class_id="class2", enabled=True)
    
    # Add all to database
    db_session.add_all([
        teacher1, teacher2, student1, student2,
        class1, class2,
        doc1, doc2, doc3,
        chunk1, chunk2, chunk3,
        access1, access2
    ])
    db_session.commit()
    
    return {
        "teachers": [teacher1, teacher2],
        "students": [student1, student2],
        "classes": [class1, class2],
        "documents": [doc1, doc2, doc3],
        "chunks": [chunk1, chunk2, chunk3],
        "access": [access1, access2]
    }


class TestClassIsolationService:
    """Test class isolation service functionality."""
    
    def test_create_class_collection(self, db_session, sample_data):
        """Test creating isolated class collection."""
        isolation_service = ClassIsolationService(db_session)
        
        # Test creating collection for existing class
        success = isolation_service.create_class_collection("class1")
        assert success is True
        
        # Test creating collection for non-existent class
        success = isolation_service.create_class_collection("nonexistent")
        assert success is False
    
    def test_assign_document_to_class(self, db_session, sample_data):
        """Test assigning document to class."""
        isolation_service = ClassIsolationService(db_session)
        
        # Create class collection first
        isolation_service.create_class_collection("class1")
        
        # Test assigning document to class
        success = isolation_service.assign_document_to_class("doc1", "class1")
        assert success is True
        
        # Verify assignment
        class_docs = isolation_service.get_class_documents("class1")
        assert len(class_docs) == 1
        assert class_docs[0].id == "doc1"
        
        # Test assigning same document again (should succeed)
        success = isolation_service.assign_document_to_class("doc1", "class1")
        assert success is True
        
        # Test assigning non-existent document
        success = isolation_service.assign_document_to_class("nonexistent", "class1")
        assert success is False
    
    def test_remove_document_from_class(self, db_session, sample_data):
        """Test removing document from class."""
        isolation_service = ClassIsolationService(db_session)
        
        # Setup: assign document to class
        isolation_service.create_class_collection("class1")
        isolation_service.assign_document_to_class("doc1", "class1")
        
        # Verify assignment
        class_docs = isolation_service.get_class_documents("class1")
        assert len(class_docs) == 1
        
        # Remove document
        success = isolation_service.remove_document_from_class("doc1", "class1")
        assert success is True
        
        # Verify removal
        class_docs = isolation_service.get_class_documents("class1")
        assert len(class_docs) == 0
    
    def test_verify_student_access(self, db_session, sample_data):
        """Test verifying student access to classes."""
        isolation_service = ClassIsolationService(db_session)
        
        # Test student with access
        has_access = isolation_service.verify_student_access("student1", "class1")
        assert has_access is True
        
        # Test student without access
        has_access = isolation_service.verify_student_access("student1", "class2")
        assert has_access is False
        
        # Test non-existent student
        has_access = isolation_service.verify_student_access("nonexistent", "class1")
        assert has_access is False
        
        # Test disabled class
        class1 = db_session.query(Class).filter(Class.id == "class1").first()
        class1.enabled = False
        db_session.commit()
        
        has_access = isolation_service.verify_student_access("student1", "class1")
        assert has_access is False
    
    def test_get_student_classes(self, db_session, sample_data):
        """Test getting classes for a student."""
        isolation_service = ClassIsolationService(db_session)
        
        # Test student with one class
        classes = isolation_service.get_student_classes("student1")
        assert len(classes) == 1
        assert classes[0].id == "class1"
        
        # Test student with no classes
        classes = isolation_service.get_student_classes("nonexistent")
        assert len(classes) == 0
        
        # Test with disabled student access
        access = db_session.query(StudentAccess).filter(
            StudentAccess.student_id == "student1"
        ).first()
        access.enabled = False
        db_session.commit()
        
        classes = isolation_service.get_student_classes("student1")
        assert len(classes) == 0
    
    def test_verify_query_isolation(self, db_session, sample_data):
        """Test query isolation verification."""
        isolation_service = ClassIsolationService(db_session)
        
        # Setup: assign document to class
        isolation_service.create_class_collection("class1")
        isolation_service.assign_document_to_class("doc1", "class1")
        
        # Test allowed query
        result = isolation_service.verify_query_isolation("student1", "class1", "test query")
        assert result["allowed"] is True
        assert "doc1" in result["accessible_documents"]
        
        # Test denied query (wrong class)
        result = isolation_service.verify_query_isolation("student1", "class2", "test query")
        assert result["allowed"] is False
        assert "does not have access" in result["reason"]
    
    def test_audit_class_isolation(self, db_session, sample_data):
        """Test class isolation audit."""
        isolation_service = ClassIsolationService(db_session)
        
        # Setup: assign documents to classes
        isolation_service.create_class_collection("class1")
        isolation_service.assign_document_to_class("doc1", "class1")
        
        # Audit class
        audit_result = isolation_service.audit_class_isolation("class1")
        
        assert "error" not in audit_result
        assert audit_result["class_id"] == "class1"
        assert audit_result["assigned_documents"] == 1
        assert audit_result["isolation_status"] in ["SECURE", "WARNING"]
        
        # Test audit for non-existent class
        audit_result = isolation_service.audit_class_isolation("nonexistent")
        assert "error" in audit_result
    
    def test_bulk_assign_documents(self, db_session, sample_data):
        """Test bulk document assignment."""
        isolation_service = ClassIsolationService(db_session)
        
        # Setup
        isolation_service.create_class_collection("class1")
        
        # Bulk assign documents
        document_ids = ["doc1", "doc2", "doc3"]
        results = isolation_service.bulk_assign_documents(document_ids, "class1")
        
        assert results["total"] == 3
        assert len(results["successful"]) >= 0
        assert len(results["failed"]) >= 0
        assert len(results["successful"]) + len(results["failed"]) == 3
        
        # Verify assignments
        class_docs = isolation_service.get_class_documents("class1")
        assert len(class_docs) == len(results["successful"])
    
    def test_document_isolation_between_classes(self, db_session, sample_data):
        """Test that documents are properly isolated between classes."""
        isolation_service = ClassIsolationService(db_session)
        
        # Setup: create collections and assign documents
        isolation_service.create_class_collection("class1")
        isolation_service.create_class_collection("class2")
        
        isolation_service.assign_document_to_class("doc1", "class1")
        isolation_service.assign_document_to_class("doc2", "class2")
        
        # Verify isolation
        class1_docs = isolation_service.get_class_documents("class1")
        class2_docs = isolation_service.get_class_documents("class2")
        
        assert len(class1_docs) == 1
        assert len(class2_docs) == 1
        assert class1_docs[0].id == "doc1"
        assert class2_docs[0].id == "doc2"
        
        # Verify cross-class access is denied
        result1 = isolation_service.verify_query_isolation("student1", "class2", "test")
        result2 = isolation_service.verify_query_isolation("student2", "class1", "test")
        
        assert result1["allowed"] is False
        assert result2["allowed"] is False
    
    def test_cleanup_orphaned_data(self, db_session, sample_data):
        """Test cleanup of orphaned data."""
        isolation_service = ClassIsolationService(db_session)
        
        # Create orphaned chunk (chunk without parent document)
        orphaned_chunk = DocumentChunk(
            id="orphaned",
            document_id="nonexistent_doc",
            content="Orphaned content",
            token_count=5,
            chunk_index=0
        )
        db_session.add(orphaned_chunk)
        db_session.commit()
        
        # Run cleanup
        results = isolation_service.cleanup_orphaned_data()
        
        assert "error" not in results
        assert results["orphaned_chunks"] >= 1
        
        # Verify orphaned chunk was removed
        remaining_chunk = db_session.query(DocumentChunk).filter(
            DocumentChunk.id == "orphaned"
        ).first()
        assert remaining_chunk is None


class TestIsolationIntegration:
    """Integration tests for isolation system."""
    
    def test_end_to_end_isolation(self, db_session, sample_data):
        """Test complete isolation workflow."""
        isolation_service = ClassIsolationService(db_session)
        
        # Step 1: Create class collections
        assert isolation_service.create_class_collection("class1") is True
        assert isolation_service.create_class_collection("class2") is True
        
        # Step 2: Assign documents to classes
        assert isolation_service.assign_document_to_class("doc1", "class1") is True
        assert isolation_service.assign_document_to_class("doc2", "class2") is True
        
        # Step 3: Verify student access
        assert isolation_service.verify_student_access("student1", "class1") is True
        assert isolation_service.verify_student_access("student1", "class2") is False
        assert isolation_service.verify_student_access("student2", "class1") is False
        assert isolation_service.verify_student_access("student2", "class2") is True
        
        # Step 4: Verify query isolation
        result1 = isolation_service.verify_query_isolation("student1", "class1", "test")
        result2 = isolation_service.verify_query_isolation("student2", "class2", "test")
        
        assert result1["allowed"] is True
        assert result2["allowed"] is True
        assert "doc1" in result1["accessible_documents"]
        assert "doc2" in result2["accessible_documents"]
        
        # Step 5: Audit isolation
        audit1 = isolation_service.audit_class_isolation("class1")
        audit2 = isolation_service.audit_class_isolation("class2")
        
        assert audit1["isolation_status"] in ["SECURE", "WARNING"]
        assert audit2["isolation_status"] in ["SECURE", "WARNING"]
        assert audit1["assigned_documents"] == 1
        assert audit2["assigned_documents"] == 1