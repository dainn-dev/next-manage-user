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
        self.setWindowTitle("Cài đặt cấu hình")
        self.setModal(True)
        self.setFixedSize(500, 600)
        self.setup_ui()
        self.load_current_config()
    
    def setup_ui(self):
        """Setup the configuration dialog UI"""
        layout = QVBoxLayout()
        
        # Create tab widget
        tab_widget = QTabWidget()
        
        # RTSP Devices Configuration Tab
        rtsp_tab = self.create_rtsp_tab()
        tab_widget.addTab(rtsp_tab, "Thiết bị RTSP")
        
        # RTSP Optimization Tab
        rtsp_opt_tab = self.create_rtsp_optimization_tab()
        tab_widget.addTab(rtsp_opt_tab, "Tối ưu RTSP")

        # API Configuration Tab
        api_tab = self.create_api_tab()
        tab_widget.addTab(api_tab, "Cài đặt API")
        
        # Detection Configuration Tab
        detection_tab = self.create_detection_tab()
        tab_widget.addTab(detection_tab, "Cài đặt phát hiện")
        
        # UI Configuration Tab
        ui_tab = self.create_ui_tab()
        tab_widget.addTab(ui_tab, "Cài đặt giao diện")
        
        # Models Configuration Tab
        models_tab = self.create_models_tab()
        tab_widget.addTab(models_tab, "Cài đặt mô hình")
        
        # TTS Configuration Tab
        tts_tab = self.create_tts_tab()
        tab_widget.addTab(tts_tab, "Cài đặt TTS")
        
        
        
        layout.addWidget(tab_widget)
        
        # Buttons
        button_layout = QHBoxLayout()
        
        self.save_btn = QPushButton("Lưu")
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
        
        self.cancel_btn = QPushButton("Hủy")
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
        
        self.reset_btn = QPushButton("Đặt lại mặc định")
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
        layout.addRow("URL API cơ sở:", self.api_base_url)
        
        # API Endpoint
        self.api_endpoint = QLineEdit()
        self.api_endpoint.setPlaceholderText("/api/vehicles/check-vehicle")
        layout.addRow("Điểm cuối API:", self.api_endpoint)
        
        # API Timeout
        self.api_timeout = QSpinBox()
        self.api_timeout.setRange(1, 60)
        self.api_timeout.setSuffix(" giây")
        layout.addRow("Thời gian chờ API:", self.api_timeout)
        
        # Use Query Parameters
        self.use_query_params = QCheckBox()
        self.use_query_params.setToolTip("Sử dụng tham số truy vấn thay vì tải JSON")
        layout.addRow("Sử dụng tham số truy vấn:", self.use_query_params)
        
        # Use Cookies
        self.use_cookies = QCheckBox()
        self.use_cookies.setToolTip("Bao gồm cookie xác thực trong yêu cầu")
        layout.addRow("Sử dụng Cookie:", self.use_cookies)
        
        # Access Token
        self.access_token = QLineEdit()
        self.access_token.setPlaceholderText("JWT access token")
        self.access_token.setEchoMode(QLineEdit.Password)
        layout.addRow("Token truy cập:", self.access_token)
        
        # Refresh Token
        self.refresh_token = QLineEdit()
        self.refresh_token.setPlaceholderText("JWT refresh token")
        self.refresh_token.setEchoMode(QLineEdit.Password)
        layout.addRow("Token làm mới:", self.refresh_token)
        
        widget.setLayout(layout)
        return widget
    
    def create_detection_tab(self):
        """Create detection configuration tab"""
        widget = QGroupBox()
        layout = QFormLayout()
        
        # Detection Cooldown
        self.detection_cooldown = QDoubleSpinBox()
        self.detection_cooldown.setRange(0.5, 60.0)
        self.detection_cooldown.setSingleStep(0.1)
        self.detection_cooldown.setDecimals(1)
        self.detection_cooldown.setSuffix(" giây")
        layout.addRow("Thời gian chờ phát hiện:", self.detection_cooldown)
        
        # Cache Duration
        self.cache_duration = QSpinBox()
        self.cache_duration.setRange(60, 86400)  # 1 minute to 24 hours
        self.cache_duration.setSuffix(" giây")
        layout.addRow("Thời gian lưu cache:", self.cache_duration)
        
        # Max Cameras
        self.max_cameras = QSpinBox()
        self.max_cameras.setRange(1, 20)
        layout.addRow("Số camera tối đa quét:", self.max_cameras)
        
        # Minimum Detection Duration
        self.min_detection_duration = QDoubleSpinBox()
        self.min_detection_duration.setRange(1.0, 10.0)
        self.min_detection_duration.setSingleStep(0.5)
        self.min_detection_duration.setSuffix(" giây")
        self.min_detection_duration.setDecimals(1)
        layout.addRow("Thời gian phát hiện tối thiểu:", self.min_detection_duration)
        
        # Frame interval between detections (ms)
        self.detection_frame_interval = QSpinBox()
        self.detection_frame_interval.setRange(0, 1000)
        self.detection_frame_interval.setSingleStep(10)
        self.detection_frame_interval.setSuffix(" ms")
        layout.addRow("Khoảng thời gian giữa lần suy luận:", self.detection_frame_interval)

        # OCR fallback settings
        self.ocr_fallback_enabled = QCheckBox()
        layout.addRow("Bật OCR dự phòng:", self.ocr_fallback_enabled)

        self.ocr_fallback_method = QComboBox()
        self.ocr_fallback_method.addItems(["tesseract", "easyocr"])
        layout.addRow("Phương pháp OCR dự phòng:", self.ocr_fallback_method)

        self.ocr_tesseract_cmd = QLineEdit()
        self.ocr_tesseract_cmd.setPlaceholderText("C:\\Program Files\\Tesseract-OCR\\tesseract.exe")
        layout.addRow("Đường dẫn Tesseract:", self.ocr_tesseract_cmd)

        self.ocr_easyocr_languages = QLineEdit()
        self.ocr_easyocr_languages.setPlaceholderText("en,vi")
        layout.addRow("Ngôn ngữ EasyOCR:", self.ocr_easyocr_languages)

        self.ocr_easyocr_gpu = QCheckBox()
        layout.addRow("EasyOCR sử dụng GPU:", self.ocr_easyocr_gpu)

        self.ocr_easyocr_min_conf = QDoubleSpinBox()
        self.ocr_easyocr_min_conf.setRange(0.0, 1.0)
        self.ocr_easyocr_min_conf.setDecimals(2)
        self.ocr_easyocr_min_conf.setSingleStep(0.05)
        layout.addRow("Ngưỡng tin cậy EasyOCR:", self.ocr_easyocr_min_conf)

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
        layout.addRow("Kích thước cửa sổ:", window_layout)
        
        # Video Size
        video_layout = QHBoxLayout()
        self.video_width = QSpinBox()
        self.video_width.setRange(320, 1920)
        self.video_height = QSpinBox()
        self.video_height.setRange(240, 1080)
        video_layout.addWidget(self.video_width)
        video_layout.addWidget(QLabel("x"))
        video_layout.addWidget(self.video_height)
        layout.addRow("Kích thước hiển thị video:", video_layout)
        
        widget.setLayout(layout)
        return widget
    
    def create_models_tab(self):
        """Create models configuration tab"""
        widget = QGroupBox()
        layout = QFormLayout()
        
        # LP Detector Model
        self.lp_detector = QLineEdit()
        self.lp_detector.setPlaceholderText("model/LP_detector_nano_61.pt")
        layout.addRow("Mô hình phát hiện biển số:", self.lp_detector)
        
        # LP OCR Model
        self.lp_ocr = QLineEdit()
        self.lp_ocr.setPlaceholderText("model/LP_ocr_nano_62.pt")
        layout.addRow("Mô hình OCR biển số:", self.lp_ocr)
        
        # Confidence Threshold
        self.confidence_threshold = QDoubleSpinBox()
        self.confidence_threshold.setRange(0.1, 1.0)
        self.confidence_threshold.setSingleStep(0.05)
        self.confidence_threshold.setDecimals(2)
        layout.addRow("Ngưỡng tin cậy:", self.confidence_threshold)
        
        widget.setLayout(layout)
        return widget
    
    def create_tts_tab(self):
        """Create TTS configuration tab"""
        widget = QGroupBox()
        layout = QFormLayout()
        
        # TTS Enabled
        self.tts_enabled = QCheckBox()
        layout.addRow("Bật TTS:", self.tts_enabled)
        
        # Use Google TTS
        self.tts_use_gtts = QCheckBox()
        layout.addRow("Sử dụng Google TTS:", self.tts_use_gtts)
        
        # TTS Rate
        self.tts_rate = QSpinBox()
        self.tts_rate.setRange(50, 300)
        self.tts_rate.setSuffix(" từ/phút")
        layout.addRow("Tốc độ nói:", self.tts_rate)
        
        # TTS Volume
        self.tts_volume = QDoubleSpinBox()
        self.tts_volume.setRange(0.0, 1.0)
        self.tts_volume.setSingleStep(0.1)
        self.tts_volume.setDecimals(1)
        layout.addRow("Âm lượng:", self.tts_volume)
        
        # TTS Language
        self.tts_language = QComboBox()
        self.tts_language.addItems(["vi", "en", "zh", "ja", "ko"])
        layout.addRow("Ngôn ngữ:", self.tts_language)
        
        widget.setLayout(layout)
        return widget
    
    def create_rtsp_tab(self):
        """Create RTSP devices configuration tab"""
        widget = QGroupBox()
        layout = QVBoxLayout()
        
        # Device 1 Configuration
        device1_group = QGroupBox("Thiết bị RTSP 1")
        device1_layout = QFormLayout()
        
        self.rtsp_device1_enabled = QCheckBox()
        device1_layout.addRow("Bật:", self.rtsp_device1_enabled)
        
        self.rtsp_device1_name = QLineEdit()
        self.rtsp_device1_name.setPlaceholderText("Thiết bị RTSP 1")
        device1_layout.addRow("Tên thiết bị:", self.rtsp_device1_name)
        
        self.rtsp_device1_url = QLineEdit()
        self.rtsp_device1_url.setPlaceholderText("rtsp://username:password@192.168.1.100:554/stream1")
        device1_layout.addRow("URL RTSP:", self.rtsp_device1_url)
        
        device1_group.setLayout(device1_layout)
        layout.addWidget(device1_group)
        
        # Device 2 Configuration
        device2_group = QGroupBox("Thiết bị RTSP 2")
        device2_layout = QFormLayout()
        
        self.rtsp_device2_enabled = QCheckBox()
        device2_layout.addRow("Bật:", self.rtsp_device2_enabled)
        
        self.rtsp_device2_name = QLineEdit()
        self.rtsp_device2_name.setPlaceholderText("Thiết bị RTSP 2")
        device2_layout.addRow("Tên thiết bị:", self.rtsp_device2_name)
        
        self.rtsp_device2_url = QLineEdit()
        self.rtsp_device2_url.setPlaceholderText("rtsp://username:password@192.168.1.101:554/stream1")
        device2_layout.addRow("URL RTSP:", self.rtsp_device2_url)
        
        device2_group.setLayout(device2_layout)
        layout.addWidget(device2_group)
        
        widget.setLayout(layout)
        return widget
    
    def create_rtsp_optimization_tab(self):
        """Create RTSP optimization configuration tab"""
        widget = QGroupBox()
        layout = QFormLayout()
        
        # Buffer Size
        self.rtsp_buffer_size = QSpinBox()
        self.rtsp_buffer_size.setRange(1, 10)
        self.rtsp_buffer_size.setValue(1)
        self.rtsp_buffer_size.setToolTip("Giá trị thấp giảm độ trễ nhưng có thể gây mất khung hình")
        layout.addRow("Kích thước bộ đệm:", self.rtsp_buffer_size)
        
        # Drop Frames
        self.rtsp_drop_frames = QCheckBox()
        self.rtsp_drop_frames.setToolTip("Bỏ qua khung hình để duy trì độ trễ thấp")
        layout.addRow("Bỏ qua khung hình cho độ trễ thấp:", self.rtsp_drop_frames)
        
        # Low Latency Mode
        self.rtsp_low_latency = QCheckBox()
        self.rtsp_low_latency.setToolTip("Bật tối ưu hóa độ trễ thấp")
        layout.addRow("Chế độ độ trễ thấp:", self.rtsp_low_latency)
        
        # TCP Transport
        self.rtsp_tcp_transport = QCheckBox()
        self.rtsp_tcp_transport.setToolTip("Sử dụng TCP thay vì UDP để đáng tin cậy hơn nhưng có thể tăng độ trễ")
        layout.addRow("Sử dụng vận chuyển TCP:", self.rtsp_tcp_transport)
        
        # Connection Timeout
        self.rtsp_connection_timeout = QSpinBox()
        self.rtsp_connection_timeout.setRange(1000, 30000)
        self.rtsp_connection_timeout.setSuffix(" ms")
        self.rtsp_connection_timeout.setValue(5000)
        self.rtsp_connection_timeout.setToolTip("Thời gian chờ để thiết lập kết nối RTSP")
        layout.addRow("Thời gian chờ kết nối:", self.rtsp_connection_timeout)
        
        # Read Timeout
        self.rtsp_read_timeout = QSpinBox()
        self.rtsp_read_timeout.setRange(100, 10000)
        self.rtsp_read_timeout.setSuffix(" ms")
        self.rtsp_read_timeout.setValue(1000)
        self.rtsp_read_timeout.setToolTip("Thời gian chờ để đọc khung hình từ luồng RTSP")
        layout.addRow("Thời gian chờ đọc:", self.rtsp_read_timeout)
        
        # Frame Skip Threshold
        self.rtsp_frame_skip_threshold = QSpinBox()
        self.rtsp_frame_skip_threshold.setRange(1, 10)
        self.rtsp_frame_skip_threshold.setValue(3)
        self.rtsp_frame_skip_threshold.setToolTip("Số khung hình cần bỏ qua khi bộ đệm đang tích lũy")
        layout.addRow("Ngưỡng bỏ qua khung hình:", self.rtsp_frame_skip_threshold)
        
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
        self.detection_frame_interval.setValue(config_manager.get('detection.frame_interval_ms', 200))
        self.ocr_fallback_enabled.setChecked(config_manager.get('ocr.fallback_enabled', True))
        fallback_method = config_manager.get('ocr.fallback_method', 'tesseract').lower()
        if fallback_method not in ["tesseract", "easyocr"]:
            fallback_method = "tesseract"
        self.ocr_fallback_method.setCurrentText(fallback_method)
        self.ocr_tesseract_cmd.setText(config_manager.get('ocr.tesseract_cmd', ''))
        languages = config_manager.get('ocr.easyocr_languages', ['en', 'vi'])
        if isinstance(languages, list):
            languages_text = ",".join(languages)
        else:
            languages_text = str(languages)
        self.ocr_easyocr_languages.setText(languages_text)
        self.ocr_easyocr_gpu.setChecked(config_manager.get('ocr.easyocr_gpu', False))
        self.ocr_easyocr_min_conf.setValue(config_manager.get('ocr.easyocr_min_confidence', 0.4))
        
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
        
        # RTSP Device 1 settings
        self.rtsp_device1_enabled.setChecked(config_manager.get('rtsp_devices.device_1.enabled', False))
        self.rtsp_device1_name.setText(config_manager.get('rtsp_devices.device_1.name', ''))
        self.rtsp_device1_url.setText(config_manager.get('rtsp_devices.device_1.url', ''))
        
        # RTSP Device 2 settings
        self.rtsp_device2_enabled.setChecked(config_manager.get('rtsp_devices.device_2.enabled', False))
        self.rtsp_device2_name.setText(config_manager.get('rtsp_devices.device_2.name', ''))
        self.rtsp_device2_url.setText(config_manager.get('rtsp_devices.device_2.url', ''))
        
        # RTSP Optimization settings
        self.rtsp_buffer_size.setValue(config_manager.get('rtsp_optimization.buffer_size', 1))
        self.rtsp_drop_frames.setChecked(config_manager.get('rtsp_optimization.drop_frames', True))
        self.rtsp_low_latency.setChecked(config_manager.get('rtsp_optimization.low_latency', True))
        self.rtsp_tcp_transport.setChecked(config_manager.get('rtsp_optimization.tcp_transport', False))
        self.rtsp_connection_timeout.setValue(config_manager.get('rtsp_optimization.connection_timeout', 5000))
        self.rtsp_read_timeout.setValue(config_manager.get('rtsp_optimization.read_timeout', 1000))
        self.rtsp_frame_skip_threshold.setValue(config_manager.get('rtsp_optimization.frame_skip_threshold', 3))
    
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
            config_manager.set('detection.frame_interval_ms', self.detection_frame_interval.value())
            config_manager.set('ocr.fallback_enabled', self.ocr_fallback_enabled.isChecked())
            config_manager.set('ocr.fallback_method', self.ocr_fallback_method.currentText().lower())
            config_manager.set('ocr.tesseract_cmd', self.ocr_tesseract_cmd.text())
            languages_text = self.ocr_easyocr_languages.text()
            languages = [lang.strip() for lang in languages_text.split(',') if lang.strip()]
            config_manager.set('ocr.easyocr_languages', languages or ['en'])
            config_manager.set('ocr.easyocr_gpu', self.ocr_easyocr_gpu.isChecked())
            config_manager.set('ocr.easyocr_min_confidence', self.ocr_easyocr_min_conf.value())
            
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
            
            # RTSP Device 1 settings
            config_manager.set('rtsp_devices.device_1.enabled', self.rtsp_device1_enabled.isChecked())
            config_manager.set('rtsp_devices.device_1.name', self.rtsp_device1_name.text())
            config_manager.set('rtsp_devices.device_1.url', self.rtsp_device1_url.text())
            
            # RTSP Device 2 settings
            config_manager.set('rtsp_devices.device_2.enabled', self.rtsp_device2_enabled.isChecked())
            config_manager.set('rtsp_devices.device_2.name', self.rtsp_device2_name.text())
            config_manager.set('rtsp_devices.device_2.url', self.rtsp_device2_url.text())
            
            # RTSP Optimization settings
            config_manager.set('rtsp_optimization.buffer_size', self.rtsp_buffer_size.value())
            config_manager.set('rtsp_optimization.drop_frames', self.rtsp_drop_frames.isChecked())
            config_manager.set('rtsp_optimization.low_latency', self.rtsp_low_latency.isChecked())
            config_manager.set('rtsp_optimization.tcp_transport', self.rtsp_tcp_transport.isChecked())
            config_manager.set('rtsp_optimization.connection_timeout', self.rtsp_connection_timeout.value())
            config_manager.set('rtsp_optimization.read_timeout', self.rtsp_read_timeout.value())
            config_manager.set('rtsp_optimization.frame_skip_threshold', self.rtsp_frame_skip_threshold.value())
            
            # Save to file
            if config_manager.save_config():
                QMessageBox.information(self, "Thành công", "Đã lưu cấu hình thành công!")
                self.accept()
            else:
                QMessageBox.warning(self, "Lỗi", "Không thể lưu cấu hình!")
                
        except Exception as e:
            QMessageBox.critical(self, "Lỗi", f"Lỗi khi lưu cấu hình: {str(e)}")
    
    def reset_to_defaults(self):
        """Reset configuration to default values"""
        reply = QMessageBox.question(self, "Đặt lại cấu hình", 
                                   "Bạn có chắc chắn muốn đặt lại tất cả cài đặt về giá trị mặc định?",
                                   QMessageBox.Yes | QMessageBox.No)
        
        if reply == QMessageBox.Yes:
            config_manager.config = config_manager.load_default_config()
            self.load_current_config()
            QMessageBox.information(self, "Hoàn thành đặt lại", "Đã đặt lại cấu hình về giá trị mặc định.")
