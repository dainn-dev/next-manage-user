#!/usr/bin/env python3
"""
License Plate Monitor Launcher
Simple script to launch the License Plate Monitor GUI application
"""

import sys
import os

# Add the current directory to Python path to ensure imports work
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

try:
    from license_plate_monitor import main
    if __name__ == "__main__":
        main()
except ImportError as e:
    print(f"Error importing required modules: {e}")
    print("Please make sure all dependencies are installed:")
    print("pip install -r requirement.txt")
    sys.exit(1)
except Exception as e:
    print(f"Error starting application: {e}")
    sys.exit(1)
