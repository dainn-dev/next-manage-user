import sys
import os
import cv2
import torch
import time
import requests
import base64
import json
from datetime import datetime

# Add yolov5 to Python path for local model loading
yolov5_path = os.path.join(os.path.dirname(__file__), 'model', 'yolov5')
if os.path.exists(yolov5_path) and yolov5_path not in sys.path:
    sys.path.insert(0, yolov5_path)
    print(f"Added YOLOv5 path: {yolov5_path}")
else:
    print(f"YOLOv5 path not found or already in sys.path: {yolov5_path}")
from PyQt5.QtWidgets import (QApplication, QMainWindow, QWidget, QVBoxLayout, 
                             QHBoxLayout, QLabel, QComboBox, QPushButton, 
                             QFrame, QTextEdit, QGridLayout, QGroupBox, 
                             QMessageBox, QDialog, QVBoxLayout as QVBoxLayoutDialog)
from PyQt5.QtCore import QTimer, QThread, pyqtSignal, Qt
from PyQt5.QtGui import QImage, QPixmap, QFont
import function.helper as helper
import function.utils_rotate as utils_rotate
from function.json_handler import LicensePlateManager
from config_manager import config_manager
from config_dialog import ConfigDialog
from tts_manager import tts_manager

# Global cache for API requests
api_cache = {}

# Global tracking for license plate detections to prevent duplicates across panels
global_detection_times = {}

# Rate limiting tracking
api_request_times = []  # Track API request timestamps for rate limiting


def is_request_cached(license_plate, panel_type):
    """Check if a request for this license plate and panel type is cached"""
    cache_key = f"{license_plate}_{panel_type}"
    current_time = time.time()
    
    if cache_key in api_cache:
        cache_time = api_cache[cache_key]["timestamp"]
        response_data = api_cache[cache_key]["response"]
        
        # Use different cache duration for connection errors
        if response_data.get("connection_error", False):
            cache_duration = config_manager.get_connection_error_cache_duration()
        else:
            cache_duration = config_manager.get_cache_duration()
        
        if current_time - cache_time < cache_duration:
            return True, response_data
    
    return False, None


def cache_api_response(license_plate, panel_type, response_data):
    """Cache the API response for future use"""
    cache_key = f"{license_plate}_{panel_type}"
    api_cache[cache_key] = {
        "timestamp": time.time(),
        "response": response_data
    }
    print(f"Added to cache: {cache_key} - Total cache entries: {len(api_cache)}")


def clean_expired_cache():
    """Remove expired entries from cache"""
    current_time = time.time()
    normal_cache_duration = config_manager.get_cache_duration()
    error_cache_duration = config_manager.get_connection_error_cache_duration()
    expired_keys = []
    
    for key, data in api_cache.items():
        cache_time = data["timestamp"]
        response_data = data["response"]
        
        # Use different cache duration for connection errors
        if response_data.get("connection_error", False):
            cache_duration = error_cache_duration
        else:
            cache_duration = normal_cache_duration
        
        if current_time - cache_time >= cache_duration:
            expired_keys.append(key)
    
    for key in expired_keys:
        del api_cache[key]


def check_rate_limit():
    """Check if we're within rate limits"""
    global api_request_times
    
    # Check if rate limiting is enabled
    if not config_manager.get_rate_limit_enabled():
        return True, None
    
    current_time = time.time()
    max_requests_per_minute = config_manager.get_rate_limit_max_requests()
    
    # Remove requests older than 1 minute
    api_request_times = [req_time for req_time in api_request_times if current_time - req_time < 60]
    
    # Check if we're under the limit
    if len(api_request_times) >= max_requests_per_minute:
        return False, f"Rate limit exceeded: {len(api_request_times)}/{max_requests_per_minute} requests in last minute"
    
    return True, None


def record_api_request():
    """Record an API request timestamp for rate limiting"""
    global api_request_times
    api_request_times.append(time.time())


def get_rate_limit_status():
    """Get current rate limit status"""
    global api_request_times
    
    current_time = time.time()
    max_requests_per_minute = config_manager.get_rate_limit_max_requests()
    
    # Remove old requests
    api_request_times = [req_time for req_time in api_request_times if current_time - req_time < 60]
    
    return {
        "current_requests": len(api_request_times),
        "max_requests": max_requests_per_minute,
        "remaining": max_requests_per_minute - len(api_request_times),
        "reset_time": 60 - (current_time - api_request_times[0]) if api_request_times else 0,
        "enabled": config_manager.get_rate_limit_enabled()
    }


def encode_image_to_base64(image):
    """Convert OpenCV image to base64 string"""
    try:
        _, buffer = cv2.imencode('.jpg', image)
        image_base64 = base64.b64encode(buffer).decode('utf-8')
        return image_base64
    except Exception as e:
        print(f"Error encoding image: {e}")
        return None


