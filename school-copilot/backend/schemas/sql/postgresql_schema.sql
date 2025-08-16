-- PostgreSQL Schema for School Co-Pilot
-- This file contains the complete database schema for PostgreSQL

-- Enable UUID extension for better ID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (teachers, students, admins)
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(50) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('teacher', 'student', 'admin')),
    hashed_password VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP WITH TIME ZONE
);

-- Classes table
CREATE TABLE IF NOT EXISTS classes (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    teacher_id VARCHAR(50) NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    daily_question_limit INTEGER DEFAULT 50 CHECK (daily_question_limit > 0),
    blocked_terms JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Documents table
CREATE TABLE IF NOT EXISTS documents (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_type VARCHAR(10) NOT NULL CHECK (file_type IN ('pdf', 'docx', 'pptx', 'txt', 'gdrive')),
    file_size BIGINT NOT NULL CHECK (file_size > 0),
    page_count INTEGER CHECK (page_count > 0),
    author VARCHAR(255),
    status VARCHAR(20) DEFAULT 'processing' CHECK (status IN ('processing', 'ready', 'error')),
    upload_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_indexed TIMESTAMP WITH TIME ZONE,
    doc_metadata JSONB DEFAULT '{}'::jsonb
);

-- Document chunks table for RAG pipeline
CREATE TABLE IF NOT EXISTS document_chunks (
    id VARCHAR(50) PRIMARY KEY,
    document_id VARCHAR(50) NOT NULL,
    content TEXT NOT NULL,
    page_number INTEGER CHECK (page_number > 0),
    section VARCHAR(255),
    token_count INTEGER NOT NULL CHECK (token_count > 0),
    chunk_index INTEGER NOT NULL CHECK (chunk_index >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

-- Many-to-many relationship between classes and documents
CREATE TABLE IF NOT EXISTS class_documents (
    class_id VARCHAR(50) NOT NULL,
    document_id VARCHAR(50) NOT NULL,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (class_id, document_id),
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

-- Student access control
CREATE TABLE IF NOT EXISTS student_access (
    id SERIAL PRIMARY KEY,
    student_id VARCHAR(50) NOT NULL,
    class_id VARCHAR(50) NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    daily_question_count INTEGER DEFAULT 0 CHECK (daily_question_count >= 0),
    last_question_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(student_id, class_id),
    FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE
);

-- Audit logs for student activities
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    student_id VARCHAR(50) NOT NULL,
    class_id VARCHAR(50) NOT NULL,
    query_text TEXT NOT NULL,
    response_time_ms INTEGER NOT NULL CHECK (response_time_ms >= 0),
    success BOOLEAN NOT NULL,
    citation_count INTEGER DEFAULT 0 CHECK (citation_count >= 0),
    confidence_score REAL CHECK (confidence_score >= 0 AND confidence_score <= 1),
    error_message VARCHAR(500),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_classes_teacher ON classes(teacher_id);
CREATE INDEX IF NOT EXISTS idx_classes_enabled ON classes(enabled);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(file_type);
CREATE INDEX IF NOT EXISTS idx_documents_upload_date ON documents(upload_date);
CREATE INDEX IF NOT EXISTS idx_chunks_document ON document_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_chunks_document_index ON document_chunks(document_id, chunk_index);
CREATE INDEX IF NOT EXISTS idx_student_access_student ON student_access(student_id);
CREATE INDEX IF NOT EXISTS idx_student_access_class ON student_access(class_id);
CREATE INDEX IF NOT EXISTS idx_student_access_enabled ON student_access(enabled);
CREATE INDEX IF NOT EXISTS idx_audit_logs_student ON audit_logs(student_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_class ON audit_logs(class_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_logs_success ON audit_logs(success);

-- GIN indexes for JSONB columns (PostgreSQL specific)
CREATE INDEX IF NOT EXISTS idx_classes_blocked_terms ON classes USING GIN (blocked_terms);
CREATE INDEX IF NOT EXISTS idx_documents_metadata ON documents USING GIN (doc_metadata);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at timestamp
CREATE TRIGGER update_student_access_updated_at 
    BEFORE UPDATE ON student_access 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Views for common queries
CREATE OR REPLACE VIEW class_summary AS
SELECT 
    c.id,
    c.name,
    c.teacher_id,
    u.name as teacher_name,
    c.enabled,
    c.daily_question_limit,
    COUNT(DISTINCT sa.student_id) as student_count,
    COUNT(DISTINCT cd.document_id) as document_count,
    c.created_at
FROM classes c
LEFT JOIN users u ON c.teacher_id = u.id
LEFT JOIN student_access sa ON c.id = sa.class_id AND sa.enabled = TRUE
LEFT JOIN class_documents cd ON c.id = cd.class_id
GROUP BY c.id, c.name, c.teacher_id, u.name, c.enabled, c.daily_question_limit, c.created_at;

CREATE OR REPLACE VIEW student_activity_summary AS
SELECT 
    sa.student_id,
    u.name as student_name,
    u.email as student_email,
    sa.class_id,
    c.name as class_name,
    sa.enabled,
    sa.daily_question_count,
    sa.last_question_date,
    COUNT(al.id) as total_queries,
    AVG(al.response_time_ms) as avg_response_time,
    SUM(CASE WHEN al.success THEN 1 ELSE 0 END) as successful_queries
FROM student_access sa
JOIN users u ON sa.student_id = u.id
JOIN classes c ON sa.class_id = c.id
LEFT JOIN audit_logs al ON sa.student_id = al.student_id AND sa.class_id = al.class_id
GROUP BY sa.student_id, u.name, u.email, sa.class_id, c.name, sa.enabled, sa.daily_question_count, sa.last_question_date;