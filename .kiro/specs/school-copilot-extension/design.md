# Design Document

## Overview

The School Co-Pilot system is architected as a three-tier application consisting of a Chrome extension frontend, a teacher dashboard web application, and a RAG-powered backend service. The design prioritizes data privacy, teacher control, and student usability while maintaining strict isolation between school document collections and external data sources.

## Architecture

### High-Level Architecture

```mermaid
graph TB
    subgraph "Student Environment"
        CE[Chrome Extension]
        CS[Content Script]
        SP[Side Panel]
        SW[Service Worker]
    end
    
    subgraph "Teacher Environment"
        TD[Teacher Dashboard]
        WB[Web Browser]
    end
    
    subgraph "Backend Services"
        API[FastAPI Server]
        RAG[RAG Service]
        AUTH[Auth Service]
        VDB[Vector Database]
        MDB[Metadata DB]
    end
    
    subgraph "Storage"
        DOCS[Document Storage]
        EMBED[Embeddings]
        LOGS[Audit Logs]
    end
    
    CE --> API
    TD --> API
    API --> RAG
    API --> AUTH
    RAG --> VDB
    RAG --> DOCS
    API --> MDB
    API --> LOGS
```

### Component Interaction Flow

1. **Student Query Flow**: Extension → Service Worker → API → RAG Service → Vector DB → Response with Citations
2. **Teacher Control Flow**: Dashboard → API → Metadata DB → Permission Updates → Real-time Extension Updates
3. **Document Management Flow**: Dashboard → API → Document Processing → Embedding Generation → Vector DB Update

## Components and Interfaces

### Chrome Extension Components

#### Manifest V3 Structure
```json
{
  "manifest_version": 3,
  "name": "School Co-Pilot",
  "permissions": ["storage", "scripting", "activeTab", "sidePanel", "commands"],
  "background": {
    "service_worker": "service_worker.js"
  },
  "content_scripts": [{
    "matches": ["<all_urls>"],
    "js": ["content_script.js"]
  }],
  "side_panel": {
    "default_path": "sidepanel.html"
  },
  "commands": {
    "open_copilot": {
      "suggested_key": {
        "default": "Alt+Shift+C"
      }
    }
  }
}
```

#### Service Worker (service_worker.ts)
- **Purpose**: Background processing, API communication, permission management
- **Key Functions**:
  - `handleQuery(query: string, classId: string): Promise<QueryResponse>`
  - `checkPermissions(studentId: string): Promise<PermissionStatus>`
  - `syncSettings(): Promise<void>`
  - `logActivity(activity: ActivityLog): Promise<void>`

#### Side Panel (sidepanel.tsx)
- **Purpose**: Main student interface for queries and responses
- **Key Components**:
  - `ChatInterface`: Message display and input handling
  - `CitationPanel`: Document source display
  - `QuickActions`: Summarize, Define, Explain buttons
  - `ClassSelector`: Active class selection dropdown

#### Content Script (content_script.ts)
- **Purpose**: Text selection integration and page context
- **Key Functions**:
  - `handleTextSelection(): void`
  - `injectContextMenu(): void`
  - `highlightReferences(citations: Citation[]): void`

### Backend API Service

#### FastAPI Server Structure
```python
# Core endpoints
@app.post("/auth/login")
async def login(credentials: LoginRequest) -> AuthResponse

@app.post("/query")
async def query_documents(request: QueryRequest) -> QueryResponse

@app.post("/docs/upload")
async def upload_document(file: UploadFile, class_id: str) -> UploadResponse

@app.get("/docs/list")
async def list_documents(class_id: str) -> List[DocumentInfo]

@app.post("/classes/set-access")
async def set_class_access(request: AccessRequest) -> StatusResponse

@app.get("/logs/list")
async def get_audit_logs(filters: LogFilters) -> List[AuditLog]
```

#### RAG Service (rag_service.py)
- **Document Processing Pipeline**:
  1. Document ingestion and text extraction
  2. Chunking with 500-800 token windows and 100-token overlap
  3. Embedding generation using sentence-transformers
  4. Vector storage with metadata indexing
- **Query Processing Pipeline**:
  1. Query embedding generation
  2. Similarity search within class-specific collections
  3. Context assembly and response generation
  4. Citation extraction and formatting

### Teacher Dashboard

#### React Application Structure
```typescript
// Main dashboard components
interface DashboardProps {
  user: TeacherUser;
  classes: ClassInfo[];
}

// Core pages
- ClassManagement: Student roster and access controls
- DocumentManager: Upload, assign, and index documents
- ControlPanel: Guardrails and usage policies
- AuditLogs: Student activity monitoring
```

## Data Models

### Core Data Structures

#### Student Query Model
```typescript
interface QueryRequest {
  studentId: string;
  classId: string;
  query: string;
  timestamp: Date;
  sessionId: string;
}

interface QueryResponse {
  answer: string;
  citations: Citation[];
  usedDocuments: DocumentReference[];
  confidence: number;
  processingTime: number;
}
```

#### Document Model
```typescript
interface Document {
  id: string;
  name: string;
  type: 'pdf' | 'docx' | 'pptx' | 'txt' | 'gdrive';
  uploadDate: Date;
  assignedClasses: string[];
  chunks: DocumentChunk[];
  metadata: DocumentMetadata;
}

interface DocumentChunk {
  id: string;
  content: string;
  embedding: number[];
  pageNumber?: number;
  section?: string;
  tokenCount: number;
}
```