def send_license_plate_to_api(license_plate, image, panel_type, api_url=None):
    """Send license plate data to API with caching and rate limiting"""
    try:
        # Clean expired cache entries first
        clean_expired_cache()
        
        # Check if request is cached
        is_cached, cached_response = is_request_cached(license_plate, panel_type)
        if is_cached:
            # Return cached response with cache indicator
            cached_response["cached"] = True
            cached_response["message"] = f"[CACHED] {cached_response.get('message', 'Success')}"
            print(f"Cache hit for {license_plate} - returning cached response")
            return cached_response
        
        # Check rate limit before making API request
        rate_limit_ok, rate_limit_error = check_rate_limit()
        if not rate_limit_ok:
            print(f"Rate limit exceeded for {license_plate}: {rate_limit_error}")
            # Return a rate limit error response
            return {
                "success": False, 
                "message": f"Rate limit exceeded. Please wait before trying again. ({rate_limit_error})",
                "rate_limited": True
            }
        
        if api_url is None:
            api_url = config_manager.get_api_url()
        
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
        
        # Prepare cookies if enabled
        cookies = {}
        if config_manager.get_api_use_cookies():
            cookies = config_manager.get_api_cookies()
        
        # Prepare request parameters
        print(f"DEBUG: use_query_params = {config_manager.get_api_use_query_params()}")
        if config_manager.get_api_use_query_params():
            # Use query parameters (new format)
            params = {
                "licensePlateNumber": license_plate,
                "type": panel_type
            }
            
            # Prepare multipart form data using requests-toolbelt for better compatibility
            from requests_toolbelt.multipart.encoder import MultipartEncoder
            
            # Resize image to very small size due to server limitations
            height, width = image.shape[:2]
            # Server can only handle very small images (tested: 10x10 works, larger fails)
            max_size = 120  # Use 50x50 as safe limit
            if width > max_size or height > max_size:
                # Resize to very small dimensions
                new_width = min(max_size, width)
                new_height = min(max_size, height)
                image = cv2.resize(image, (new_width, new_height))
            
            # Encode with very low quality to minimize file size
            encode_param = [int(cv2.IMWRITE_JPEG_QUALITY), 5]  # Very low quality
            image_bytes = cv2.imencode('.jpg', image, encode_param)[1].tobytes()
            
            # Use requests-toolbelt for proper multipart handling
            multipart_data = MultipartEncoder(
                fields={
                    'image': (f'{license_plate}.jpg', image_bytes, 'image/jpeg')
                }
            )
            
            # Set Content-Type header with boundary
            headers['Content-Type'] = multipart_data.content_type
            
            timeout = config_manager.get_api_timeout()
            
            # Debug: Print request details
            print(f"DEBUG: Sending request to: {api_url}")
            print(f"DEBUG: Using requests-toolbelt MultipartEncoder")
            print(f"DEBUG: Image size: {len(image_bytes)} bytes")
            print(f"DEBUG: Content-Type: {headers['Content-Type']}")
            
            # Disable proxies for localhost requests
            proxies = {'http': None, 'https': None} if 'localhost' in api_url or '127.0.0.1' in api_url else None
            response = requests.post(api_url, params=params, data=multipart_data, headers=headers, cookies=cookies, timeout=timeout, proxies=proxies)
            
            # Debug: Print response details
            print(f"DEBUG: Response status: {response.status_code}")
            print(f"DEBUG: Response text: {response.text[:200]}...")
        else:
            # Use JSON payload (old format)
            image_base64 = encode_image_to_base64(image)
            if image_base64 is None:
                return {"success": False, "message": "Failed to encode image"}
            
            payload = {
                "type": panel_type,
                "licensePlateNumber": license_plate,
                "image": image_base64
            }
            
            headers["Content-Type"] = "application/json"
            timeout = config_manager.get_api_timeout()
            # Disable proxies for localhost requests
            proxies = {'http': None, 'https': None} if 'localhost' in api_url or '127.0.0.1' in api_url else None
            response = requests.post(api_url, json=payload, headers=headers, cookies=cookies, timeout=timeout, proxies=proxies)
        
        if response.status_code == 200:
            try:
                response_json = response.json()
                # Handle new API response format
                if "message" in response_json:
                    message = response_json.get("message", "Success")
                    approved = response_json.get("approved", False)
                    response_data = {
                        "success": True, 
                        "message": message,
                        "approved": approved,
                        "licensePlateNumber": response_json.get("licensePlateNumber", license_plate),
                        "type": response_json.get("type", panel_type)
                    }
                else:
                    # Fallback for old format
                    response_data = {"success": True, "message": response_json.get("message", "Thành công")}
            except:
                response_data = {"success": True, "message": "Thành công"}
        else:
            response_data = {"success": False, "message": f"Lỗi API: {response.status_code} - {response.text}"}
        
        # Record API request for rate limiting (both success and failure)
        record_api_request()
        
        # Cache the response (both success and failure)
        cache_api_response(license_plate, panel_type, response_data)
        print(f"Cached response for {license_plate} - cache size: {len(api_cache)}")
        
        return response_data
            
    except requests.exceptions.RequestException as e:
        error_response = {"success": False, "message": f"Lỗi mạng: {str(e)}", "connection_error": True}
        # Cache error responses to prevent repeated attempts
        record_api_request()
        cache_api_response(license_plate, panel_type, error_response)
        print(f"Cached error response for {license_plate} - cache size: {len(api_cache)}")
        return error_response
    except Exception as e:
        error_response = {"success": False, "message": f"Lỗi: {str(e)}", "connection_error": True}
        # Cache error responses to prevent repeated attempts
        record_api_request()
        cache_api_response(license_plate, panel_type, error_response)
        print(f"Cached error response for {license_plate} - cache size: {len(api_cache)}")
        return error_response


def get_available_cameras():
    """Detect and return list of available camera devices including RTSP devices"""
    available_cameras = []
    
    # Test local cameras from 0 to max_cameras
    max_cameras = config_manager.get_max_cameras()
    for i in range(max_cameras):
        cap = cv2.VideoCapture(i)
        if cap.isOpened():
            # Try to read a frame to ensure the camera is actually working
            ret, frame = cap.read()
            if ret and frame is not None:
                # Get camera properties for better identification
                width = cap.get(cv2.CAP_PROP_FRAME_WIDTH)
                height = cap.get(cv2.CAP_PROP_FRAME_HEIGHT)
                fps = cap.get(cv2.CAP_PROP_FPS)
                
                # Try to get camera name (works on some systems)
                try:
                    backend = cap.getBackendName()
                    camera_info = f"Camera {i} ({int(width)}x{int(height)} @ {int(fps)}fps)"
                except:
                    camera_info = f"Camera {i} ({int(width)}x{int(height)})"
                
                available_cameras.append((i, camera_info))
            cap.release()
    
    # Add RTSP devices if enabled
    rtsp_devices = config_manager.get_rtsp_devices()
    for device_id, device_config in rtsp_devices.items():
        if device_config.get('enabled', False):
            device_name = device_config.get('name', f'RTSP {device_id}')
            rtsp_url = config_manager.build_rtsp_url(device_id)
            
            if rtsp_url:
                # Test RTSP connection
                cap = cv2.VideoCapture(rtsp_url)
                if cap.isOpened():
                    # Try to read a frame to test the connection
                    ret, frame = cap.read()
                    if ret and frame is not None:
                        # Get stream properties
                        width = cap.get(cv2.CAP_PROP_FRAME_WIDTH)
                        height = cap.get(cv2.CAP_PROP_FRAME_HEIGHT)
                        fps = cap.get(cv2.CAP_PROP_FPS)
                        
                        camera_info = f"{device_name} ({int(width)}x{int(height)} @ {int(fps)}fps)"
                        # Use device_id as the camera identifier for RTSP devices
                        available_cameras.append((device_id, camera_info))
                    cap.release()
    
    return available_cameras


