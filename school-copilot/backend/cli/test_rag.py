#!/usr/bin/env python3
"""CLI script for testing RAG pipeline functionality."""

import asyncio
import sys
import os
from pathlib import Path

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

from models.database import SessionLocal, create_tables
from models.models import User, Class, Document, StudentAccess
from services.rag_service import RAGService
from auth.auth_service import AuthService


async def create_test_data():
    """Create test data for RAG testing."""
    db = SessionLocal()
    
    try:
        # Create test users
        auth_service = AuthService(db)
        
        teacher = auth_service.create_user(
            email="teacher@example.edu",
            name="Test Teacher",
            role="teacher",
            password="test123"
        )
        
        student = auth_service.create_user(
            email="student@example.edu", 
            name="Test Student",
            role="student",
            password="test123"
        )
        
        # Create test class
        test_class = Class(
            id="test_class_1",
            name="Mathematics 101",
            teacher_id=teacher.id,
            enabled=True,
            daily_question_limit=50,
            blocked_terms=[]
        )
        
        db.add(test_class)
        
        # Create student access
        student_access = StudentAccess(
            student_id=student.id,
            class_id=test_class.id,
            enabled=True,
            daily_question_count=0
        )
        
        db.add(student_access)
        db.commit()
        
        print(f"Created test teacher: {teacher.email}")
        print(f"Created test student: {student.email}")
        print(f"Created test class: {test_class.name}")
        
        return teacher, student, test_class
        
    finally:
        db.close()


async def create_test_document():
    """Create a test document with sample content."""
    # Create sample text file
    sample_content = """
    Chapter 1: Introduction to Algebra
    
    Algebra is a branch of mathematics that uses symbols and letters to represent numbers
    and quantities in formulas and equations. The basic operations in algebra include
    addition, subtraction, multiplication, and division.
    
    Variables are symbols (usually letters) that represent unknown values. For example,
    in the equation x + 5 = 10, the variable x represents the unknown value 5.
    
    Chapter 2: Linear Equations
    
    A linear equation is an equation that makes a straight line when graphed. The general
    form of a linear equation is y = mx + b, where m is the slope and b is the y-intercept.
    
    To solve a linear equation, we need to isolate the variable on one side of the equation.
    For example, to solve 2x + 6 = 14, we subtract 6 from both sides to get 2x = 8,
    then divide both sides by 2 to get x = 4.
    
    Chapter 3: Quadratic Equations
    
    A quadratic equation is a polynomial equation of degree 2. The general form is
    ax² + bx + c = 0, where a, b, and c are constants and a ≠ 0.
    
    The quadratic formula can be used to solve any quadratic equation:
    x = (-b ± √(b² - 4ac)) / (2a)
    """
    
    # Ensure documents directory exists
    os.makedirs("data/documents", exist_ok=True)
    
    # Write sample content to file
    doc_path = "data/documents/algebra_textbook.txt"
    with open(doc_path, 'w') as f:
        f.write(sample_content)
    
    # Create document record
    db = SessionLocal()
    try:
        document = Document(
            id="test_doc_1",
            name="Algebra Textbook.txt",
            file_path=doc_path,
            file_type="txt",
            file_size=len(sample_content),
            status="processing"
        )
        
        # Get test class and assign document
        test_class = db.query(Class).filter(Class.id == "test_class_1").first()
        if test_class:
            document.assigned_classes = [test_class]
        
        db.add(document)
        db.commit()
        db.refresh(document)
        
        print(f"Created test document: {document.name}")
        return document
        
    finally:
        db.close()


async def test_document_indexing():
    """Test document indexing with RAG service."""
    db = SessionLocal()
    
    try:
        # Get test document
        document = db.query(Document).filter(Document.id == "test_doc_1").first()
        if not document:
            print("Test document not found!")
            return False
        
        # Initialize RAG service
        rag_service = RAGService(db)
        
        # Index the document
        print(f"Indexing document: {document.name}")
        success = await rag_service.index_document(document)
        
        if success:
            print("✓ Document indexed successfully")
            
            # Get index stats
            stats = rag_service.get_class_index_stats("test_class_1")
            print(f"Index stats: {stats}")
            
            return True
        else:
            print("✗ Document indexing failed")
            return False
            
    finally:
        db.close()


async def test_query_processing():
    """Test query processing with RAG service."""
    db = SessionLocal()
    
    try:
        # Initialize RAG service
        rag_service = RAGService(db)
        
        # Test queries
        test_queries = [
            "What is algebra?",
            "How do you solve linear equations?",
            "What is the quadratic formula?",
            "What is calculus?",  # Should return "can't find"
        ]
        
        for query in test_queries:
            print(f"\nQuery: {query}")
            
            response = await rag_service.process_query(
                query=query,
                class_id="test_class_1",
                student_id="student_1"
            )
            
            print(f"Answer: {response.answer}")
            print(f"Confidence: {response.confidence:.2f}")
            print(f"Citations: {len(response.citations)}")
            print(f"Processing time: {response.processing_time}ms")
            
            if response.citations:
                for i, citation in enumerate(response.citations):
                    print(f"  Citation {i+1}: {citation.document_name} (score: {citation.relevance_score:.2f})")
        
        return True
        
    finally:
        db.close()


async def main():
    """Main test function."""
    print("School Co-Pilot RAG Pipeline Test")
    print("=" * 40)
    
    # Create database tables
    create_tables()
    print("✓ Database tables created")
    
    # Create test data
    print("\n1. Creating test data...")
    await create_test_data()
    
    # Create test document
    print("\n2. Creating test document...")
    await create_test_document()
    
    # Test document indexing
    print("\n3. Testing document indexing...")
    indexing_success = await test_document_indexing()
    
    if not indexing_success:
        print("Indexing failed, skipping query tests")
        return
    
    # Test query processing
    print("\n4. Testing query processing...")
    await test_query_processing()
    
    print("\n" + "=" * 40)
    print("RAG Pipeline test completed!")


if __name__ == "__main__":
    asyncio.run(main())