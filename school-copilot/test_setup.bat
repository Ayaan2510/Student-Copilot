@echo off
echo School Co-Pilot Setup Test
echo ========================

echo.
echo Checking Python installation...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Python not found. Please install Python 3.9+ from python.org
    echo or from the Microsoft Store.
    pause
    exit /b 1
)

python --version
echo.

echo Running setup check...
python test_setup.py

echo.
echo Setup check complete!
pause