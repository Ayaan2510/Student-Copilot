-- SQLite Schema for School Co-Pilot
-- This file contains the complete database schema for SQLite

-- Users table (teachers, students, admins)
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(50) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('teacher', 'student', 'admin')),
    hashed_password VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME
);

-- Classes table
CREATE TABLE IF NOT EXISTS classes (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    teacher_id VARCHAR(50) NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    daily_question_limit INTEGER DEFAULT 50,
    blocked_terms TEXT DEFAULT '[]', -- JSON array
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Documents table
CREATE TABLE IF NOT EXISTS documents (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_type VARCHAR(10) NOT NULL CHECK (file_type IN ('pdf', 'docx', 'pptx', 'txt', 'gdrive')),
    file_size INTEGER NOT NULL,
    page_count INTEGER,
    author VARCHAR(255),
    status VARCHAR(20) DEFAULT 'processing' CHECK (status IN ('processing', 'ready', 'error')),
    upload_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_indexed DATETIME,
    doc_metadata TEXT DEFAULT '{}' -- JSON object
);

-- Document chunks table for RAG pipeline
CREATE TABLE IF NOT EXISTS document_chunks (
    id VARCHAR(50) PRIMARY KEY,
    document_id VARCHAR(50) NOT NULL,
    content TEXT NOT NULL,
    page_number INTEGER,
    section VARCHAR(255),
    token_count INTEGER NOT NULL,
    chunk_index INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

-- Many-to-many relationship between classes and documents
CREATE TABLE IF NOT EXISTS class_documents (
    class_id VARCHAR(50) NOT NULL,
    document_id VARCHAR(50) NOT NULL,
    assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (class_id, document_id),
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

-- Student access control
CREATE TABLE IF NOT EXISTS student_access (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id VARCHAR(50) NOT NULL,
    class_id VARCHAR(50) NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    daily_question_count INTEGER DEFAULT 0,
    last_question_date DATE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(student_id, class_id),
    FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE
);

-- Audit logs for student activities
CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id VARCHAR(50) NOT NULL,
    class_id VARCHAR(50) NOT NULL,
    query_text TEXT NOT NULL,
    response_time_ms INTEGER NOT NULL,
    success BOOLEAN NOT NULL,
    citation_count INTEGER DEFAULT 0,
    confidence_score REAL,
    error_message VARCHAR(500),
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_classes_teacher ON classes(teacher_id);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(file_type);
CREATE INDEX IF NOT EXISTS idx_chunks_document ON document_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_student_access_student ON student_access(student_id);
CREATE INDEX IF NOT EXISTS idx_student_access_class ON student_access(class_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_student ON audit_logs(student_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_class ON audit_logs(class_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);

-- Triggers to update updated_at timestamp
CREATE TRIGGER IF NOT EXISTS update_student_access_timestamp 
    AFTER UPDATE ON student_access
    BEGIN
        UPDATE student_access SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;