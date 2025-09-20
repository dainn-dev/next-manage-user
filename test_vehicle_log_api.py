#!/usr/bin/env python3
"""
Test script to manually test the vehicle logs API
"""

import requests
import json
from datetime import datetime

def test_vehicle_log_api():
    """Test the vehicle logs API endpoint"""
    
    # Test data matching what the application sends
    test_data = {
        "licensePlateNumber": "TEST-12345",
        "entryExitTime": datetime.now().isoformat(),
        "type": "entry",
        "vehicleType": "external",
        "driverName": "Khách bên ngoài",
        "purpose": "Được phép truy cập bởi bảo vệ",
        "gateLocation": "Main Gate",
        "notes": "External vehicle allowed by security - Panel: Vào"
    }
    
    # API endpoint - using the same logic as the application
    base_url = "http://localhost:8080"  # This should match config.json
    api_url = f"{base_url}/api/vehicle-logs"
    headers = {'Content-Type': 'application/json'}
    
    print("=" * 50)
    print("TESTING VEHICLE LOGS API")
    print("=" * 50)
    print(f"API URL: {api_url}")
    print(f"Request data: {json.dumps(test_data, indent=2)}")
    print("-" * 50)
    
    try:
        # Test if backend is running
        print("1. Testing backend connectivity...")
        health_response = requests.get("http://localhost:8080/actuator/health", timeout=5)
        print(f"   Backend health check: {health_response.status_code}")
        
        if health_response.status_code == 200:
            print("   ✅ Backend is running")
        else:
            print("   ❌ Backend health check failed")
            return
            
        print("\n2. Testing vehicle logs API...")
        response = requests.post(api_url, json=test_data, headers=headers, timeout=10)
        
        print(f"   Status Code: {response.status_code}")
        print(f"   Response Headers: {dict(response.headers)}")
        print(f"   Response Content: {response.text}")
        
        if response.status_code in [200, 201]:
            print("   ✅ Vehicle log created successfully!")
            response_data = response.json()
            print(f"   Created log ID: {response_data.get('id', 'N/A')}")
        else:
            print("   ❌ Failed to create vehicle log")
            print(f"   Error: {response.text}")
            
    except requests.exceptions.ConnectionError:
        print("   ❌ Cannot connect to backend at http://localhost:8080")
        print("   Make sure the backend server is running")
    except requests.exceptions.Timeout:
        print("   ❌ Request timed out")
    except Exception as e:
        print(f"   ❌ Unexpected error: {e}")
    
    print("=" * 50)

if __name__ == "__main__":
    test_vehicle_log_api()