#### Access Control Model
```typescript
interface ClassAccess {
  classId: string;
  enabled: boolean;
  studentOverrides: Map<string, boolean>;
  documentIds: string[];
  dailyQuestionLimit: number;
  blockedTerms: string[];
}
```

### Database Schema

#### Vector Database (FAISS/pgvector)
- **Collections**: Organized by class ID for strict isolation
- **Embeddings**: 384-dimensional vectors from sentence-transformers
- **Metadata**: Document ID, chunk ID, page numbers, sections

#### Metadata Database (SQLite/PostgreSQL)
```sql
-- Core tables
CREATE TABLE classes (
  id VARCHAR PRIMARY KEY,
  name VARCHAR NOT NULL,
  teacher_id VARCHAR NOT NULL,
  enabled BOOLEAN DEFAULT true
);

CREATE TABLE documents (
  id VARCHAR PRIMARY KEY,
  name VARCHAR NOT NULL,
  file_path VARCHAR NOT NULL,
  upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR DEFAULT 'processing'
);

CREATE TABLE class_documents (
  class_id VARCHAR REFERENCES classes(id),
  document_id VARCHAR REFERENCES documents(id),
  PRIMARY KEY (class_id, document_id)
);

CREATE TABLE audit_logs (
  id SERIAL PRIMARY KEY,
  student_id VARCHAR NOT NULL,
  class_id VARCHAR NOT NULL,
  query_text TEXT NOT NULL,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  response_time_ms INTEGER
);
```

## Error Handling

### Extension Error Handling
- **Network Failures**: Display offline message, cache queries for retry
- **Permission Denied**: Show teacher contact information and access status
- **Rate Limiting**: Display remaining questions and reset time
- **Invalid Responses**: Log errors and show generic "Please try again" message

### Backend Error Handling
- **Document Processing Failures**: Log errors, notify teachers, mark documents as failed
- **Vector Search Failures**: Fallback to text search, log performance metrics
- **Authentication Failures**: Clear tokens, redirect to login, log security events
- **Database Failures**: Implement circuit breakers, graceful degradation

### Graceful Degradation
- **Offline Mode**: Show cached responses with offline indicators
- **Reduced Functionality**: Disable features based on available services
- **Performance Issues**: Implement request queuing and timeout handling

## Testing Strategy

### Unit Testing
- **Extension Components**: Jest with Chrome extension mocks
- **Backend Services**: pytest with FastAPI test client
- **RAG Pipeline**: Embedding quality tests and retrieval accuracy metrics
- **Database Operations**: Transaction rollback tests and data integrity checks

### Integration Testing
- **End-to-End Flows**: Playwright tests for complete user journeys
- **API Contract Testing**: OpenAPI specification validation
- **Permission Testing**: Role-based access control verification
- **Cross-Browser Testing**: Chrome, Edge, and Firefox compatibility

### Security Testing
- **Permission Auditing**: Verify minimal permission usage
- **Data Isolation**: Test class-based document separation
- **Input Validation**: SQL injection and XSS prevention
- **Authentication**: JWT token validation and expiration handling

### Performance Testing
- **Query Response Time**: Target <2 seconds for 95th percentile
- **Document Processing**: Batch upload and indexing performance
- **Concurrent Users**: Load testing with multiple simultaneous queries
- **Memory Usage**: Extension memory footprint monitoring

## Security Considerations

### Data Protection
- **Encryption**: AES-256 for document storage, TLS 1.3 for transport
- **Access Control**: Role-based permissions with principle of least privilege
- **Data Retention**: Configurable log retention periods, automatic cleanup
- **Audit Trail**: Immutable logs for all administrative actions

### Chrome Extension Security
- **Content Security Policy**: Strict CSP headers preventing XSS
- **Permission Minimization**: Only request necessary permissions
- **Secure Communication**: HTTPS-only API endpoints
- **Local Storage**: Encrypted sensitive data, automatic session cleanup

### Backend Security
- **Input Validation**: Comprehensive sanitization and validation
- **Rate Limiting**: Per-user and per-endpoint rate limits
- **CORS Configuration**: Strict origin validation
- **Dependency Management**: Regular security updates and vulnerability scanning

## Deployment Architecture

### Development Environment
- **Local Backend**: FastAPI with SQLite and local file storage
- **Extension Development**: Chrome developer mode with hot reload
- **Document Processing**: Local sentence-transformers model

### Production Environment
- **Containerized Backend**: Docker containers with health checks
- **Database**: PostgreSQL with pgvector extension
- **File Storage**: School-controlled network storage or cloud storage
- **Load Balancing**: Nginx reverse proxy with SSL termination

### Configuration Management
```json
// school.config.json
{
  "school": {
    "name": "Example High School",
    "domain": "example.edu",
    "adminEmail": "admin@example.edu"
  },
  "auth": {
    "jwtSecret": "generated-secret",
    "sessionTimeout": 3600,
    "ssoProvider": "placeholder"
  },
  "storage": {
    "documentsPath": "/var/school-copilot/documents",
    "databaseUrl": "postgresql://user:pass@localhost/schoolcopilot"
  },
  "features": {
    "maxDailyQuestions": 50,
    "enableAnimations": true,
    "logRetentionDays": 90
  }
}
```