#!/usr/bin/env python3
"""
Configuration Manager for License Plate Monitor
Handles loading, saving, and managing application configuration
"""

import json
import os
from typing import Dict, Any


class ConfigManager:
    """Manages application configuration"""
    
    def __init__(self, config_file="config.json"):
        self.config_file = config_file
        self.config = self.load_default_config()
        self.load_config()
    
    def load_default_config(self) -> Dict[str, Any]:
        """Load default configuration"""
        return {
            "api": {
                "base_url": "http://localhost:8080",
                "endpoint": "/api/vehicles/check-vehicle",
                "timeout": 10,
                "gate_key": ""
            },
            "gate": {
                "id": "",
                "name": "",
                "location": "",
                "camera_rtsp": "",
                "panel_type": "entry",
                "device_id": "device_1",
                "heartbeat_interval": 30,
                "heartbeat_backoff_max": 300,
                "send_snapshot": True,
                "snapshot_max_width": 640,
                "snapshot_jpeg_quality": 80,
                "queue": {
                    "enabled": True,
                    "dir": "edge_queue",
                    "path": "",
                    "max_events": 5000,
                    "retry_base_seconds": 1.0,
                    "retry_max_seconds": 60.0,
                    "poll_interval_seconds": 5.0,
                    "batch_size": 20
                }
            },
            "detection": {
                "cooldown": 5,
                "cache_duration": 300,
                "max_cameras": 10,
                "frame_interval_ms": 200
            },
            "rate_limiting": {
                "max_requests_per_minute": 30,
                "enabled": True
            },
            "ui": {
                "window_width": 1400,
                "window_height": 800,
                "video_width": 640,
                "video_height": 480
            },
            "models": {
                "lp_detector": "model/LP_detector_nano_61.pt",
                "lp_ocr": "model/LP_ocr_nano_62.pt",
                "confidence_threshold": 0.60
            },
            "ocr": {
                "fallback_enabled": True,
                "fallback_method": "tesseract",
                "tesseract_cmd": "",
                "easyocr_languages": ["en", "vi"],
                "easyocr_gpu": False,
                "easyocr_min_confidence": 0.4,
                "google_vision_credentials": "",
                "google_vision_language_hints": ["vi", "en"]
            },
            "rtsp_devices": {
                "device_1": {
                    "enabled": False,
                    "name": "RTSP Device 1",
                    "url": "rtsp://username:password@192.168.1.100:554/stream1"
                },
                "device_2": {
                    "enabled": False,
                    "name": "RTSP Device 2", 
                    "url": "rtsp://username:password@192.168.1.101:554/stream1"
                }
            },
            "rtsp_optimization": {
                "buffer_size": 1,
                "drop_frames": True,
                "low_latency": True,
                "tcp_transport": False,
                "connection_timeout": 5000,
                "read_timeout": 1000,
                "frame_skip_threshold": 3,
                "h264_error_handling": True,
                "frame_validation": True,
                "max_resolution_width": 640,
                "max_resolution_height": 480
            }
        }
    
    def load_config(self) -> bool:
        """Load configuration from file"""
        try:
            if os.path.exists(self.config_file):
                with open(self.config_file, 'r', encoding='utf-8') as f:
                    loaded_config = json.load(f)
                    # Merge with default config to ensure all keys exist
                    self.config = self._merge_configs(self.config, loaded_config)
                return True
            else:
                # Create default config file if it doesn't exist
                self.save_config()
                return True
        except Exception as e:
            print(f"Error loading config: {e}")
            return False
    
    def save_config(self) -> bool:
        """Save configuration to file"""
        try:
            with open(self.config_file, 'w', encoding='utf-8') as f:
                json.dump(self.config, f, indent=4, ensure_ascii=False)
            return True
        except Exception as e:
            print(f"Error saving config: {e}")
            return False
    
    def _merge_configs(self, default: Dict, loaded: Dict) -> Dict:
        """Merge loaded config with default config"""
        result = default.copy()
        for key, value in loaded.items():
            if key in result and isinstance(result[key], dict) and isinstance(value, dict):
                result[key] = self._merge_configs(result[key], value)
            else:
                result[key] = value
        return result
    
    def get(self, key_path: str, default=None):
        """Get configuration value using dot notation (e.g., 'api.base_url')"""
        keys = key_path.split('.')
        value = self.config
        try:
            for key in keys:
                value = value[key]
            return value
        except (KeyError, TypeError):
            return default
    
    def set(self, key_path: str, value: Any):
        """Set configuration value using dot notation"""
        keys = key_path.split('.')
        config = self.config
        for key in keys[:-1]:
            if key not in config:
                config[key] = {}
            config = config[key]
        config[keys[-1]] = value
    
    def get_api_url(self) -> str:
        """Get full API URL"""
        base_url = self.get('api.base_url', 'http://localhost:8080')
        endpoint = self.get('api.endpoint', '/api/vehicles/check-vehicle')
        return f"{base_url}{endpoint}"
    
    def get_api_timeout(self) -> int:
        """Get API timeout"""
        return self.get('api.timeout', 10)
    
    def get_api_use_query_params(self) -> bool:
        """Get whether to use query parameters for API"""
        return self.get('api.use_query_params', False)

    def get_gate_key(self) -> str:
        """Get the X-Gate-Key shared secret sent to the gate endpoints.

        Resolution order: api.gate_key in config.json first (convenient for a
        desktop client), then the GATE_API_KEY environment variable. Returns an
        empty string when neither is set; the backend will reject the request
        with 401 once GATE_API_KEY is configured there.
        """
        key = self.get('api.gate_key', '')
        if not key:
            key = os.environ.get('GATE_API_KEY', '')
        return key or ''
    
    def get_api_base_url(self) -> str:
        """Get the backend base URL (no trailing endpoint)."""
        return self.get('api.base_url', 'http://localhost:8080').rstrip('/')

    # ---- Gate (edge service) configuration ----

    def get_gate_id(self) -> str:
        """Get the persisted gate id (empty until the edge registers)."""
        return self.get('gate.id', '') or ''

    def set_gate_id(self, gate_id: str) -> bool:
        """Persist the gate id returned by /api/gates/register to config.json."""
        self.set('gate.id', gate_id or '')
        return self.save_config()

    def get_gate_name(self) -> str:
        """Get the human-readable gate name used at registration."""
        return self.get('gate.name', '') or ''

    def get_gate_location(self) -> str:
        """Get the gate location string."""
        return self.get('gate.location', '') or ''

    def get_gate_camera_rtsp(self) -> str:
        """Get the RTSP URL reported to the backend at registration.

        Falls back to the configured edge device URL when unset so the backend
        record stays meaningful without duplicating the URL in two places.
        """
        rtsp = self.get('gate.camera_rtsp', '') or ''
        if not rtsp:
            rtsp = self.get_rtsp_device_url(self.get_gate_device_id())
        return rtsp

    def get_gate_panel_type(self) -> str:
        """Get the direction this gate reports: 'entry' or 'exit'."""
        return (self.get('gate.panel_type', 'entry') or 'entry').lower()

    def get_gate_device_id(self) -> str:
        """Get the rtsp_devices key the edge service should stream from."""
        return self.get('gate.device_id', 'device_1') or 'device_1'

    def get_gate_heartbeat_interval(self) -> int:
        """Get the heartbeat interval in seconds."""
        return max(5, int(self.get('gate.heartbeat_interval', 30)))

    def get_heartbeat_backoff_max(self) -> int:
        """Max heartbeat interval (seconds) while the backend is unreachable (Phase 4.3)."""
        return max(self.get_gate_heartbeat_interval(),
                   int(self.get('gate.heartbeat_backoff_max', 300)))

    # ---- Store-and-forward queue (Phase 4.3) ----

    def get_queue_enabled(self) -> bool:
        """Whether unsent check-vehicle events are persisted and retried."""
        return bool(self.get('gate.queue.enabled', True))

    def get_queue_dir(self) -> str:
        """Directory that holds the store-and-forward queue file."""
        return self.get('gate.queue.dir', 'edge_queue') or 'edge_queue'

    def get_queue_path(self) -> str:
        """Full path to the queue SQLite file.

        Uses ``gate.queue.path`` verbatim when set, otherwise ``<queue.dir>/events.sqlite3``.
        Run one edge process per gate, each with its own config (and thus its own
        queue dir/path), so gates never share a queue file.
        """
        explicit = self.get('gate.queue.path', '') or ''
        if explicit:
            return explicit
        return os.path.join(self.get_queue_dir(), 'events.sqlite3')

    def get_queue_max_events(self) -> int:
        """Max events retained in the queue; oldest are dropped past this cap."""
        return max(1, int(self.get('gate.queue.max_events', 5000)))

    def get_queue_retry_base_seconds(self) -> float:
        """Base delay (seconds) for the first retry of a queued event."""
        return max(0.1, float(self.get('gate.queue.retry_base_seconds', 1.0)))

    def get_queue_retry_max_seconds(self) -> float:
        """Cap (seconds) on the exponential retry backoff for a queued event."""
        return max(self.get_queue_retry_base_seconds(),
                   float(self.get('gate.queue.retry_max_seconds', 60.0)))

    def get_queue_poll_interval(self) -> float:
        """How often (seconds) the retry worker scans the queue for due events."""
        return max(0.5, float(self.get('gate.queue.poll_interval_seconds', 5.0)))

    def get_queue_batch_size(self) -> int:
        """Max queued events the retry worker attempts to flush per poll."""
        return max(1, int(self.get('gate.queue.batch_size', 20)))

    def get_gate_send_snapshot(self) -> bool:
        """Whether the edge attaches the cropped plate image to check-vehicle (Phase 4.2)."""
        return bool(self.get('gate.send_snapshot', True))

    def get_gate_snapshot_max_width(self) -> int:
        """Max width (px) the snapshot is downscaled to before sending; 0 disables resizing."""
        return max(0, int(self.get('gate.snapshot_max_width', 640)))

    def get_gate_snapshot_jpeg_quality(self) -> int:
        """JPEG quality (1-100) used to encode the snapshot before sending."""
        return min(100, max(1, int(self.get('gate.snapshot_jpeg_quality', 80))))

    def get_api_use_cookies(self) -> bool:
        """Get whether to use cookies for API authentication"""
        return self.get('api.use_cookies', False)
    
    def get_api_cookies(self) -> dict:
        """Get API cookies"""
        return self.get('api.cookies', {})
    
    def get_cache_duration(self) -> int:
        """Get cache duration in seconds"""
        return self.get('detection.cache_duration', 300)
    
    def get_detection_cooldown(self) -> int:
        """Get detection cooldown in seconds"""
        return self.get('detection.cooldown', 5)
    
    def get_rate_limit_max_requests(self) -> int:
        """Get maximum API requests per minute"""
        return self.get('rate_limiting.max_requests_per_minute', 30)
    
    def get_rate_limit_enabled(self) -> bool:
        """Get whether rate limiting is enabled"""
        return self.get('rate_limiting.enabled', True)
    
    def get_connection_error_cache_duration(self) -> int:
        """Get cache duration for connection errors in seconds"""
        return self.get('error_handling.connection_error_cache_duration', 300)
    
    def get_connection_error_popup_cooldown(self) -> int:
        """Get popup cooldown for connection errors in seconds"""
        return self.get('error_handling.connection_error_popup_cooldown', 30)
    
    def get_max_cameras(self) -> int:
        """Get maximum number of cameras to scan"""
        return self.get('detection.max_cameras', 10)
    
    def get_min_detection_duration(self) -> float:
        """Get minimum detection duration in seconds"""
        return self.get('detection.min_detection_duration', 3.0)
    
    def get_detection_frame_interval_ms(self) -> int:
        """Get minimum interval between heavy detections in milliseconds"""
        return self.get('detection.frame_interval_ms', 200)
    
    def get_window_size(self) -> tuple:
        """Get window size"""
        width = self.get('ui.window_width', 1400)
        height = self.get('ui.window_height', 800)
        return (width, height)
    
    def get_video_size(self) -> tuple:
        """Get video display size"""
        width = self.get('ui.video_width', 640)
        height = self.get('ui.video_height', 480)
        return (width, height)
    
    def get_model_paths(self) -> tuple:
        """Get model file paths"""
        detector = self.get('models.lp_detector', 'model/LP_detector_nano_61.pt')
        ocr = self.get('models.lp_ocr', 'model/LP_ocr_nano_62.pt')
        return (detector, ocr)
    
    def get_confidence_threshold(self) -> float:
        """Get confidence threshold for license plate detection"""
        return self.get('models.confidence_threshold', 0.60)
    
    def get_tts_enabled(self) -> bool:
        """Get TTS enabled status"""
        return self.get('tts.enabled', True)
    
    def get_tts_use_gtts(self) -> bool:
        """Get whether to use Google TTS"""
        return self.get('tts.use_gtts', True)
    
    def get_tts_rate(self) -> int:
        """Get TTS speech rate"""
        return self.get('tts.rate', 150)
    
    def get_tts_volume(self) -> float:
        """Get TTS volume"""
        return self.get('tts.volume', 0.8)
    
    def get_tts_language(self) -> str:
        """Get TTS language"""
        return self.get('tts.language', 'vi')
    
    def get_rtsp_devices(self) -> Dict[str, Any]:
        """Get RTSP devices configuration"""
        return self.get('rtsp_devices', {})
    
    def get_rtsp_device(self, device_id: str) -> Dict[str, Any]:
        """Get specific RTSP device configuration"""
        return self.get(f'rtsp_devices.{device_id}', {})
    
    def is_rtsp_device_enabled(self, device_id: str) -> bool:
        """Check if specific RTSP device is enabled"""
        return self.get(f'rtsp_devices.{device_id}.enabled', False)
    
    def get_rtsp_device_url(self, device_id: str) -> str:
        """Get RTSP device URL"""
        return self.get(f'rtsp_devices.{device_id}.url', '')
    
    def build_rtsp_url(self, device_id: str) -> str:
        """Get RTSP URL from device configuration with optimization parameters"""
        device = self.get_rtsp_device(device_id)
        if not device:
            return ""
        
        # Get the direct URL from configuration
        base_url = device.get('url', '')
        if not base_url:
            return ""
        
        # Add optimization parameters
        optimization = self.get_rtsp_optimization()
        params = []
        
        if optimization.get('low_latency', True):
            params.append('?tcp')
        if optimization.get('buffer_size', 1) == 1:
            params.append('&buffer_size=1')
        
        if params:
            separator = '&' if '?' in base_url else '?'
            base_url += separator + '&'.join(params)
        
        return base_url
    
    def get_rtsp_optimization(self) -> dict:
        """Get RTSP optimization settings"""
        return self.get('rtsp_optimization', {})
    
    def get_rtsp_target_fps(self) -> int:
        """Get target FPS for RTSP streams"""
        return max(1, int(self.get('rtsp_optimization.target_fps', 25)))
    
    def get_rtsp_buffer_size(self) -> int:
        """Get RTSP buffer size"""
        return self.get('rtsp_optimization.buffer_size', 1)
    
    def get_rtsp_drop_frames(self) -> bool:
        """Get whether to drop frames for low latency"""
        return self.get('rtsp_optimization.drop_frames', True)
    
    def get_rtsp_low_latency(self) -> bool:
        """Get low latency mode setting"""
        return self.get('rtsp_optimization.low_latency', True)
    
    def get_rtsp_connection_timeout(self) -> int:
        """Get RTSP connection timeout in milliseconds"""
        return self.get('rtsp_optimization.connection_timeout', 5000)
    
    def get_rtsp_read_timeout(self) -> int:
        """Get RTSP read timeout in milliseconds"""
        return self.get('rtsp_optimization.read_timeout', 1000)
    
    def get_rtsp_frame_skip_threshold(self) -> int:
        """Get frame skip threshold for buffer management"""
        return self.get('rtsp_optimization.frame_skip_threshold', 3)
    
    def get_rtsp_h264_error_handling(self) -> bool:
        """Get whether H.264 error handling is enabled"""
        return self.get('rtsp_optimization.h264_error_handling', True)
    
    def get_rtsp_frame_validation(self) -> bool:
        """Get whether frame validation is enabled"""
        return self.get('rtsp_optimization.frame_validation', True)
    
    def get_rtsp_max_resolution(self) -> tuple:
        """Get maximum resolution for RTSP streams"""
        width = self.get('rtsp_optimization.max_resolution_width', 640)
        height = self.get('rtsp_optimization.max_resolution_height', 480)
        return (width, height)

    def get_ocr_fallback_enabled(self) -> bool:
        """Return whether OCR fallback is enabled."""
        return self.get('ocr.fallback_enabled', True)

    def get_ocr_fallback_method(self) -> str:
        """Return configured OCR fallback method."""
        return self.get('ocr.fallback_method', 'tesseract')

    def get_ocr_tesseract_cmd(self) -> str:
        """Return custom Tesseract executable path."""
        return self.get('ocr.tesseract_cmd', '')

    def get_easyocr_languages(self):
        """Return EasyOCR languages list."""
        return self.get('ocr.easyocr_languages', ['en', 'vi'])

    def get_easyocr_gpu(self) -> bool:
        """Return EasyOCR GPU usage flag."""
        return self.get('ocr.easyocr_gpu', False)

    def get_easyocr_min_confidence(self) -> float:
        """Return EasyOCR minimal confidence threshold."""
        return float(self.get('ocr.easyocr_min_confidence', 0.4))

    def get_google_vision_credentials_path(self) -> str:
        """Return Google Vision credentials file path."""
        return self.get('ocr.google_vision_credentials', '')

    def get_google_vision_language_hints(self):
        """Return Google Vision language hints."""
        return self.get('ocr.google_vision_language_hints', ['vi', 'en'])


# Global config manager instance
config_manager = ConfigManager()
