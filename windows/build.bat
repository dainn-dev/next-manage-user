@echo off
echo ========================================
echo License Plate Monitor - Build Script
echo ========================================
echo.

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python is not installed or not in PATH
    echo Please install Python 3.8+ and try again
    pause
    exit /b 1
)

echo Python found, proceeding with build...
echo.

REM Install requirements
echo Installing/updating requirements...
python -m pip install --upgrade pip
python -m pip install -r requirement.txt

REM Install PyInstaller if not present
echo Installing PyInstaller...
python -m pip install pyinstaller

REM Run the build script
echo Starting build process...
python build_exe.py

echo.
echo Build process completed!
echo Check the 'dist' folder for your executable.
echo.
pause
