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
                "base_url": "http://localhost:8000",
                "endpoint": "/api/entry-exit/check-vehicle",
                "timeout": 10
            },
            "detection": {
                "cooldown": 5,
                "cache_duration": 300,
                "max_cameras": 10
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
        base_url = self.get('api.base_url', 'http://localhost:8000')
        endpoint = self.get('api.endpoint', '/api/entry-exit/check-vehicle')
        return f"{base_url}{endpoint}"
    
    def get_api_timeout(self) -> int:
        """Get API timeout"""
        return self.get('api.timeout', 10)
    
    def get_api_use_query_params(self) -> bool:
        """Get whether to use query parameters for API"""
        return self.get('api.use_query_params', False)
    
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
    
    def get_max_cameras(self) -> int:
        """Get maximum number of cameras to scan"""
        return self.get('detection.max_cameras', 10)
    
    def get_min_detection_duration(self) -> float:
        """Get minimum detection duration in seconds"""
        return self.get('detection.min_detection_duration', 3.0)
    
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


# Global config manager instance
config_manager = ConfigManager()