class APIResponseDialog(QDialog):
    """Dialog to display API response messages"""
    scan_again_requested = pyqtSignal()  # Signal to request another scan
    
    def __init__(self, license_plate, panel_type, response_data, parent=None):
        super().__init__(parent)
        self.setWindowTitle(f"Phát hiện biển số xe - {panel_type.upper()}")
        self.setModal(True)  # Make it modal to prevent multiple instances
        self.setFixedSize(400, 300)
        
        # Set window flags for proper dialog behavior
        self.setWindowFlags(Qt.Dialog | Qt.WindowTitleHint | Qt.WindowCloseButtonHint)
        
        layout = QVBoxLayoutDialog()
        
        # Header
        header_label = QLabel(f"Phát hiện biển số: {license_plate}")
        header_label.setFont(QFont("Arial", 12, QFont.Bold))
        header_label.setAlignment(Qt.AlignCenter)
        layout.addWidget(header_label)
        
        # Panel type
        type_label = QLabel(f"Panel: {panel_type.upper()}")
        type_label.setFont(QFont("Arial", 10))
        type_label.setAlignment(Qt.AlignCenter)
        layout.addWidget(type_label)
        
        # Timestamp
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        time_label = QLabel(f"Thời gian: {timestamp}")
        time_label.setFont(QFont("Arial", 9))
        time_label.setAlignment(Qt.AlignCenter)
        layout.addWidget(time_label)
        
        # Response message
        response_label = QLabel("Phản hồi API:")
        response_label.setFont(QFont("Arial", 10, QFont.Bold))
        layout.addWidget(response_label)
        
        self.response_text = QTextEdit()
        self.response_text.setReadOnly(True)
        self.response_text.setMaximumHeight(100)
        
        # Set response text with color coding
        if response_data.get("success", False):
            if response_data.get("cached", False):
                self.response_text.setStyleSheet("background-color: #fff3cd; color: #856404; border: 1px solid #ffeaa7;")
                self.response_text.append("✓ SUCCESS (CACHED)")
            else:
                self.response_text.setStyleSheet("background-color: #d4edda; color: #155724; border: 1px solid #c3e6cb;")
                self.response_text.append("✓ SUCCESS")
        else:
            if response_data.get("connection_error", False):
                self.response_text.setStyleSheet("background-color: #f8d7da; color: #721c24; border: 1px solid #f5c6cb;")
                self.response_text.append("✗ CONNECTION ERROR")
            elif response_data.get("rate_limited", False):
                self.response_text.setStyleSheet("background-color: #fff3cd; color: #856404; border: 1px solid #ffeaa7;")
                self.response_text.append("⚠ RATE LIMITED")
            else:
                self.response_text.setStyleSheet("background-color: #f8d7da; color: #721c24; border: 1px solid #f5c6cb;")
                self.response_text.append("✗ ERROR")
        
        self.response_text.append(response_data.get("message", "No message"))
        layout.addWidget(self.response_text)
        
        # Buttons layout
        button_layout = QHBoxLayout()
        
        # Quét lại (Scan Again) button
        self.scan_again_btn = QPushButton("Quét lại")
        self.scan_again_btn.clicked.connect(self.on_scan_again_clicked)
        self.scan_again_btn.setStyleSheet("""
            QPushButton {
                background-color: #ffc107;
                color: #212529;
                border: none;
                padding: 8px 16px;
                border-radius: 4px;
                font-weight: bold;
            }
            QPushButton:hover {
                background-color: #e0a800;
            }
        """)
        button_layout.addWidget(self.scan_again_btn)
        
        # OK button
        ok_button = QPushButton("OK")
        ok_button.clicked.connect(self.on_ok_clicked)
        ok_button.setStyleSheet("""
            QPushButton {
                background-color: #007bff;
                color: white;
                border: none;
                padding: 8px 16px;
                border-radius: 4px;
                font-weight: bold;
            }
            QPushButton:hover {
                background-color: #0056b3;
            }
        """)
        button_layout.addWidget(ok_button)
        
        layout.addLayout(button_layout)
        self.setLayout(layout)
        
        # Store response data for speaking
        self.response_data = response_data
        self.license_plate = license_plate
        self.panel_type = panel_type
    
    def on_scan_again_clicked(self):
        """Handle Quét lại (Scan Again) button click"""
        try:
            # Stop any ongoing TTS
            tts_manager.stop_speaking()
            
            # Emit signal to request another scan
            self.scan_again_requested.emit()
            
            # Close this dialog
            self.accept()
            
        except Exception as e:
            print(f"Error in scan again: {e}")
            self.accept()
    
    def on_ok_clicked(self):
        """Handle OK button click - stop TTS and close dialog"""
        try:
            # Stop TTS immediately and synchronously
            print("OK button clicked - stopping TTS immediately")
            tts_manager.stop_speaking()
            
            # Close the dialog immediately
            self.accept()
            
        except Exception as e:
            print(f"Error in OK button click: {e}")
            # Force close the dialog even if there's an error
            try:
                self.accept()
            except:
                self.close()
    
    def stop_tts_async(self):
        """Stop TTS asynchronously to prevent UI blocking"""
        try:
            # Use a timer to stop TTS without blocking the UI
            from PyQt5.QtCore import QTimer
            timer = QTimer()
            timer.setSingleShot(True)
            timer.timeout.connect(self._stop_tts_safely)
            timer.start(10)  # Stop TTS after 10ms
        except Exception as e:
            print(f"Error setting up async TTS stop: {e}")
    
    def _stop_tts_safely(self):
        """Safely stop TTS without blocking"""
        try:
            tts_manager.stop_speaking()
        except Exception as e:
            print(f"Error stopping TTS safely: {e}")
    
    def closeEvent(self, event):
        """Handle dialog close event - stop TTS when dialog is closed"""
        try:
            # Stop TTS asynchronously to prevent blocking
            self.stop_tts_async()
        except Exception as e:
            print(f"Error stopping TTS on close: {e}")
        finally:
            # Always accept the close event
            try:
                event.accept()
            except:
                pass


