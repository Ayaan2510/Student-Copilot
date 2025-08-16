"""Database schema management utilities."""

import os
import logging
from pathlib import Path
from typing import Optional
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine
from .database import engine, DATABASE_URL

logger = logging.getLogger(__name__)


class SchemaManager:
    """Manages database schema creation and migrations."""
    
    def __init__(self, engine: Engine = engine):
        self.engine = engine
        self.schema_dir = Path(__file__).parent.parent / "schemas" / "sql"
    
    def get_database_type(self) -> str:
        """Determine database type from connection string."""
        if DATABASE_URL.startswith("sqlite"):
            return "sqlite"
        elif DATABASE_URL.startswith("postgresql"):
            return "postgresql"
        else:
            raise ValueError(f"Unsupported database type in URL: {DATABASE_URL}")
    
    def load_schema_file(self, db_type: str) -> str:
        """Load SQL schema file for the specified database type."""
        schema_file = self.schema_dir / f"{db_type}_schema.sql"
        
        if not schema_file.exists():
            raise FileNotFoundError(f"Schema file not found: {schema_file}")
        
        with open(schema_file, 'r', encoding='utf-8') as f:
            return f.read()
    
    def create_schema(self) -> bool:
        """Create database schema using SQL files."""
        try:
            db_type = self.get_database_type()
            schema_sql = self.load_schema_file(db_type)
            
            logger.info(f"Creating {db_type} database schema...")
            
            # For SQLite, ensure data directory exists
            if db_type == "sqlite" and DATABASE_URL.startswith("sqlite:///"):
                db_path = DATABASE_URL.replace("sqlite:///", "")
                os.makedirs(os.path.dirname(db_path), exist_ok=True)
            
            # Execute schema creation
            with self.engine.connect() as conn:
                # Split SQL file into individual statements
                statements = [stmt.strip() for stmt in schema_sql.split(';') if stmt.strip()]
                
                for statement in statements:
                    if statement:
                        try:
                            conn.execute(text(statement))
                        except Exception as e:
                            # Log warning but continue (some statements might already exist)
                            logger.warning(f"Statement execution warning: {e}")
                
                conn.commit()
            
            logger.info("Database schema created successfully")
            return True
            
        except Exception as e:
            logger.error(f"Failed to create database schema: {e}")
            return False
    
    def verify_schema(self) -> bool:
        """Verify that all required tables exist."""
        required_tables = [
            'users', 'classes', 'documents', 'document_chunks',
            'class_documents', 'student_access', 'audit_logs'
        ]
        
        try:
            with self.engine.connect() as conn:
                # Get list of existing tables
                if self.get_database_type() == "sqlite":
                    result = conn.execute(text(
                        "SELECT name FROM sqlite_master WHERE type='table'"
                    ))
                else:  # PostgreSQL
                    result = conn.execute(text(
                        "SELECT tablename FROM pg_tables WHERE schemaname='public'"
                    ))
                
                existing_tables = {row[0] for row in result}
                missing_tables = set(required_tables) - existing_tables
                
                if missing_tables:
                    logger.error(f"Missing tables: {missing_tables}")
                    return False
                
                logger.info("All required tables exist")
                return True
                
        except Exception as e:
            logger.error(f"Failed to verify schema: {e}")
            return False
    
    def get_table_info(self, table_name: str) -> Optional[dict]:
        """Get information about a specific table."""
        try:
            with self.engine.connect() as conn:
                if self.get_database_type() == "sqlite":
                    result = conn.execute(text(f"PRAGMA table_info({table_name})"))
                    columns = [
                        {
                            'name': row[1],
                            'type': row[2],
                            'nullable': not row[3],
                            'default': row[4],
                            'primary_key': bool(row[5])
                        }
                        for row in result
                    ]
                else:  # PostgreSQL
                    result = conn.execute(text("""
                        SELECT column_name, data_type, is_nullable, column_default
                        FROM information_schema.columns
                        WHERE table_name = :table_name
                        ORDER BY ordinal_position
                    """), {"table_name": table_name})
                    
                    columns = [
                        {
                            'name': row[0],
                            'type': row[1],
                            'nullable': row[2] == 'YES',
                            'default': row[3],
                            'primary_key': False  # Would need additional query
                        }
                        for row in result
                    ]
                
                return {
                    'table_name': table_name,
                    'columns': columns,
                    'column_count': len(columns)
                }
                
        except Exception as e:
            logger.error(f"Failed to get table info for {table_name}: {e}")
            return None
    
    def reset_schema(self) -> bool:
        """Drop all tables and recreate schema (USE WITH CAUTION)."""
        try:
            logger.warning("Resetting database schema - all data will be lost!")
            
            with self.engine.connect() as conn:
                if self.get_database_type() == "sqlite":
                    # Get all table names
                    result = conn.execute(text(
                        "SELECT name FROM sqlite_master WHERE type='table'"
                    ))
                    tables = [row[0] for row in result]
                    
                    # Drop all tables
                    for table in tables:
                        conn.execute(text(f"DROP TABLE IF EXISTS {table}"))
                        
                else:  # PostgreSQL
                    # Drop all tables in public schema
                    conn.execute(text("""
                        DROP SCHEMA public CASCADE;
                        CREATE SCHEMA public;
                        GRANT ALL ON SCHEMA public TO public;
                    """))
                
                conn.commit()
            
            # Recreate schema
            return self.create_schema()
            
        except Exception as e:
            logger.error(f"Failed to reset schema: {e}")
            return False


# Convenience functions
def create_database_schema() -> bool:
    """Create database schema using the default engine."""
    manager = SchemaManager()
    return manager.create_schema()


def verify_database_schema() -> bool:
    """Verify database schema using the default engine."""
    manager = SchemaManager()
    return manager.verify_schema()


def get_schema_info() -> dict:
    """Get comprehensive schema information."""
    manager = SchemaManager()
    
    tables = [
        'users', 'classes', 'documents', 'document_chunks',
        'class_documents', 'student_access', 'audit_logs'
    ]
    
    info = {
        'database_type': manager.get_database_type(),
        'database_url': DATABASE_URL,
        'tables': {}
    }
    
    for table in tables:
        table_info = manager.get_table_info(table)
        if table_info:
            info['tables'][table] = table_info
    
    return info