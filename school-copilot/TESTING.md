# School Co-Pilot Testing Guide

This guide explains how to test the School Co-Pilot RAG pipeline and backend services.

## Prerequisites

1. **Python 3.9+** - Install from [python.org](https://python.org) or Microsoft Store
2. **Node.js 18+** - For the dashboard and extension
3. **Git** - For version control

## Setup Instructions

### 1. Install Python Dependencies

```bash
cd school-copilot/backend
pip install -r requirements.txt
```

### 2. Install Node.js Dependencies

```bash
cd school-copilot
npm install
cd dashboard && npm install
cd ../extension && npm install
```

### 3. Create Data Directories

```bash
mkdir -p data/documents data/embeddings data/models data/vector_db
```

## Testing Methods

### Method 1: CLI Test Script (Recommended)

Run the comprehensive RAG pipeline test:

```bash
cd school-copilot/backend
python cli/test_rag.py
```

This will:
- Create test database tables
- Create sample users (teacher and student)
- Create a test class with sample documents
- Index documents using the RAG pipeline
- Test various queries and show results

### Method 2: Unit Tests

Run the test suite:

```bash
cd school-copilot/backend
python -m pytest tests/ -v
```

Run specific test modules:
```bash
python -m pytest tests/test_rag.py -v
python -m pytest tests/test_auth.py -v
python -m pytest tests/test_models.py -v
```

### Method 3: API Testing with FastAPI

1. Start the backend server:
```bash
cd school-copilot/backend
python -m uvicorn main:app --reload --port 8000
```

2. Open the interactive API docs:
   - Go to `http://localhost:8000/docs`
   - Test endpoints directly in the browser

3. Test the health endpoint:
```bash
curl http://localhost:8000/health
```

### Method 4: Manual API Testing

#### Step 1: Create Demo Users
```bash
curl -X POST "http://localhost:8000/api/auth/create-demo-users" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

#### Step 2: Login as Teacher
```bash
curl -X POST "http://localhost:8000/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "teacher@example.edu",
    "password": "demo123",
    "domain": "example.edu"
  }'
```

#### Step 3: Create a Class
```bash
curl -X POST "http://localhost:8000/api/classes/" \
  -H "Authorization: Bearer YOUR_TEACHER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Mathematics 101",
    "daily_question_limit": 50,
    "blocked_terms": []
  }'
```

#### Step 4: Upload a Document
```bash
curl -X POST "http://localhost:8000/api/docs/upload" \
  -H "Authorization: Bearer YOUR_TEACHER_TOKEN" \
  -F "file=@sample_document.txt" \
  -F "class_id=YOUR_CLASS_ID"
```

#### Step 5: Test Query (as Student)
```bash
curl -X POST "http://localhost:8000/api/query/" \
  -H "Authorization: Bearer YOUR_STUDENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "student_id": "YOUR_STUDENT_ID",
    "class_id": "YOUR_CLASS_ID",
    "query": "What is mathematics?",
    "session_id": "test_session_1"
  }'
```

## Expected Test Results

### Successful RAG Pipeline Test

When running the CLI test, you should see:

```
School Co-Pilot RAG Pipeline Test
========================================
✓ Database tables created

1. Creating test data...
Created test teacher: teacher@example.edu
Created test student: student@example.edu
Created test class: Mathematics 101

2. Creating test document...
Created test document: Algebra Textbook.txt

3. Testing document indexing...
Indexing document: Algebra Textbook.txt
✓ Document indexed successfully
Index stats: {'exists': True, 'total_vectors': 5, 'dimension': 384, 'chunk_count': 5}

4. Testing query processing...

Query: What is algebra?
Answer: Based on the course materials: Algebra is a branch of mathematics that uses symbols and letters to represent numbers and quantities in formulas and equations.
Confidence: 0.85
Citations: 1
Processing time: 150ms
  Citation 1: Algebra Textbook.txt (score: 0.85)

Query: How do you solve linear equations?
Answer: Based on the course materials: To solve a linear equation, we need to isolate the variable on one side of the equation. For example, to solve 2x + 6 = 14, we subtract 6 from both sides to get 2x = 8, then divide both sides by 2 to get x = 4.
Confidence: 0.82
Citations: 1
Processing time: 120ms
  Citation 1: Algebra Textbook.txt (score: 0.82)

Query: What is calculus?
Answer: I can't find this in the school materials.
Confidence: 0.00
Citations: 0
Processing time: 100ms

========================================
RAG Pipeline test completed!
```

### Key Features to Verify

1. **Corpus-Only Responses**: Queries about topics not in documents return "can't find this"
2. **Accurate Citations**: Responses include document name, page numbers, and relevance scores
3. **Class Isolation**: Students only get answers from their assigned class documents
4. **Performance**: Response times under 2 seconds
5. **Security**: Authentication required for all operations

## Troubleshooting

### Common Issues

1. **"Module not found" errors**:
   ```bash
   pip install -r requirements.txt
   ```

2. **"No module named sentence_transformers"**:
   ```bash
   pip install sentence-transformers
   ```

3. **FAISS installation issues**:
   ```bash
   pip install faiss-cpu
   ```

4. **Database errors**:
   - Delete `data/school_copilot.db` and restart
   - Check file permissions in `data/` directory

5. **Memory issues with embeddings**:
   - Reduce chunk size in configuration
   - Use smaller embedding model

### Performance Optimization

1. **First-time model download**: The sentence-transformers model (~90MB) downloads on first use
2. **Embedding cache**: Embeddings are cached to disk for faster subsequent access
3. **Vector index persistence**: FAISS indexes are saved to disk and reloaded

## Development Testing

### Adding New Test Cases

1. Create test documents in `data/documents/`
2. Add test queries to `cli/test_rag.py`
3. Run tests and verify results

### Testing New Document Types

1. Add sample files (PDF, DOCX, PPTX)
2. Test upload via API
3. Verify text extraction and chunking
4. Test query responses

### Testing Security Features

1. Test blocked terms functionality
2. Verify daily question limits
3. Test class access controls
4. Verify audit logging

## Production Deployment Testing

Before deploying to production:

1. Run full test suite: `python -m pytest tests/ -v`
2. Test with realistic document sizes (10-50MB PDFs)
3. Test concurrent user scenarios
4. Verify backup and recovery procedures
5. Test SSL/HTTPS configuration
6. Verify FERPA compliance logging

## Monitoring and Metrics

Key metrics to monitor:
- Query response times (target: <2 seconds)
- Document processing times
- Vector index sizes
- Memory usage
- Error rates
- User activity patterns

## Support

If you encounter issues:
1. Check the logs in `logs/` directory
2. Review the troubleshooting section above
3. Run the diagnostic CLI script
4. Check system requirements and dependencies