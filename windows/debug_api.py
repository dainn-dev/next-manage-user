#!/usr/bin/env python3
"""
Debug script to test different approaches to the API call
"""

import requests
import cv2
import numpy as np
import io
import base64
from config_manager import ConfigManager

def test_different_approaches():
    """Test different approaches to fix the multipart issue"""
    
    config_manager = ConfigManager()
    
    # Create a test image
    test_image = np.zeros((480, 640, 3), dtype=np.uint8)
    cv2.putText(test_image, "TEST LICENSE PLATE", (50, 240), cv2.FONT_HERSHEY_SIMPLEX, 2, (255, 255, 255), 3)
    
    # Get API configuration
    api_url = config_manager.get_api_url()
    cookies = config_manager.get_api_cookies()
    
    print("=" * 60)
    print("DEBUGGING MULTIPART ISSUE")
    print("=" * 60)
    print(f"API URL: {api_url}")
    
    # Prepare headers
    headers = {
        "Accept": "*/*",
        "Accept-Language": "en-US,en;q=0.9",
        "Connection": "keep-alive",
        "Origin": "http://localhost:8080",
        "Referer": "http://localhost:8080/api/swagger-ui/index.html",
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-origin",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0",
        "sec-ch-ua": '"Chromium";v="140", "Not=A?Brand";v="24", "Microsoft Edge";v="140"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"Windows"'
    }
    
    params = {
        "licensePlateNumber": "TEST-12345",
        "type": "entry"
    }
    
    # Test 1: Try with minimal headers
    print("\n1. Testing with minimal headers...")
    try:
        minimal_headers = {
            "Accept": "*/*",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        }
        
        image_bytes = cv2.imencode('.jpg', test_image)[1].tobytes()
        image_file = io.BytesIO(image_bytes)
        
        files = {
            'image': ('test.jpg', image_file, 'image/jpeg')
        }
        
        response = requests.post(api_url, params=params, files=files, headers=minimal_headers, cookies=cookies, timeout=10)
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text[:200]}...")
        
    except Exception as e:
        print(f"Error: {e}")
    
    # Test 2: Try with different image encoding
    print("\n2. Testing with different image encoding...")
    try:
        # Try PNG instead of JPEG
        image_bytes = cv2.imencode('.png', test_image)[1].tobytes()
        image_file = io.BytesIO(image_bytes)
        
        files = {
            'image': ('test.png', image_file, 'image/png')
        }
        
        response = requests.post(api_url, params=params, files=files, headers=headers, cookies=cookies, timeout=10)
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text[:200]}...")
        
    except Exception as e:
        print(f"Error: {e}")
    
    # Test 3: Try with base64 encoding (old format)
    print("\n3. Testing with base64 encoding (old format)...")
    try:
        image_bytes = cv2.imencode('.jpg', test_image)[1].tobytes()
        image_base64 = base64.b64encode(image_bytes).decode('utf-8')
        
        payload = {
            "type": "entry",
            "licensePlateNumber": "TEST-12345",
            "image": image_base64
        }
        
        headers_json = headers.copy()
        headers_json["Content-Type"] = "application/json"
        
        response = requests.post(api_url, json=payload, headers=headers_json, cookies=cookies, timeout=10)
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text[:200]}...")
        
    except Exception as e:
        print(f"Error: {e}")
    
    # Test 4: Try with different boundary
    print("\n4. Testing with different boundary format...")
    try:
        image_bytes = cv2.imencode('.jpg', test_image)[1].tobytes()
        
        # Use a simpler boundary
        boundary = "----formdata-python-requests"
        body_parts = []
        body_parts.append(f'--{boundary}')
        body_parts.append(f'Content-Disposition: form-data; name="image"; filename="test.jpg"')
        body_parts.append('Content-Type: image/jpeg')
        body_parts.append('')
        
        body_text = '\r\n'.join(body_parts)
        body_bytes = body_text.encode('utf-8') + b'\r\n' + image_bytes + f'\r\n--{boundary}--\r\n'.encode('utf-8')
        
        headers_boundary = headers.copy()
        headers_boundary['Content-Type'] = f'multipart/form-data; boundary={boundary}'
        
        response = requests.post(api_url, params=params, data=body_bytes, headers=headers_boundary, cookies=cookies, timeout=10)
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text[:200]}...")
        
    except Exception as e:
        print(f"Error: {e}")
    
    # Test 5: Try without cookies
    print("\n5. Testing without cookies...")
    try:
        image_bytes = cv2.imencode('.jpg', test_image)[1].tobytes()
        image_file = io.BytesIO(image_bytes)
        
        files = {
            'image': ('test.jpg', image_file, 'image/jpeg')
        }
        
        response = requests.post(api_url, params=params, files=files, headers=headers, timeout=10)
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text[:200]}...")
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_different_approaches()
