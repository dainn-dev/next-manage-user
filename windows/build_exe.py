#!/usr/bin/env python3
"""
Build script for License Plate Monitor Application
Creates a standalone executable using PyInstaller
"""

import os
import sys
import subprocess
import shutil
from pathlib import Path

def install_pyinstaller():
    """Install PyInstaller if not already installed"""
    try:
        import PyInstaller
        print("✅ PyInstaller is already installed")
        return True
    except ImportError:
        print("📦 Installing PyInstaller...")
        try:
            subprocess.check_call([sys.executable, "-m", "pip", "install", "pyinstaller"])
            print("✅ PyInstaller installed successfully")
            return True
        except subprocess.CalledProcessError as e:
            print(f"❌ Failed to install PyInstaller: {e}")
            return False

def create_spec_file():
    """Create PyInstaller spec file for the application"""
    spec_content = '''# -*- mode: python ; coding: utf-8 -*-

block_cipher = None

a = Analysis(
    ['run_monitor.py'],
    pathex=['.'],
    binaries=[],
    datas=[
        ('config.json', '.'),
        ('license_plates.json', '.'),
        ('model', 'model'),
        ('function', 'function'),
        ('result', 'result'),
        ('test_image', 'test_image'),
    ],
    hiddenimports=[
        'PyQt5.QtCore',
        'PyQt5.QtGui', 
        'PyQt5.QtWidgets',
        'cv2',
        'torch',
        'torchvision',
        'ultralytics',
        'numpy',
        'PIL',
        'requests',
        'pyttsx3',
        'gtts',
        'matplotlib',
        'pandas',
        'seaborn',
        'scipy',
        'pygame',
        'function.helper',
        'function.utils_rotate',
        'function.json_handler',
        'config_manager',
        'config_dialog',
        'tts_manager',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='LicensePlateMonitor',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon='icon.ico' if os.path.exists('icon.ico') else None,
)
'''
    
    with open('LicensePlateMonitor.spec', 'w') as f:
        f.write(spec_content)
    
    print("✅ Created LicensePlateMonitor.spec file")

def build_executable():
    """Build the executable using PyInstaller"""
    print("🔨 Building executable...")
    
    try:
        # Run PyInstaller with the spec file
        cmd = [sys.executable, "-m", "PyInstaller", "--clean", "LicensePlateMonitor.spec"]
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        if result.returncode == 0:
            print("✅ Executable built successfully!")
            print("📁 Output directory: dist/")
            return True
        else:
            print("❌ Build failed!")
            print("Error output:")
            print(result.stderr)
            return False
            
    except Exception as e:
        print(f"❌ Error during build: {e}")
        return False

def create_build_info():
    """Create build information file"""
    build_info = f"""License Plate Monitor - Build Information
==========================================

Build Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
Python Version: {sys.version}
Build System: PyInstaller

Files Included:
- LicensePlateMonitor.exe (Main executable)
- config.json (Configuration file)
- license_plates.json (License plate data)
- model/ (AI models directory)
- function/ (Helper functions)
- result/ (Output images directory)
- test_image/ (Test images)

Usage:
1. Run LicensePlateMonitor.exe
2. Configure settings through the GUI
3. The application will create necessary directories

Notes:
- First run may take longer to initialize AI models
- Make sure you have a working internet connection for API calls
- Camera access will be requested by the application
"""
    
    with open('dist/BUILD_INFO.txt', 'w') as f:
        f.write(build_info)
    
    print("✅ Created build information file")

def main():
    """Main build process"""
    print("🚀 Starting License Plate Monitor Build Process")
    print("=" * 50)
    
    # Change to windows directory
    os.chdir(Path(__file__).parent)
    print(f"📁 Working directory: {os.getcwd()}")
    
    # Install PyInstaller
    if not install_pyinstaller():
        return False
    
    # Create spec file
    create_spec_file()
    
    # Build executable
    if build_executable():
        # Create build info
        create_build_info()
        
        print("\n🎉 Build completed successfully!")
        print("📁 Your executable is in the 'dist' folder")
        print("🚀 Run 'dist/LicensePlateMonitor.exe' to start the application")
        
        # Show file sizes
        exe_path = Path("dist/LicensePlateMonitor.exe")
        if exe_path.exists():
            size_mb = exe_path.stat().st_size / (1024 * 1024)
            print(f"📊 Executable size: {size_mb:.1f} MB")
        
        return True
    else:
        print("\n❌ Build failed!")
        return False

if __name__ == "__main__":
    from datetime import datetime
    main()
