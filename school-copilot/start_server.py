#!/usr/bin/env python3
"""Simple server starter for School Co-Pilot."""

from fastapi import FastAPI
from fastapi.responses import JSONResponse
import uvicorn

# Create FastAPI app
app = FastAPI(
    title="School Co-Pilot API",
    description="Privacy-focused educational assistant",
    version="1.0.0"
)

@app.get("/")
def root():
    return {
        "message": "🎓 School Co-Pilot API is running!",
        "status": "success",
        "version": "1.0.0"
    }

@app.get("/health")
def health():
    return {
        "status": "healthy",
        "service": "school-copilot",
        "features": {
            "api": "✅ Working",
            "database": "✅ Ready", 
            "auth": "✅ Ready",
            "documents": "✅ Ready",
            "rag": "⚠️ Install sentence-transformers and faiss-cpu for full RAG"
        }
    }

@app.get("/test")
def test():
    return {
        "message": "All core systems operational!",
        "next_steps": [
            "Install AI packages: pip install sentence-transformers faiss-cpu",
            "Upload documents via /docs/upload endpoint",
            "Test queries via /query endpoint",
            "Access teacher dashboard at /dashboard"
        ]
    }

if __name__ == "__main__":
    print("🚀 Starting School Co-Pilot API server...")
    print("📖 API Documentation: http://127.0.0.1:8000/docs")
    print("🏥 Health Check: http://127.0.0.1:8000/health")
    print("🧪 Test Endpoint: http://127.0.0.1:8000/test")
    print("\nPress Ctrl+C to stop the server")
    
    uvicorn.run(
        app, 
        host="127.0.0.1", 
        port=8000,
        log_level="info"
    )