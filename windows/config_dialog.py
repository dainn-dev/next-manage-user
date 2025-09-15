#!/usr/bin/env python3
"""
Configuration Dialog for License Plate Monitor
Provides UI for editing application settings
"""

from PyQt5.QtWidgets import (QDialog, QVBoxLayout, QHBoxLayout, QLabel, 
                             QLineEdit, QSpinBox, QDoubleSpinBox, QPushButton, 
                             QGroupBox, QFormLayout, QMessageBox, QTabWidget,
                             QCheckBox, QComboBox)
from PyQt5.QtCore import Qt
from PyQt5.QtGui import QFont
from config_manager import config_manager


class ConfigDialog(QDialog):
    """Configuration dialog for application settings"""
    
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setWindowTitle("Configuration Settings")
        self.setModal(True)
        self.setFixedSize(500, 600)
        self.setup_ui()
        self.load_current_config()
    
    def setup_ui(self):
        """Setup the configuration dialog UI"""
        layout = QVBoxLayout()
        
        # Create tab widget
        tab_widget = QTabWidget()
        
        # API Configuration Tab
        api_tab = self.create_api_tab()
        tab_widget.addTab(api_tab, "API Settings")
        
        # Detection Configuration Tab
        detection_tab = self.create_detection_tab()
        tab_widget.addTab(detection_tab, "Detection Settings")
        
        # UI Configuration Tab
        ui_tab = self.create_ui_tab()
        tab_widget.addTab(ui_tab, "UI Settings")
        
        # Models Configuration Tab
        models_tab = self.create_models_tab()
        tab_widget.addTab(models_tab, "Model Settings")
        
        # TTS Configuration Tab
        tts_tab = self.create_tts_tab()
        tab_widget.addTab(tts_tab, "TTS Settings")
        
        layout.addWidget(tab_widget)
        
        # Buttons
        button_layout = QHBoxLayout()
        
        self.save_btn = QPushButton("Save")
        self.save_btn.clicked.connect(self.save_config)
        self.save_btn.setStyleSheet("""
            QPushButton {
                background-color: #28a745;
                color: white;
                border: none;
                padding: 8px 16px;
                border-radius: 4px;
                font-weight: bold;
            }
            QPushButton:hover {
                background-color: #218838;
            }
        """)
        
        self.cancel_btn = QPushButton("Cancel")
        self.cancel_btn.clicked.connect(self.reject)
        self.cancel_btn.setStyleSheet("""
            QPushButton {
                background-color: #6c757d;
                color: white;
                border: none;
                padding: 8px 16px;
                border-radius: 4px;
                font-weight: bold;
            }
            QPushButton:hover {
                background-color: #5a6268;
            }
        """)
        
        self.reset_btn = QPushButton("Reset to Defaults")
        self.reset_btn.clicked.connect(self.reset_to_defaults)
        self.reset_btn.setStyleSheet("""
            QPushButton {
                background-color: #dc3545;
                color: white;
                border: none;
                padding: 8px 16px;
                border-radius: 4px;
                font-weight: bold;
            }
            QPushButton:hover {
                background-color: #c82333;
            }
        """)
        
        button_layout.addWidget(self.reset_btn)
        button_layout.addStretch()
        button_layout.addWidget(self.cancel_btn)
        button_layout.addWidget(self.save_btn)
        
        layout.addLayout(button_layout)
        self.setLayout(layout)
    
    def create_api_tab(self):
        """Create API configuration tab"""
        widget = QGroupBox()
        layout = QFormLayout()
        
        # API Base URL
        self.api_base_url = QLineEdit()
        self.api_base_url.setPlaceholderText("http://localhost:8080")
        layout.addRow("API Base URL:", self.api_base_url)
        
        # API Endpoint
        self.api_endpoint = QLineEdit()
        self.api_endpoint.setPlaceholderText("/api/entry-exit-requests/check-vehicle")
        layout.addRow("API Endpoint:", self.api_endpoint)
        
        # API Timeout
        self.api_timeout = QSpinBox()
        self.api_timeout.setRange(1, 60)
        self.api_timeout.setSuffix(" seconds")
        layout.addRow("API Timeout:", self.api_timeout)
        
        # Use Query Parameters
        self.use_query_params = QCheckBox()
        self.use_query_params.setToolTip("Use query parameters instead of JSON payload")
        layout.addRow("Use Query Parameters:", self.use_query_params)
        
        # Use Cookies
        self.use_cookies = QCheckBox()
        self.use_cookies.setToolTip("Include authentication cookies in requests")
        layout.addRow("Use Cookies:", self.use_cookies)
        
        # Access Token
        self.access_token = QLineEdit()
        self.access_token.setPlaceholderText("JWT access token")
        self.access_token.setEchoMode(QLineEdit.Password)
        layout.addRow("Access Token:", self.access_token)
        
        # Refresh Token
        self.refresh_token = QLineEdit()
        self.refresh_token.setPlaceholderText("JWT refresh token")
        self.refresh_token.setEchoMode(QLineEdit.Password)
        layout.addRow("Refresh Token:", self.refresh_token)
        
        widget.setLayout(layout)
        return widget
    
    def create_detection_tab(self):
        """Create detection configuration tab"""
        widget = QGroupBox()
        layout = QFormLayout()
        
        # Detection Cooldown
        self.detection_cooldown = QSpinBox()
        self.detection_cooldown.setRange(1, 60)
        self.detection_cooldown.setSuffix(" seconds")
        layout.addRow("Detection Cooldown:", self.detection_cooldown)
        
        # Cache Duration
        self.cache_duration = QSpinBox()
        self.cache_duration.setRange(60, 86400)  # 1 minute to 24 hours
        self.cache_duration.setSuffix(" seconds")
        layout.addRow("Cache Duration:", self.cache_duration)
        
        # Max Cameras
        self.max_cameras = QSpinBox()
        self.max_cameras.setRange(1, 20)
        layout.addRow("Max Cameras to Scan:", self.max_cameras)
        
        # Minimum Detection Duration
        self.min_detection_duration = QDoubleSpinBox()
        self.min_detection_duration.setRange(1.0, 10.0)
        self.min_detection_duration.setSingleStep(0.5)
        self.min_detection_duration.setSuffix(" seconds")
        self.min_detection_duration.setDecimals(1)
        layout.addRow("Min Detection Duration:", self.min_detection_duration)
        
        widget.setLayout(layout)
        return widget
    
    def create_ui_tab(self):
        """Create UI configuration tab"""
        widget = QGroupBox()
        layout = QFormLayout()
        
        # Window Size
        window_layout = QHBoxLayout()
        self.window_width = QSpinBox()
        self.window_width.setRange(800, 2000)
        self.window_height = QSpinBox()
        self.window_height.setRange(600, 1200)
        window_layout.addWidget(self.window_width)
        window_layout.addWidget(QLabel("x"))
        window_layout.addWidget(self.window_height)
        layout.addRow("Window Size:", window_layout)
        
        # Video Size
        video_layout = QHBoxLayout()
        self.video_width = QSpinBox()
        self.video_width.setRange(320, 1920)
        self.video_height = QSpinBox()
        self.video_height.setRange(240, 1080)
        video_layout.addWidget(self.video_width)
        video_layout.addWidget(QLabel("x"))
        video_layout.addWidget(self.video_height)
        layout.addRow("Video Display Size:", video_layout)
        
        widget.setLayout(layout)
        return widget
    
    def create_models_tab(self):
        """Create models configuration tab"""
        widget = QGroupBox()
        layout = QFormLayout()
        
        # LP Detector Model
        self.lp_detector = QLineEdit()
        self.lp_detector.setPlaceholderText("model/LP_detector_nano_61.pt")
        layout.addRow("License Plate Detector:", self.lp_detector)
        
        # LP OCR Model
        self.lp_ocr = QLineEdit()
        self.lp_ocr.setPlaceholderText("model/LP_ocr_nano_62.pt")
        layout.addRow("License Plate OCR:", self.lp_ocr)
        
        # Confidence Threshold
        self.confidence_threshold = QDoubleSpinBox()
        self.confidence_threshold.setRange(0.1, 1.0)
        self.confidence_threshold.setSingleStep(0.05)
        self.confidence_threshold.setDecimals(2)
        layout.addRow("Confidence Threshold:", self.confidence_threshold)
        
        widget.setLayout(layout)
        return widget
    
    def create_tts_tab(self):
        """Create TTS configuration tab"""
        widget = QGroupBox()
        layout = QFormLayout()
        
        # TTS Enabled
        self.tts_enabled = QCheckBox()
        layout.addRow("Enable TTS:", self.tts_enabled)
        
        # Use Google TTS
        self.tts_use_gtts = QCheckBox()
        layout.addRow("Use Google TTS:", self.tts_use_gtts)
        
        # TTS Rate
        self.tts_rate = QSpinBox()
        self.tts_rate.setRange(50, 300)
        self.tts_rate.setSuffix(" words/min")
        layout.addRow("Speech Rate:", self.tts_rate)
        
        # TTS Volume
        self.tts_volume = QDoubleSpinBox()
        self.tts_volume.setRange(0.0, 1.0)
        self.tts_volume.setSingleStep(0.1)
        self.tts_volume.setDecimals(1)
        layout.addRow("Volume:", self.tts_volume)
        
        # TTS Language
        self.tts_language = QComboBox()
        self.tts_language.addItems(["vi", "en", "zh", "ja", "ko"])
        layout.addRow("Language:", self.tts_language)
        
        widget.setLayout(layout)
        return widget
    
    def load_current_config(self):
        """Load current configuration values into the form"""
        # API settings
        self.api_base_url.setText(config_manager.get('api.base_url', ''))
        self.api_endpoint.setText(config_manager.get('api.endpoint', ''))
        self.api_timeout.setValue(config_manager.get('api.timeout', 10))
        self.use_query_params.setChecked(config_manager.get('api.use_query_params', False))
        self.use_cookies.setChecked(config_manager.get('api.use_cookies', False))
        self.access_token.setText(config_manager.get('api.cookies.access_token', ''))
        self.refresh_token.setText(config_manager.get('api.cookies.refresh_token', ''))
        
        # Detection settings
        self.detection_cooldown.setValue(config_manager.get('detection.cooldown', 5))
        self.cache_duration.setValue(config_manager.get('detection.cache_duration', 300))
        self.max_cameras.setValue(config_manager.get('detection.max_cameras', 10))
        self.min_detection_duration.setValue(config_manager.get('detection.min_detection_duration', 3.0))
        
        # UI settings
        self.window_width.setValue(config_manager.get('ui.window_width', 1400))
        self.window_height.setValue(config_manager.get('ui.window_height', 800))
        self.video_width.setValue(config_manager.get('ui.video_width', 640))
        self.video_height.setValue(config_manager.get('ui.video_height', 480))
        
        # Model settings
        self.lp_detector.setText(config_manager.get('models.lp_detector', ''))
        self.lp_ocr.setText(config_manager.get('models.lp_ocr', ''))
        self.confidence_threshold.setValue(config_manager.get('models.confidence_threshold', 0.60))
        
        # TTS settings
        self.tts_enabled.setChecked(config_manager.get('tts.enabled', True))
        self.tts_use_gtts.setChecked(config_manager.get('tts.use_gtts', True))
        self.tts_rate.setValue(config_manager.get('tts.rate', 150))
        self.tts_volume.setValue(config_manager.get('tts.volume', 0.8))
        self.tts_language.setCurrentText(config_manager.get('tts.language', 'vi'))
    
    def save_config(self):
        """Save configuration from form to config manager"""
        try:
            # API settings
            config_manager.set('api.base_url', self.api_base_url.text())
            config_manager.set('api.endpoint', self.api_endpoint.text())
            config_manager.set('api.timeout', self.api_timeout.value())
            config_manager.set('api.use_query_params', self.use_query_params.isChecked())
            config_manager.set('api.use_cookies', self.use_cookies.isChecked())
            config_manager.set('api.cookies.access_token', self.access_token.text())
            config_manager.set('api.cookies.refresh_token', self.refresh_token.text())
            
            # Detection settings
            config_manager.set('detection.cooldown', self.detection_cooldown.value())
            config_manager.set('detection.cache_duration', self.cache_duration.value())
            config_manager.set('detection.max_cameras', self.max_cameras.value())
            config_manager.set('detection.min_detection_duration', self.min_detection_duration.value())
            
            # UI settings
            config_manager.set('ui.window_width', self.window_width.value())
            config_manager.set('ui.window_height', self.window_height.value())
            config_manager.set('ui.video_width', self.video_width.value())
            config_manager.set('ui.video_height', self.video_height.value())
            
            # Model settings
            config_manager.set('models.lp_detector', self.lp_detector.text())
            config_manager.set('models.lp_ocr', self.lp_ocr.text())
            config_manager.set('models.confidence_threshold', self.confidence_threshold.value())
            
            # TTS settings
            config_manager.set('tts.enabled', self.tts_enabled.isChecked())
            config_manager.set('tts.use_gtts', self.tts_use_gtts.isChecked())
            config_manager.set('tts.rate', self.tts_rate.value())
            config_manager.set('tts.volume', self.tts_volume.value())
            config_manager.set('tts.language', self.tts_language.currentText())
            
            # Save to file
            if config_manager.save_config():
                QMessageBox.information(self, "Success", "Configuration saved successfully!")
                self.accept()
            else:
                QMessageBox.warning(self, "Error", "Failed to save configuration!")
                
        except Exception as e:
            QMessageBox.critical(self, "Error", f"Error saving configuration: {str(e)}")
    
    def reset_to_defaults(self):
        """Reset configuration to default values"""
        reply = QMessageBox.question(self, "Reset Configuration", 
                                   "Are you sure you want to reset all settings to default values?",
                                   QMessageBox.Yes | QMessageBox.No)
        
        if reply == QMessageBox.Yes:
            config_manager.config = config_manager.load_default_config()
            self.load_current_config()
            QMessageBox.information(self, "Reset Complete", "Configuration reset to default values.")
