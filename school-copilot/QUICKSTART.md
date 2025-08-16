# School Co-Pilot Quick Start Guide

Get the School Co-Pilot RAG pipeline up and running in minutes!

## 🚀 Quick Test (No Installation Required)

If you just want to see if everything is set up correctly:

### Windows
```cmd
# Double-click or run:
test_setup.bat
```

### PowerShell
```powershell
.\test_setup.ps1
```

### Any Platform
```bash
python test_setup.py
```

## 📋 Prerequisites

1. **Python 3.9+** - [Download here](https://python.org/downloads/)
2. **Git** (optional) - For cloning the repository

## ⚡ 5-Minute Setup

### Step 1: Install Python Dependencies
```bash
cd school-copilot/backend
pip install fastapi uvicorn sqlalchemy pydantic sentence-transformers faiss-cpu numpy PyPDF2 python-docx python-pptx passlib python-jose
```

### Step 2: Test the Setup
```bash
python ../test_setup.py
```

### Step 3: Start the Backend
```bash
python -m uvicorn main:app --reload --port 8000
```

### Step 4: Open API Documentation
Open your browser to: http://localhost:8000/docs

## 🧪 Test the RAG Pipeline

### Option 1: CLI Test (Recommended)
```bash
cd school-copilot/backend
python cli/test_rag.py
```

### Option 2: API Test
1. Go to http://localhost:8000/docs
2. Try the `/health` endpoint first
3. Create demo users with `/api/auth/create-demo-users`
4. Login and test document upload/query

### Option 3: Manual Test with Sample Data

1. **Create a test document:**
   ```bash
   # Sample documents are already in backend/sample_data/
   ls backend/sample_data/
   ```

2. **Test via API:**
   - Upload `algebra_textbook.txt` via `/api/docs/upload`
   - Create a class via `/api/classes/`
   - Assign document to class
   - Test queries like "What is algebra?" or "How do you solve linear equations?"

## 📊 Expected Results

### ✅ Successful Test Output
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
✓ Document indexed successfully
Index stats: {'exists': True, 'total_vectors': 8, 'dimension': 384}

4. Testing query processing...

Query: What is algebra?
Answer: Based on the course materials: Algebra is a branch of mathematics that uses symbols and letters to represent numbers and quantities in formulas and equations.
Confidence: 0.85
Citations: 1
Processing time: 150ms

Query: What is calculus?
Answer: I can't find this in the school materials.
Confidence: 0.00
Citations: 0
Processing time: 100ms
```

### 🔍 Key Features Demonstrated

1. **✅ Corpus-Only Responses**: Questions not in documents return "can't find this"
2. **✅ Accurate Citations**: Responses include document references and confidence scores
3. **✅ Fast Processing**: Sub-second response times
4. **✅ Security**: Authentication required for all operations

## 🛠️ Troubleshooting

### Common Issues

**"Python not found"**
- Install Python from python.org or Microsoft Store
- Make sure Python is in your PATH

**"Module not found" errors**
- Run: `pip install -r backend/requirements.txt`

**"FAISS not found"**
- Run: `pip install faiss-cpu`

**Slow first run**
- The sentence-transformers model (~90MB) downloads on first use
- Subsequent runs will be much faster

**Database errors**
- Delete `backend/data/school_copilot.db` if it exists
- Restart the test

## 🎯 Next Steps

Once the basic test works:

1. **Try the Chrome Extension**: Load `extension/` folder in Chrome developer mode
2. **Test the Dashboard**: Run `cd dashboard && npm start`
3. **Upload Real Documents**: Test with your own PDF/DOCX files
4. **Multi-User Testing**: Create multiple classes and students
5. **Production Setup**: Follow the full deployment guide

## 📚 Documentation

- **Full Testing Guide**: See `TESTING.md`
- **API Documentation**: http://localhost:8000/docs (when server is running)
- **Architecture Overview**: See `design.md` in the specs folder

## 🆘 Need Help?

1. Check the troubleshooting section above
2. Review the logs in `backend/logs/` (if they exist)
3. Run the diagnostic script: `python test_setup.py`
4. Make sure all prerequisites are installed

## 🎉 Success!

If you see the expected test output above, congratulations! Your School Co-Pilot RAG pipeline is working correctly. The system is now ready to:

- Process and index educational documents
- Answer student questions using only school-approved content
- Provide accurate citations and confidence scores
- Maintain strict data isolation between classes
- Log all activities for FERPA compliance

You're ready to move on to testing the Chrome extension and teacher dashboard!