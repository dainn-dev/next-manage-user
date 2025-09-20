# License Plate Monitor - Build Instructions

This guide will help you build the License Plate Monitor application into a standalone executable file.

## Prerequisites

1. **Python 3.8+** installed on your system
2. **Git** (if you need to clone the repository)
3. **Administrator privileges** (recommended for installing packages)

## Quick Build (Recommended)

### Option 1: Using the Batch File
1. Open Command Prompt as Administrator
2. Navigate to the `windows` folder:
   ```cmd
   cd path\to\your\project\windows
   ```
3. Run the build script:
   ```cmd
   build.bat
   ```

### Option 2: Using Python Script
1. Open Command Prompt
2. Navigate to the `windows` folder
3. Run the build script:
   ```cmd
   python build_exe.py
   ```

## Manual Build Process

If you prefer to build manually:

### Step 1: Install Dependencies
```cmd
pip install -r build_requirements.txt
```

### Step 2: Build with PyInstaller
```cmd
pyinstaller --clean LicensePlateMonitor.spec
```

## Build Output

After a successful build, you'll find:

- **`dist/LicensePlateMonitor.exe`** - The main executable
- **`dist/` folder** - Contains all necessary files
- **`BUILD_INFO.txt`** - Build information and usage notes

## File Structure After Build

```
dist/
├── LicensePlateMonitor.exe    # Main executable
├── config.json               # Configuration file
├── license_plates.json       # License plate data
├── model/                    # AI models
├── function/                 # Helper functions
├── result/                   # Output directory
├── test_image/              # Test images
└── BUILD_INFO.txt           # Build information
```

## Running the Application

1. Navigate to the `dist` folder
2. Double-click `LicensePlateMonitor.exe`
3. Configure your settings through the GUI
4. The application will create necessary directories automatically

## Troubleshooting

### Common Issues

**1. "Python not found" error**
- Make sure Python is installed and added to PATH
- Try using `python3` instead of `python`

**2. "Module not found" errors**
- Install all requirements: `pip install -r build_requirements.txt`
- Make sure you're in the correct directory

**3. Large executable size**
- This is normal due to PyQt5 and AI model dependencies
- The executable includes all necessary libraries

**4. Antivirus warnings**
- Some antivirus software may flag PyInstaller executables
- Add the `dist` folder to your antivirus exclusions

### Build Optimization

**To reduce executable size:**
1. Use `--exclude-module` for unused modules
2. Use `--onefile` flag (but may be slower to start)
3. Remove unnecessary files from the `datas` section

**Example optimized build:**
```cmd
pyinstaller --onefile --exclude-module matplotlib --exclude-module seaborn LicensePlateMonitor.spec
```

## Advanced Configuration

### Custom Icon
1. Place your `.ico` file in the `windows` folder as `icon.ico`
2. The build script will automatically include it

### Custom Spec File
Edit `LicensePlateMonitor.spec` to:
- Add/remove data files
- Exclude specific modules
- Modify build options

## System Requirements

**Minimum Requirements:**
- Windows 7/10/11 (64-bit recommended)
- 4GB RAM
- 2GB free disk space
- Webcam or camera device

**Recommended:**
- Windows 10/11 (64-bit)
- 8GB+ RAM
- 4GB+ free disk space
- Dedicated GPU (for better AI performance)

## Support

If you encounter issues:
1. Check the console output for error messages
2. Ensure all dependencies are properly installed
3. Try building with `--debug` flag for more information
4. Check the BUILD_INFO.txt file for additional details

## Notes

- First run may take longer to initialize AI models
- Internet connection required for API calls
- Camera access will be requested by the application
- The executable is self-contained and doesn't require Python installation on target machines
