"""Tests for database schema manager."""

import pytest
import tempfile
import os
from pathlib import Path
from sqlalchemy import create_engine, text
from sqlalchemy.pool import StaticPool

from ..models.schema_manager import SchemaManager, create_database_schema, verify_database_schema
from ..models.database import Base


@pytest.fixture
def temp_sqlite_engine():
    """Create temporary SQLite engine for testing."""
    with tempfile.NamedTemporaryFile(suffix='.db', delete=False) as tmp_file:
        db_path = tmp_file.name
    
    engine = create_engine(
        f"sqlite:///{db_path}",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    
    yield engine
    
    # Cleanup
    engine.dispose()
    if os.path.exists(db_path):
        os.unlink(db_path)


@pytest.fixture
def schema_manager(temp_sqlite_engine):
    """Create schema manager with temporary database."""
    return SchemaManager(temp_sqlite_engine)


class TestSchemaManager:
    """Test schema manager functionality."""
    
    def test_get_database_type(self, schema_manager):
        """Test database type detection."""
        # This will be sqlite since we're using temp_sqlite_engine
        db_type = schema_manager.get_database_type()
        assert db_type == "sqlite"
    
    def test_load_schema_file(self, schema_manager):
        """Test loading schema file."""
        schema_sql = schema_manager.load_schema_file("sqlite")
        assert isinstance(schema_sql, str)
        assert len(schema_sql) > 0
        assert "CREATE TABLE" in schema_sql
        assert "users" in schema_sql
        assert "classes" in schema_sql
        assert "documents" in schema_sql
    
    def test_load_nonexistent_schema_file(self, schema_manager):
        """Test loading non-existent schema file."""
        with pytest.raises(FileNotFoundError):
            schema_manager.load_schema_file("nonexistent")
    
    def test_create_schema(self, schema_manager):
        """Test schema creation."""
        result = schema_manager.create_schema()
        assert result is True
        
        # Verify tables were created
        with schema_manager.engine.connect() as conn:
            result = conn.execute(text(
                "SELECT name FROM sqlite_master WHERE type='table'"
            ))
            tables = {row[0] for row in result}
            
            expected_tables = {
                'users', 'classes', 'documents', 'document_chunks',
                'class_documents', 'student_access', 'audit_logs'
            }
            
            assert expected_tables.issubset(tables)
    
    def test_verify_schema(self, schema_manager):
        """Test schema verification."""
        # First create the schema
        schema_manager.create_schema()
        
        # Then verify it
        result = schema_manager.verify_schema()
        assert result is True
    
    def test_verify_schema_missing_tables(self, schema_manager):
        """Test schema verification with missing tables."""
        # Don't create schema, so tables will be missing
        result = schema_manager.verify_schema()
        assert result is False
    
    def test_get_table_info(self, schema_manager):
        """Test getting table information."""
        # Create schema first
        schema_manager.create_schema()
        
        # Get info for users table
        table_info = schema_manager.get_table_info("users")
        assert table_info is not None
        assert table_info["table_name"] == "users"
        assert "columns" in table_info
        assert len(table_info["columns"]) > 0
        
        # Check for expected columns
        column_names = [col["name"] for col in table_info["columns"]]
        expected_columns = ["id", "email", "name", "role"]
        for col in expected_columns:
            assert col in column_names
    
    def test_get_table_info_nonexistent(self, schema_manager):
        """Test getting info for non-existent table."""
        table_info = schema_manager.get_table_info("nonexistent_table")
        assert table_info is None
    
    def test_reset_schema(self, schema_manager):
        """Test schema reset functionality."""
        # Create initial schema
        schema_manager.create_schema()
        
        # Add some test data
        with schema_manager.engine.connect() as conn:
            conn.execute(text("""
                INSERT INTO users (id, email, name, role) 
                VALUES ('test1', 'test@example.com', 'Test User', 'student')
            """))
            conn.commit()
        
        # Reset schema
        result = schema_manager.reset_schema()
        assert result is True
        
        # Verify tables exist but are empty
        with schema_manager.engine.connect() as conn:
            result = conn.execute(text("SELECT COUNT(*) FROM users"))
            count = result.scalar()
            assert count == 0


class TestSchemaIntegration:
    """Test schema integration with actual database operations."""
    
    def test_create_and_use_schema(self, schema_manager):
        """Test creating schema and performing basic operations."""
        # Create schema
        assert schema_manager.create_schema() is True
        
        # Insert test data
        with schema_manager.engine.connect() as conn:
            # Insert user
            conn.execute(text("""
                INSERT INTO users (id, email, name, role, is_active) 
                VALUES ('teacher1', 'teacher@example.edu', 'Test Teacher', 'teacher', 1)
            """))
            
            # Insert class
            conn.execute(text("""
                INSERT INTO classes (id, name, teacher_id, enabled, daily_question_limit) 
                VALUES ('class1', 'Math 101', 'teacher1', 1, 50)
            """))
            
            # Insert document
            conn.execute(text("""
                INSERT INTO documents (id, name, file_path, file_type, file_size, status) 
                VALUES ('doc1', 'Algebra Book', '/path/to/book.pdf', 'pdf', 1024000, 'ready')
            """))
            
            conn.commit()
        
        # Verify data was inserted
        with schema_manager.engine.connect() as conn:
            # Check user
            result = conn.execute(text("SELECT name FROM users WHERE id = 'teacher1'"))
            user_name = result.scalar()
            assert user_name == "Test Teacher"
            
            # Check class
            result = conn.execute(text("SELECT name FROM classes WHERE id = 'class1'"))
            class_name = result.scalar()
            assert class_name == "Math 101"
            
            # Check document
            result = conn.execute(text("SELECT name FROM documents WHERE id = 'doc1'"))
            doc_name = result.scalar()
            assert doc_name == "Algebra Book"
    
    def test_foreign_key_constraints(self, schema_manager):
        """Test that foreign key constraints work properly."""
        schema_manager.create_schema()
        
        with schema_manager.engine.connect() as conn:
            # Insert teacher
            conn.execute(text("""
                INSERT INTO users (id, email, name, role) 
                VALUES ('teacher1', 'teacher@example.edu', 'Test Teacher', 'teacher')
            """))
            
            # Insert class with valid teacher_id
            conn.execute(text("""
                INSERT INTO classes (id, name, teacher_id) 
                VALUES ('class1', 'Math 101', 'teacher1')
            """))
            
            conn.commit()
        
        # Verify the relationship works
        with schema_manager.engine.connect() as conn:
            result = conn.execute(text("""
                SELECT c.name, u.name 
                FROM classes c 
                JOIN users u ON c.teacher_id = u.id 
                WHERE c.id = 'class1'
            """))
            row = result.fetchone()
            assert row[0] == "Math 101"
            assert row[1] == "Test Teacher"


class TestConvenienceFunctions:
    """Test convenience functions."""
    
    def test_create_database_schema_function(self, monkeypatch, temp_sqlite_engine):
        """Test create_database_schema convenience function."""
        # Mock the default engine
        import school_copilot.backend.models.schema_manager as sm
        monkeypatch.setattr(sm, 'engine', temp_sqlite_engine)
        
        result = create_database_schema()
        assert result is True
    
    def test_verify_database_schema_function(self, monkeypatch, temp_sqlite_engine):
        """Test verify_database_schema convenience function."""
        # Mock the default engine
        import school_copilot.backend.models.schema_manager as sm
        monkeypatch.setattr(sm, 'engine', temp_sqlite_engine)
        
        # Create schema first
        create_database_schema()
        
        # Then verify
        result = verify_database_schema()
        assert result is True