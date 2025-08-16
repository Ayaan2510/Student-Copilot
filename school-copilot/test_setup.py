#!/usr/bin/env python3
"""
Simple test setup script to verify the School Co-Pilot installation.
Run this to check if all dependencies are properly installed.
"""

import sys
import importlib
import os

def check_python_version():
    """Check if Python version is compatible."""
    version = sys.version_info
    if version.major < 3 or (version.major == 3 and version.minor < 9):
        print(f"❌ Python {version.major}.{version.minor} detected. Python 3.9+ required.")
        return False
    print(f"✅ Python {version.major}.{version.minor}.{version.micro} - Compatible")
    return True

def check_dependencies():
    """Check if required Python packages are installed."""
    required_packages = [
        'fastapi',
        'uvicorn',
        'sqlalchemy',
        'pydantic',
        'sentence_transformers',
        'faiss',
        'numpy',
        'PyPDF2',
        'python_docx',
        'python_pptx',
        'passlib',
        'python_jose'
    ]
    
    missing_packages = []
    
    for package in required_packages:
        try:
            # Handle package name variations
            if package == 'python_docx':
                importlib.import_module('docx')
            elif package == 'python_pptx':
                importlib.import_module('pptx')
            elif package == 'python_jose':
                importlib.import_module('jose')
            elif package == 'faiss':
                importlib.import_module('faiss')
            else:
                importlib.import_module(package)
            print(f"✅ {package}")
        except ImportError:
            print(f"❌ {package} - Not installed")
            missing_packages.append(package)
    
    return missing_packages

def check_directories():
    """Check if required directories exist."""
    required_dirs = [
        'school-copilot/backend',
        'school-copilot/extension', 
        'school-copilot/dashboard',
        'school-copilot/shared',
        'school-copilot/config'
    ]
    
    missing_dirs = []
    
    for dir_path in required_dirs:
        if os.path.exists(dir_path):
            print(f"✅ {dir_path}")
        else:
            print(f"❌ {dir_path} - Directory not found")
            missing_dirs.append(dir_path)
    
    return missing_dirs

def check_sample_data():
    """Check if sample data files exist."""
    sample_files = [
        'school-copilot/backend/sample_data/algebra_textbook.txt',
        'school-copilot/backend/sample_data/geometry_basics.txt'
    ]
    
    for file_path in sample_files:
        if os.path.exists(file_path):
            print(f"✅ {file_path}")
        else:
            print(f"❌ {file_path} - Sample file not found")

def main():
    """Main test function."""
    print("School Co-Pilot Installation Check")
    print("=" * 50)
    
    # Check Python version
    print("\n1. Checking Python version...")
    python_ok = check_python_version()
    
    # Check directories
    print("\n2. Checking project structure...")
    missing_dirs = check_directories()
    
    # Check sample data
    print("\n3. Checking sample data...")
    check_sample_data()
    
    # Check dependencies
    print("\n4. Checking Python dependencies...")
    missing_packages = check_dependencies()
    
    # Summary
    print("\n" + "=" * 50)
    print("SUMMARY")
    print("=" * 50)
    
    if not python_ok:
        print("❌ Python version incompatible")
        print("   Please install Python 3.9 or higher")
        return False
    
    if missing_dirs:
        print("❌ Missing directories:")
        for dir_path in missing_dirs:
            print(f"   - {dir_path}")
        print("   Please ensure the project structure is complete")
        return False
    
    if missing_packages:
        print("❌ Missing Python packages:")
        for package in missing_packages:
            print(f"   - {package}")
        print("\n   To install missing packages, run:")
        print("   pip install " + " ".join(missing_packages))
        return False
    
    print("✅ All checks passed!")
    print("\nNext steps:")
    print("1. Install missing packages if any were listed above")
    print("2. Run the backend server: python -m uvicorn school-copilot.backend.main:app --reload")
    print("3. Test the API at: http://localhost:8000/docs")
    print("4. Run the RAG test: python school-copilot/backend/cli/test_rag.py")
    
    return True

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)