class WebcamThread(QThread):
    """Thread for handling webcam capture and license plate detection"""
    frame_ready = pyqtSignal(object, str)  # frame, license_plate_text
    error_occurred = pyqtSignal(str)
    api_response_ready = pyqtSignal(str, str, dict)  # license_plate, panel_type, response_data
    
    def __init__(self, camera_index, panel_name):
        super().__init__()
        self.camera_index = camera_index
        self.panel_name = panel_name
        self.panel_type = panel_name  # Add panel_type for compatibility
        self.running = False
        self.cap = None
        self.is_rtsp_device = False
        self.rtsp_url = None
        self.last_detection_time = {}  # Track last detection time for each plate
        self.plate_detection_start = {}  # Track when each plate was first detected
        self.min_detection_duration = config_manager.get_min_detection_duration()  # Minimum detection duration from config
        
        # RTSP optimization variables
        self.frame_skip_count = 0
        self.last_frame_time = 0
        self.frames_dropped = 0
        
        # Initialize model attributes
        self.yolo_LP_detect = None
        self.yolo_license_plate = None
        self.lp_manager = None
        self.last_saved_plates = set()
        
        # Load models
        self.load_models()
    
    def load_models(self):
        """Load YOLOv5 models with error handling"""
        try:
            detector_path, ocr_path = config_manager.get_model_paths()
            confidence_threshold = config_manager.get_confidence_threshold()
            
            print(f"Loading models: {detector_path}, {ocr_path}")
            
            # Fix PyTorch 2.6 security issue with weights_only
            try:
                import torch.serialization
                # Add safe globals for YOLOv5 models
                torch.serialization.add_safe_globals(['models.yolo.Model'])
                print("Added safe globals for YOLOv5 models")
            except Exception as e:
                print(f"Warning: Could not add safe globals: {e}")
            
            # Try to load with ultralytics/yolov5 (most reliable)
            try:
                print("Loading models with ultralytics/yolov5...")
                self.yolo_LP_detect = torch.hub.load('ultralytics/yolov5', 'custom', 
                                                   path=detector_path, force_reload=True, trust_repo=True)
                self.yolo_license_plate = torch.hub.load('ultralytics/yolov5', 'custom', 
                                                       path=ocr_path, force_reload=True, trust_repo=True)
                print("Models loaded successfully with ultralytics/yolov5")
            except Exception as ultralytics_error:
                print(f"ultralytics/yolov5 failed: {ultralytics_error}")
                print("Trying local YOLOv5...")
                
                # Try local YOLOv5 as fallback
                try:
                    yolov5_path = os.path.join(os.path.dirname(__file__), 'model', 'yolov5')
                    self.yolo_LP_detect = torch.hub.load(yolov5_path, 'custom', 
                                                       path=detector_path, force_reload=True, source='local')
                    self.yolo_license_plate = torch.hub.load(yolov5_path, 'custom', 
                                                           path=ocr_path, force_reload=True, source='local')
                    print("Models loaded successfully with local YOLOv5")
                except Exception as local_error:
                    print(f"Local YOLOv5 also failed: {local_error}")
                    raise Exception(f"Both ultralytics/yolov5 and local YOLOv5 failed. ultralytics error: {ultralytics_error}, local error: {local_error}")
            
            # Set confidence threshold
            if self.yolo_license_plate:
                self.yolo_license_plate.conf = confidence_threshold
            
            # Initialize license plate manager
            self.lp_manager = LicensePlateManager()
            
            print("All models loaded successfully")
            
        except Exception as e:
            error_msg = f"Error loading models: {str(e)}"
            print(error_msg)
            self.error_occurred.emit(error_msg)
            # Set models to None so we can check later
            self.yolo_LP_detect = None
            self.yolo_license_plate = None
            self.lp_manager = None
    
    def reload_models(self):
        """Reload models (useful for configuration changes)"""
        try:
            print("Reloading models...")
            self.load_models()
            if self.yolo_LP_detect and self.yolo_license_plate:
                print("Models reloaded successfully")
                return True
            else:
                print("Failed to reload models")
                return False
        except Exception as e:
            print(f"Error reloading models: {e}")
            return False
    
    def test_models(self):
        """Test if models are working properly"""
        try:
            if not self.yolo_LP_detect or not self.yolo_license_plate:
                return False, "Models not loaded"
            
            # Create a test image (black image)
            import numpy as np
            test_image = np.zeros((480, 640, 3), dtype=np.uint8)
            
            # Test detection model
            result = self.yolo_LP_detect(test_image, size=640)
            if result is None:
                return False, "Detection model test failed"
            
            # Test OCR model
            result = self.yolo_license_plate(test_image, size=640)
            if result is None:
                return False, "OCR model test failed"
            
            return True, "Models working correctly"
            
        except Exception as e:
            return False, f"Model test failed: {str(e)}"
    
    def _apply_rtsp_optimization(self):
        """Apply RTSP optimization settings to reduce latency"""
        if not self.is_rtsp_device or not self.cap:
            return
        
        try:
            # Set buffer size to minimum for low latency
            buffer_size = config_manager.get_rtsp_buffer_size()
            self.cap.set(cv2.CAP_PROP_BUFFERSIZE, buffer_size)
            
            # Set connection timeout
            connection_timeout = config_manager.get_rtsp_connection_timeout()
            self.cap.set(cv2.CAP_PROP_OPEN_TIMEOUT_MSEC, connection_timeout)
            
            # Set read timeout
            read_timeout = config_manager.get_rtsp_read_timeout()
            self.cap.set(cv2.CAP_PROP_READ_TIMEOUT_MSEC, read_timeout)
            
            # Additional optimizations for low latency
            if config_manager.get_rtsp_low_latency():
                # Disable auto exposure and other automatic settings that can cause delay
                self.cap.set(cv2.CAP_PROP_AUTO_EXPOSURE, 0.25)  # Manual exposure
                self.cap.set(cv2.CAP_PROP_FPS, 30)  # Set consistent FPS
                
            print(f"RTSP optimization applied: buffer_size={buffer_size}, "
                  f"connection_timeout={connection_timeout}ms, read_timeout={read_timeout}ms")
                  
        except Exception as e:
            print(f"Warning: Could not apply all RTSP optimizations: {e}")
    
    def _should_skip_frame(self):
        """Determine if current frame should be skipped for low latency"""
        if not self.is_rtsp_device or not config_manager.get_rtsp_drop_frames():
            return False
        
        current_time = time.time()
        frame_skip_threshold = config_manager.get_rtsp_frame_skip_threshold()
        
        # Skip frame if we're processing too fast (buffer building up)
        if self.frame_skip_count < frame_skip_threshold:
            self.frame_skip_count += 1
            return True
        
        # Reset skip counter after processing a frame
        self.frame_skip_count = 0
        return False
    
    def run(self):
        """Main thread loop for webcam capture and processing"""
        try:
            # Check if models are loaded
            if not self.yolo_LP_detect or not self.yolo_license_plate:
                self.error_occurred.emit("Models not loaded. Cannot start camera processing.")
                return
            
            # Determine if this is an RTSP device or local camera
            rtsp_devices = config_manager.get_rtsp_devices()
            if str(self.camera_index) in rtsp_devices:
                # This is an RTSP device
                self.is_rtsp_device = True
                self.rtsp_url = config_manager.build_rtsp_url(str(self.camera_index))
                if not self.rtsp_url:
                    self.error_occurred.emit(f"Invalid RTSP configuration for device {self.camera_index}")
                    return
                
                # Create VideoCapture with RTSP optimization
                self.cap = cv2.VideoCapture(self.rtsp_url)
                
                # Apply RTSP optimization settings
                self._apply_rtsp_optimization()
            else:
                # This is a local camera
                self.is_rtsp_device = False
                self.cap = cv2.VideoCapture(self.camera_index)
            
            if not self.cap.isOpened():
                if self.is_rtsp_device:
                    self.error_occurred.emit(f"Could not connect to RTSP device {self.camera_index} at {self.rtsp_url}")
                else:
                    self.error_occurred.emit(f"Could not open camera {self.camera_index}")
                return
            
            self.running = True
            prev_frame_time = 0
            
            while self.running:
                ret, frame = self.cap.read()
                if not ret:
                    if self.is_rtsp_device:
                        self.error_occurred.emit(f"Failed to read from RTSP device {self.camera_index}")
                    else:
                        self.error_occurred.emit(f"Failed to read from camera {self.camera_index}")
                    break
                
                # Check if we should skip this frame for low latency (RTSP only)
                if self._should_skip_frame():
                    self.frames_dropped += 1
                    continue
                
                # Process frame for license plate detection
                processed_frame, license_plate_text = self.process_frame(frame)
                
                # Emit the processed frame and any detected license plate
                self.frame_ready.emit(processed_frame, license_plate_text)
                
                # Calculate FPS
                new_frame_time = time.time()
                if prev_frame_time > 0:
                    fps = 1 / (new_frame_time - prev_frame_time)
                    cv2.putText(processed_frame, f"FPS: {int(fps)}", (10, 30), 
                              cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
                prev_frame_time = new_frame_time
                
                # Small delay to prevent overwhelming the system
                self.msleep(33)  # ~30 FPS
                
        except Exception as e:
            self.error_occurred.emit(f"Error in webcam thread: {str(e)}")
        finally:
            if self.cap:
                self.cap.release()
    
    def process_frame(self, frame):
        """Process frame for license plate detection"""
        try:
            # Check if models are loaded
            if not self.yolo_LP_detect or not self.yolo_license_plate:
                return frame, ""
            
            plates = self.yolo_LP_detect(frame, size=640)
            list_plates = plates.pandas().xyxy[0].values.tolist()
            current_frame_plates = set()
            license_plate_text = ""
            
            if len(list_plates) == 0:
                # Try to read plate from entire frame
                lp = helper.read_plate(self.yolo_license_plate, frame)
                if lp != "unknown":
                    current_frame_plates.add(lp)
                    license_plate_text = lp
                    cv2.putText(frame, lp, (10, 70), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (36, 255, 12), 2)
            else:
                for plate in list_plates:
                    flag = 0
                    x = int(plate[0])
                    y = int(plate[1])
                    w = int(plate[2] - plate[0])
                    h = int(plate[3] - plate[1])
                    crop_img = frame[y:y+h, x:x+w]
                    
                    # Draw rectangle around detected plate
                    cv2.rectangle(frame, (int(plate[0]), int(plate[1])), 
                                (int(plate[2]), int(plate[3])), color=(0, 0, 255), thickness=2)
                    
                    # Try to read license plate with rotation
                    lp = ""
                    for cc in range(0, 2):
                        for ct in range(0, 2):
                            lp = helper.read_plate(self.yolo_license_plate, 
                                                 utils_rotate.deskew(crop_img, cc, ct))
                            if lp != "unknown":
                                current_frame_plates.add(lp)
                                license_plate_text = lp
                                cv2.putText(frame, lp, (int(plate[0]), int(plate[1]-10)), 
                                          cv2.FONT_HERSHEY_SIMPLEX, 0.9, (36, 255, 12), 2)
                                flag = 1
                                break
                        if flag == 1:
                            break
            
            # Track license plate detection duration
            current_time = time.time()
            for lp in current_frame_plates:
                # Record when this plate was first detected
                if lp not in self.plate_detection_start:
                    self.plate_detection_start[lp] = current_time
                    print(f"Started tracking license plate: {lp}")
                
                # Check if plate has been detected for at least 3 seconds
                detection_duration = current_time - self.plate_detection_start[lp]
                
                if detection_duration >= self.min_detection_duration:
                    # Plate detected for sufficient time, process it
                    if lp not in self.last_saved_plates:
                        self.lp_manager.add_license_plate(lp)
                        self.last_saved_plates.add(lp)
                    
                    # Check cooldown for API calls (both local and global)
                    detection_cooldown = config_manager.get_detection_cooldown()
                    global_key = f"{lp}_{self.panel_type}"
                    
                    # Check both local and global cooldowns
                    local_cooldown_ok = lp not in self.last_detection_time or (current_time - self.last_detection_time[lp]) > detection_cooldown
                    global_cooldown_ok = global_key not in global_detection_times or (current_time - global_detection_times[global_key]) > detection_cooldown
                    
                    if local_cooldown_ok and global_cooldown_ok:
                        # Check if this request is already cached
                        is_cached, cached_response = is_request_cached(lp, self.panel_type)
                        if is_cached:
                            print(f"License plate {lp} - using cached response (cache hit)")
                            # Emit cached response directly
                            self.api_response_ready.emit(lp, self.panel_type, cached_response)
                        else:
                            # Check rate limit before making API request
                            rate_limit_ok, rate_limit_error = check_rate_limit()
                            if not rate_limit_ok:
                                print(f"Rate limit exceeded for {lp}: {rate_limit_error}")
                                # Create rate limit error response
                                rate_limit_response = {
                                    "success": False, 
                                    "message": f"Rate limit exceeded. Please wait before trying again. ({rate_limit_error})",
                                    "rate_limited": True
                                }
                                # Cache the rate limit response
                                cache_api_response(lp, self.panel_type, rate_limit_response)
                                self.api_response_ready.emit(lp, self.panel_type, rate_limit_response)
                            else:
                                self.last_detection_time[lp] = current_time
                                global_detection_times[global_key] = current_time
                                print(f"License plate {lp} detected for {detection_duration:.1f}s - sending to API")
                                # Send to API in a separate thread to avoid blocking
                                self.send_to_api_async(lp, frame)
                    else:
                        print(f"License plate {lp} skipped due to cooldown (local: {not local_cooldown_ok}, global: {not global_cooldown_ok})")
                else:
                    # Show countdown in console
                    remaining_time = self.min_detection_duration - detection_duration
                    print(f"License plate {lp} detected for {detection_duration:.1f}s (need {remaining_time:.1f}s more)")
            
            # Clean up plates that are no longer detected
            plates_to_remove = []
            for lp in self.plate_detection_start:
                if lp not in current_frame_plates:
                    plates_to_remove.append(lp)
            
            for lp in plates_to_remove:
                del self.plate_detection_start[lp]
                print(f"Stopped tracking license plate: {lp}")
            
            return frame, license_plate_text
            
        except Exception as e:
            self.error_occurred.emit(f"Lỗi xử lý khung hình: {str(e)}")
            return frame, ""
    
    def send_to_api_async(self, license_plate, frame):
        """Send license plate data to API asynchronously"""
        try:
            # Make API call
            response_data = send_license_plate_to_api(license_plate, frame, self.panel_type)
            
            # Emit signal with response data
            self.api_response_ready.emit(license_plate, self.panel_type, response_data)
            
        except Exception as e:
            error_response = {"success": False, "message": f"Lỗi API: {str(e)}"}
            self.api_response_ready.emit(license_plate, self.panel_type, error_response)
    
    def stop(self):
        """Stop the webcam thread"""
        self.running = False
        self.wait()


class CameraPanel(QGroupBox):
    """Individual camera panel widget"""
    def __init__(self, title, panel_type):
        super().__init__(title)
        self.panel_type = panel_type
        self.webcam_thread = None
        self.active_dialogs = {}  # Track active popup dialogs to prevent duplicates
        self.last_popup_time = {}  # Track last popup time for each license plate to prevent spam
        self.setup_ui()
    
    def setup_ui(self):
        """Setup the UI for the camera panel"""
        layout = QVBoxLayout()
        
        # Header with camera selection and connect button
        header_layout = QHBoxLayout()
        
        # Camera selection combobox
        self.camera_combo = QComboBox()
        header_layout.addWidget(QLabel("Camera:"))
        header_layout.addWidget(self.camera_combo)
        
        # Refresh cameras button
        self.refresh_btn = QPushButton("Làm mới")
        self.refresh_btn.setObjectName("refresh")
        self.refresh_btn.clicked.connect(self.refresh_cameras)
        self.refresh_btn.setMaximumWidth(80)
        header_layout.addWidget(self.refresh_btn)
        
        # Connect/Disconnect button
        self.connect_btn = QPushButton("Kết nối")
        self.connect_btn.clicked.connect(self.toggle_connection)
        header_layout.addWidget(self.connect_btn)
        
        header_layout.addStretch()
        layout.addLayout(header_layout)
        
        # Video display area
        self.video_label = QLabel()
        video_width, video_height = config_manager.get_video_size()
        self.video_label.setMinimumSize(video_width, video_height)
        self.video_label.setStyleSheet("border: 2px solid gray; background-color: black;")
        self.video_label.setAlignment(Qt.AlignCenter)
        self.video_label.setText("Chưa kết nối camera")
        layout.addWidget(self.video_label)
        
        # License plate detection log
        log_label = QLabel("Biển số đã phát hiện:")
        log_label.setFont(QFont("Arial", 10, QFont.Bold))
        layout.addWidget(log_label)
        
        self.log_text = QTextEdit()
        self.log_text.setMaximumHeight(100)
        self.log_text.setReadOnly(True)
        layout.addWidget(self.log_text)
        
        self.setLayout(layout)
        
        # Load available cameras after UI is set up
        # Use a timer to ensure UI is fully initialized before refreshing
        from PyQt5.QtCore import QTimer
        QTimer.singleShot(100, self.refresh_cameras)
    
    def set_controls_enabled(self, enabled):
        """Enable or disable camera panel controls (except refresh button)"""
        self.camera_combo.setEnabled(enabled)
        self.connect_btn.setEnabled(enabled)
        # Note: refresh button is managed separately in refresh_cameras method
    
    def refresh_cameras(self):
        """Refresh the list of available cameras"""
        try:
            # Disable camera selection and connect button during refresh
            self.set_controls_enabled(False)
            
            # Update refresh button to show progress and disable it
            self.refresh_btn.setText("Đang làm mới...")
            self.refresh_btn.setEnabled(False)
            
            # Clear existing items
            self.camera_combo.clear()
            self.camera_combo.addItem("Đang quét camera...")
            
            self.log_text.append("🔄 Đang làm mới danh sách camera...")
            
            # Force UI update
            QApplication.processEvents()
            
            # Get available cameras (this may take some time for RTSP devices)
            available_cameras = get_available_cameras()
            
            # Clear the "scanning" message
            self.camera_combo.clear()
            
            if not available_cameras:
                self.camera_combo.addItem("Không tìm thấy camera")
                self.camera_combo.setEnabled(False)
                self.log_text.append("❌ Không phát hiện camera nào. Vui lòng kiểm tra kết nối camera.")
            else:
                # Add available cameras to combobox
                for camera_index, camera_info in available_cameras:
                    self.camera_combo.addItem(camera_info, camera_index)
                
                self.camera_combo.setEnabled(True)
                self.log_text.append(f"✅ Tìm thấy {len(available_cameras)} camera")
                
        except Exception as e:
            self.camera_combo.clear()
            self.camera_combo.addItem("Lỗi phát hiện camera")
            self.camera_combo.setEnabled(False)
            self.log_text.append(f"❌ Lỗi làm mới camera: {str(e)}")
        
        finally:
            # Re-enable camera selection and connect button
            self.set_controls_enabled(True)
            # Re-enable refresh button
            self.refresh_btn.setText("Làm mới")
            self.refresh_btn.setEnabled(True)
    
    def toggle_connection(self):
        """Toggle camera connection"""
        if self.webcam_thread and self.webcam_thread.isRunning():
            self.disconnect_camera()
        else:
            self.connect_camera()
    
    def connect_camera(self):
        """Connect to selected camera"""
        try:
            # Get the actual camera index from the combobox data
            camera_index = self.camera_combo.currentData()
            if camera_index is None:
                self.log_text.append("Vui lòng chọn camera hợp lệ")
                return
            
            self.webcam_thread = WebcamThread(camera_index, self.panel_type)
            self.webcam_thread.frame_ready.connect(self.update_frame)
            self.webcam_thread.error_occurred.connect(self.handle_error)
            self.webcam_thread.api_response_ready.connect(self.show_api_response)
            self.webcam_thread.start()
            
            self.connect_btn.setText("Ngắt kết nối")
            self.connect_btn.setStyleSheet("background-color: #ff6b6b; color: white;")
            # Disable camera selection and refresh during connection
            self.camera_combo.setEnabled(False)
            self.refresh_btn.setEnabled(False)
            
            self.log_text.append(f"Đang kết nối đến {self.camera_combo.currentText()}...")
            
        except Exception as e:
            self.log_text.append(f"Lỗi kết nối camera: {str(e)}")
    
    def disconnect_camera(self):
        """Disconnect from camera"""
        if self.webcam_thread:
            self.webcam_thread.stop()
            self.webcam_thread = None
        
        self.connect_btn.setText("Kết nối")
        self.connect_btn.setStyleSheet("")
        # Re-enable camera selection and refresh
        self.camera_combo.setEnabled(True)
        self.refresh_btn.setEnabled(True)
        self.video_label.setText("Chưa kết nối camera")
        self.video_label.setPixmap(QPixmap())
        self.log_text.append("Đã ngắt kết nối camera")
    
    def update_frame(self, frame, license_plate_text):
        """Update the video display with new frame"""
        try:
            # Convert OpenCV frame to QPixmap
            rgb_image = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            h, w, ch = rgb_image.shape
            bytes_per_line = ch * w
            qt_image = QImage(rgb_image.data, w, h, bytes_per_line, QImage.Format_RGB888)
            pixmap = QPixmap.fromImage(qt_image)
            
            # Scale the image to fit the label while maintaining aspect ratio
            scaled_pixmap = pixmap.scaled(self.video_label.size(), Qt.KeepAspectRatio, Qt.SmoothTransformation)
            self.video_label.setPixmap(scaled_pixmap)
            
            # Log detected license plate
            if license_plate_text:
                timestamp = time.strftime("%Y-%m-%d %H:%M:%S")
                log_entry = f"[{timestamp}] {self.panel_type.upper()}: {license_plate_text}"
                self.log_text.append(log_entry)
                
        except Exception as e:
            self.log_text.append(f"Error updating frame: {str(e)}")
    
    def handle_error(self, error_message):
        """Handle errors from webcam thread"""
        self.log_text.append(f"ERROR: {error_message}")
        self.disconnect_camera()
    
    def cleanup_closed_dialogs(self):
        """Clean up any dialogs that have been closed but not removed from tracking"""
        try:
            closed_dialogs = []
            for key, dialog in self.active_dialogs.items():
                # Check if dialog is still visible/active
                if not dialog.isVisible() or dialog.isHidden():
                    closed_dialogs.append(key)
            
            # Remove closed dialogs from tracking
            for key in closed_dialogs:
                del self.active_dialogs[key]
                print(f"Cleaned up closed dialog: {key}")
                
        except Exception as e:
            print(f"Error cleaning up closed dialogs: {e}")
    
    def show_api_response(self, license_plate, panel_type, response_data):
        """Show API response in popup dialog"""
        try:
            # Create a unique key for this detection with timestamp
            import time
            current_time = int(time.time())
            dialog_key = f"{license_plate}_{panel_type}_{current_time}"
            
            # Clean up any closed dialogs first
            self.cleanup_closed_dialogs()
            
            # Check popup cooldown to prevent spam (minimum 5 seconds between popups for same plate)
            plate_key = f"{license_plate}_{panel_type}"
            if plate_key in self.last_popup_time:
                time_since_last_popup = current_time - self.last_popup_time[plate_key]
                # Use longer cooldown for connection errors to prevent spam
                if response_data.get("connection_error", False):
                    cooldown_duration = config_manager.get_connection_error_popup_cooldown()
                else:
                    cooldown_duration = 5
                if time_since_last_popup < cooldown_duration:
                    print(f"Popup cooldown active for {license_plate} - {cooldown_duration - time_since_last_popup:.1f}s remaining")
                    return
            
            # Check if a dialog for this detection is already open (within last 10 seconds)
            for key in list(self.active_dialogs.keys()):
                if key.startswith(f"{license_plate}_{panel_type}_"):
                    # Extract timestamp from key
                    try:
                        key_time = int(key.split('_')[-1])
                        if current_time - key_time < 10:  # Within 10 seconds
                            print(f"Dialog already exists for {license_plate} - skipping (key: {key})")
                            return
                    except:
                        pass
            
            # Also check if we have any active dialogs for this license plate (regardless of timestamp)
            for key in self.active_dialogs.keys():
                if key.startswith(f"{license_plate}_{panel_type}_"):
                    print(f"Active dialog found for {license_plate} - skipping (key: {key})")
                    return
            
            # Log the API response
            timestamp = datetime.now().strftime("%H:%M:%S")
            status = "THÀNH CÔNG" if response_data.get("success", False) else "LỖI"
            self.log_text.append(f"[{timestamp}] API {status}: {license_plate} - {response_data.get('message', 'Không có thông báo')}")
            
            # Automatically speak the response if TTS is enabled
            if config_manager.get_tts_enabled():
                tts_manager.speak_license_plate_response(license_plate, panel_type, response_data)
            
            # Show popup dialog - use main window as parent
            main_window = self.parent()
            while main_window and not isinstance(main_window, QMainWindow):
                main_window = main_window.parent()
            
            dialog = APIResponseDialog(license_plate, panel_type, response_data, main_window)
            dialog.scan_again_requested.connect(self.handle_scan_again_request)
            
            # Track this dialog
            self.active_dialogs[dialog_key] = dialog
            
            # Connect dialog close signal to remove from tracking - FIX: Use proper closure
            def remove_dialog(key=dialog_key):
                """Remove dialog from tracking when closed"""
                try:
                    if key in self.active_dialogs:
                        del self.active_dialogs[key]
                        print(f"Dialog removed from tracking: {key}")
                except Exception as e:
                    print(f"Error removing dialog from tracking: {e}")
            
            dialog.finished.connect(remove_dialog)
            
            # Clean up old dialog keys (older than 30 seconds)
            current_time = int(time.time())
            old_keys = []
            for key in self.active_dialogs.keys():
                if '_' in key:
                    try:
                        key_time = int(key.split('_')[-1])
                        if current_time - key_time > 30:  # Older than 30 seconds
                            old_keys.append(key)
                    except:
                        old_keys.append(key)
            
            for old_key in old_keys:
                self.active_dialogs.pop(old_key, None)
            
            # Update last popup time for this license plate
            self.last_popup_time[plate_key] = current_time
            
            dialog.show()
            print(f"Dialog created for {license_plate} with key: {dialog_key}")
            
        except Exception as e:
            self.log_text.append(f"Lỗi hiển thị phản hồi API: {str(e)}")
    
    def handle_scan_again_request(self):
        """Handle scan again request from dialog"""
        try:
            self.log_text.append("Yêu cầu quét lại - kích hoạt phát hiện mới...")
            
            # Force a new detection by clearing all tracking data
            if self.webcam_thread and hasattr(self.webcam_thread, 'last_detection_time'):
                # Clear the last detection time to allow immediate re-detection
                self.webcam_thread.last_detection_time.clear()
                self.log_text.append("Đã xóa thời gian chờ phát hiện - sẵn sàng quét mới")
            
            # Clear the last saved plates to allow re-detection
            if self.webcam_thread and hasattr(self.webcam_thread, 'last_saved_plates'):
                self.webcam_thread.last_saved_plates.clear()
                self.log_text.append("Đã xóa biển số đã lưu - sẽ phát hiện lại")
            
            # Clear global detection tracking for this panel
            global global_detection_times
            keys_to_remove = [key for key in global_detection_times.keys() if key.endswith(f"_{self.panel_type}")]
            for key in keys_to_remove:
                del global_detection_times[key]
            self.log_text.append(f"Đã xóa theo dõi phát hiện toàn cục cho panel {self.panel_type}")
            
            # Clear the detection start times to reset 3-second timer
            if self.webcam_thread and hasattr(self.webcam_thread, 'plate_detection_start'):
                self.webcam_thread.plate_detection_start.clear()
                self.log_text.append("Đã reset bộ đếm thời gian phát hiện - bắt đầu đếm ngược 3 giây")
            
            # Clear popup cooldown to allow immediate new popups
            self.last_popup_time.clear()
            self.log_text.append("Đã xóa thời gian chờ popup - cho phép popup mới ngay lập tức")
            
        except Exception as e:
            self.log_text.append(f"Lỗi xử lý yêu cầu quét lại: {str(e)}")


class LicensePlateMonitor(QMainWindow):
    """Main application window"""
    def __init__(self):
        super().__init__()
        self.setWindowTitle("Giám sát biển số xe - Hệ thống vào ra")
        
        # Set window size from configuration
        width, height = config_manager.get_window_size()
        self.setGeometry(100, 100, width, height)
        
        # Create central widget
        central_widget = QWidget()
        self.setCentralWidget(central_widget)
        
        # Main layout
        main_layout = QVBoxLayout()
        
        # Cache status bar
        cache_layout = QHBoxLayout()
        self.cache_status_label = QLabel("Cache: 0 entries")
        self.cache_status_label.setStyleSheet("""
            QLabel {
                background-color: #e9ecef;
                border: 1px solid #dee2e6;
                padding: 5px 10px;
                border-radius: 3px;
                font-size: 10px;
            }
        """)
        cache_layout.addWidget(self.cache_status_label)
        cache_layout.addStretch()
        
        # Configuration button
        self.config_btn = QPushButton("Settings")
        self.config_btn.setMaximumWidth(80)
        self.config_btn.clicked.connect(self.show_config_dialog)
        self.config_btn.setStyleSheet("""
            QPushButton {
                background-color: #17a2b8;
                color: white;
                border: none;
                padding: 5px 10px;
                border-radius: 3px;
                font-size: 10px;
            }
            QPushButton:hover {
                background-color: #138496;
            }
        """)
        cache_layout.addWidget(self.config_btn)
        
        # TTS control button
        self.tts_btn = QPushButton("🔊 TTS")
        self.tts_btn.setMaximumWidth(80)
        self.tts_btn.clicked.connect(self.toggle_tts)
        self.update_tts_button_style()
        cache_layout.addWidget(self.tts_btn)
        
        # Clear cache button
        self.clear_cache_btn = QPushButton("Clear Cache")
        self.clear_cache_btn.setMaximumWidth(100)
        self.clear_cache_btn.clicked.connect(self.clear_cache)
        self.clear_cache_btn.setStyleSheet("""
            QPushButton {
                background-color: #dc3545;
                color: white;
                border: none;
                padding: 5px 10px;
                border-radius: 3px;
                font-size: 10px;
            }
            QPushButton:hover {
                background-color: #c82333;
            }
        """)
        cache_layout.addWidget(self.clear_cache_btn)
        
        # Reset rate limit button
        self.reset_rate_limit_btn = QPushButton("Reset Rate Limit")
        self.reset_rate_limit_btn.setMaximumWidth(120)
        self.reset_rate_limit_btn.clicked.connect(self.reset_rate_limit)
        self.reset_rate_limit_btn.setStyleSheet("""
            QPushButton {
                background-color: #ffc107;
                color: #212529;
                border: none;
                padding: 5px 10px;
                border-radius: 3px;
                font-size: 10px;
            }
            QPushButton:hover {
                background-color: #e0a800;
            }
        """)
        cache_layout.addWidget(self.reset_rate_limit_btn)
        
        # Reset TTS button
        self.reset_tts_btn = QPushButton("Reset TTS")
        self.reset_tts_btn.setMaximumWidth(80)
        self.reset_tts_btn.clicked.connect(self.reset_tts)
        self.reset_tts_btn.setStyleSheet("""
            QPushButton {
                background-color: #6f42c1;
                color: white;
                border: none;
                padding: 5px 10px;
                border-radius: 3px;
                font-size: 10px;
            }
            QPushButton:hover {
                background-color: #5a32a3;
            }
        """)
        cache_layout.addWidget(self.reset_tts_btn)
        
        main_layout.addLayout(cache_layout)
        
        # Camera panels layout
        panels_layout = QHBoxLayout()
        
        # Create left panel (Entry)
        self.entry_panel = CameraPanel("MÀN HÌNH VÀO", "entry")
        panels_layout.addWidget(self.entry_panel)
        
        # Create right panel (Exit)
        self.exit_panel = CameraPanel("MÀN HÌNH RA", "exit")
        panels_layout.addWidget(self.exit_panel)
        
        main_layout.addLayout(panels_layout)
        
        central_widget.setLayout(main_layout)
        
        # Start cache status timer
        self.cache_timer = QTimer()
        self.cache_timer.timeout.connect(self.update_cache_status)
        self.cache_timer.start(5000)  # Update every 5 seconds
        
        # Set window style
        self.setStyleSheet("""
            QMainWindow {
                background-color: #f0f0f0;
            }
            QGroupBox {
                font-weight: bold;
                border: 2px solid #cccccc;
                border-radius: 5px;
                margin-top: 1ex;
                padding-top: 10px;
            }
            QGroupBox::title {
                subcontrol-origin: margin;
                left: 10px;
                padding: 0 5px 0 5px;
            }
            QPushButton {
                background-color: #4CAF50;
                color: white;
                border: none;
                padding: 8px 16px;
                border-radius: 4px;
                font-weight: bold;
            }
            QPushButton:hover {
                background-color: #45a049;
            }
            QPushButton#refresh {
                background-color: #2196F3;
                max-width: 80px;
            }
            QPushButton#refresh:hover {
                background-color: #1976D2;
            }
            QComboBox {
                padding: 5px;
                border: 1px solid #ccc;
                border-radius: 3px;
            }
        """)
    
    def closeEvent(self, event):
        """Handle application close event"""
        # Stop all webcam threads
        if self.entry_panel.webcam_thread:
            self.entry_panel.webcam_thread.stop()
        if self.exit_panel.webcam_thread:
            self.exit_panel.webcam_thread.stop()
        
        event.accept()
    
    def update_cache_status(self):
        """Update the cache status display"""
        try:
            # Clean expired cache entries
            clean_expired_cache()
            
            # Get cache and rate limit status
            cache_count = len(api_cache)
            rate_status = get_rate_limit_status()
            
            # Get TTS status
            tts_status = tts_manager.get_status()
            tts_info = f"TTS: {'ON' if tts_status['engine_available'] else 'OFF'}"
            if tts_status['is_speaking']:
                tts_info += " (Speaking)"
            
            # Update status label with cache, rate limit, and TTS info
            status_text = f"Cache: {cache_count} entries | API: {rate_status['current_requests']}/{rate_status['max_requests']} req/min | {tts_info}"
            self.cache_status_label.setText(status_text)
            
            # Change color based on rate limit status
            if rate_status['remaining'] <= 5:  # Warning when 5 or fewer requests remaining
                self.cache_status_label.setStyleSheet("""
                    QLabel {
                        background-color: #fff3cd;
                        border: 1px solid #ffeaa7;
                        padding: 5px 10px;
                        border-radius: 3px;
                        font-size: 10px;
                        color: #856404;
                    }
                """)
            elif rate_status['remaining'] <= 2:  # Danger when 2 or fewer requests remaining
                self.cache_status_label.setStyleSheet("""
                    QLabel {
                        background-color: #f8d7da;
                        border: 1px solid #f5c6cb;
                        padding: 5px 10px;
                        border-radius: 3px;
                        font-size: 10px;
                        color: #721c24;
                    }
                """)
            else:  # Normal status
                self.cache_status_label.setStyleSheet("""
                    QLabel {
                        background-color: #e9ecef;
                        border: 1px solid #dee2e6;
                        padding: 5px 10px;
                        border-radius: 3px;
                        font-size: 10px;
                    }
                """)
            
        except Exception as e:
            self.cache_status_label.setText(f"Cache: Error - {str(e)}")
    
    def clear_cache(self):
        """Clear all cached API responses"""
        try:
            global api_cache
            api_cache.clear()
            self.update_cache_status()
            
            # Also clear popup cooldowns to allow immediate testing
            self.entry_panel.last_popup_time.clear()
            self.exit_panel.last_popup_time.clear()
            
            # Show confirmation message
            QMessageBox.information(self, "Cache Cleared", "All cached API responses and popup cooldowns have been cleared.")
            
        except Exception as e:
            QMessageBox.warning(self, "Error", f"Failed to clear cache: {str(e)}")
    
    def reset_rate_limit(self):
        """Reset rate limiting data"""
        try:
            global api_request_times
            api_request_times.clear()
            self.update_cache_status()
            
            # Show confirmation message
            QMessageBox.information(self, "Rate Limit Reset", "API rate limiting data has been reset. You can now make new API requests.")
            
        except Exception as e:
            QMessageBox.warning(self, "Error", f"Failed to reset rate limit: {str(e)}")
    
    def reset_tts(self):
        """Reset TTS manager state"""
        try:
            tts_manager.reset_state()
            
            # Show confirmation message
            QMessageBox.information(self, "TTS Reset", "TTS manager has been reset. TTS should now work properly.")
            
        except Exception as e:
            QMessageBox.warning(self, "Error", f"Failed to reset TTS: {str(e)}")
    
    def show_config_dialog(self):
        """Show configuration dialog"""
        try:
            dialog = ConfigDialog(self)
            if dialog.exec_() == QDialog.Accepted:
                # Configuration was saved, reload settings
                self.reload_configuration()
                QMessageBox.information(self, "Configuration Updated", 
                                      "Configuration has been updated. Some changes may require restarting the application.")
        except Exception as e:
            QMessageBox.critical(self, "Error", f"Error opening configuration dialog: {str(e)}")
    
    def reload_configuration(self):
        """Reload configuration and update UI"""
        try:
            # Update window size if changed
            width, height = config_manager.get_window_size()
            self.resize(width, height)
            
            # Update cache status
            self.update_cache_status()
            
            # Note: Model reloading would require restarting the application
            # as PyTorch models are loaded during thread initialization
            
        except Exception as e:
            print(f"Error reloading configuration: {e}")
    
    def toggle_tts(self):
        """Toggle TTS on/off"""
        try:
            current_state = config_manager.get_tts_enabled()
            new_state = not current_state
            config_manager.set('tts.enabled', new_state)
            config_manager.save_config()
            
            self.update_tts_button_style()
            
            status = "enabled" if new_state else "disabled"
            QMessageBox.information(self, "TTS Status", f"Text-to-Speech has been {status}.")
            
        except Exception as e:
            QMessageBox.warning(self, "Error", f"Failed to toggle TTS: {str(e)}")
    
    def update_tts_button_style(self):
        """Update TTS button style based on current state"""
        try:
            is_enabled = config_manager.get_tts_enabled()
            
            if is_enabled:
                self.tts_btn.setText("🔊 TTS")
                self.tts_btn.setStyleSheet("""
                    QPushButton {
                        background-color: #28a745;
                        color: white;
                        border: none;
                        padding: 5px 10px;
                        border-radius: 3px;
                        font-size: 10px;
                    }
                    QPushButton:hover {
                        background-color: #218838;
                    }
                """)
            else:
                self.tts_btn.setText("🔇 TTS")
                self.tts_btn.setStyleSheet("""
                    QPushButton {
                        background-color: #6c757d;
                        color: white;
                        border: none;
                        padding: 5px 10px;
                        border-radius: 3px;
                        font-size: 10px;
                    }
                    QPushButton:hover {
                        background-color: #5a6268;
                    }
                """)
                
        except Exception as e:
            print(f"Error updating TTS button style: {e}")


def main():
    """Main application entry point"""
    app = QApplication(sys.argv)
    
    # Set application properties
    app.setApplicationName("License Plate Monitor")
    app.setApplicationVersion("1.0")
    
    # Create and show main window
    window = LicensePlateMonitor()
    window.show()
    
    # Start the application
    sys.exit(app.exec_())


if __name__ == "__main__":
    main()
