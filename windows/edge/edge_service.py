"""Edge service orchestrator.

Ties the pieces together into a headless, long-running service:

1. Register (upsert) this gate and remember the returned gate id.
2. Start a background heartbeat thread.
3. Open the configured RTSP stream, validate/drop bad frames, run detection on
   an interval, and POST confirmed plates to check-vehicle tagged with gateId.

Runs until interrupted (Ctrl+C / SIGTERM). No Qt, no windows.
"""

import signal
import threading
import time

import cv2
import numpy as np

from config_manager import config_manager

from .detection_core import DetectionCore
from .gate_client import GateClient


class EdgeService:
    def __init__(self, config=config_manager):
        self.config = config
        self.client = GateClient(config)
        self.gate_id = config.get_gate_id() or None
        self.panel_type = config.get_gate_panel_type()
        self.device_id = config.get_gate_device_id()

        self.detector = None
        self._stop = threading.Event()
        self._heartbeat_thread = None

        self.target_fps = self.config.get_rtsp_target_fps()
        self.frame_delay = max(0.001, 1.0 / self.target_fps)
        self.inference_interval = max(self.config.get_detection_frame_interval_ms() / 1000.0, 0)
        self._last_inference = 0.0

    # ----------------------------------------------------------- lifecycle
    def _install_signal_handlers(self):
        def _handler(signum, _frame):
            print(f"Received signal {signum}; shutting down ...")
            self.stop()
        for sig in (signal.SIGINT, signal.SIGTERM):
            try:
                signal.signal(sig, _handler)
            except (ValueError, OSError):
                # signal only works on the main thread; ignore elsewhere.
                pass

    def stop(self):
        self._stop.set()

    def register(self):
        gate_id = self.client.register()
        if gate_id:
            self.gate_id = gate_id
            if gate_id != self.config.get_gate_id():
                self.config.set_gate_id(gate_id)
        return gate_id

    def _heartbeat_loop(self):
        interval = self.config.get_gate_heartbeat_interval()
        while not self._stop.wait(interval):
            if not self.gate_id:
                continue
            if self.client.heartbeat(self.gate_id):
                print(f"Heartbeat OK for gate {self.gate_id}")
            else:
                # Gate may have been deleted server-side; try to re-register.
                print("Heartbeat failed; attempting re-registration ...")
                self.register()

    def start_heartbeat(self):
        self._heartbeat_thread = threading.Thread(
            target=self._heartbeat_loop, name="gate-heartbeat", daemon=True)
        self._heartbeat_thread.start()

    # -------------------------------------------------------------- frames
    def _validate_frame(self, frame):
        """Reject corrupted RTSP frames (black/white/flat), like the desktop app."""
        if frame is None or frame.shape[0] == 0 or frame.shape[1] == 0:
            return False
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY) if len(frame.shape) == 3 else frame
        mean = float(np.mean(gray))
        if mean < 5 or mean > 250:
            return False
        if float(np.std(gray)) < 2:
            return False
        return True

    def _open_capture(self, rtsp_url):
        cap = cv2.VideoCapture(rtsp_url, cv2.CAP_FFMPEG)
        cap.set(cv2.CAP_PROP_BUFFERSIZE, self.config.get_rtsp_buffer_size())
        cap.set(cv2.CAP_PROP_OPEN_TIMEOUT_MSEC,
                max(self.config.get_rtsp_connection_timeout(), 10000))
        cap.set(cv2.CAP_PROP_READ_TIMEOUT_MSEC,
                max(self.config.get_rtsp_read_timeout(), 5000))
        return cap

    # -------------------------------------------------------------- results
    def _handle_confirmed(self, plates):
        for lp in plates:
            print(f"Confirmed plate '{lp}' ({self.panel_type}) -> sending to backend")
            resp = self.client.check_vehicle(lp, self.panel_type, self.gate_id)
            tag = "OK" if resp.get("success") else "FAIL"
            print(f"  [{tag}] {resp.get('message')} approved={resp.get('approved')}")

    # ----------------------------------------------------------------- run
    def run(self):
        """Register, start heartbeat and run the RTSP detection loop (blocking)."""
        self._install_signal_handlers()

        if not self.register():
            print("Could not register gate; continuing without a gateId "
                  "(events will be untagged). Check gate.name / gate_key / backend.")

        self.detector = DetectionCore(self.config)
        if not self.detector.models_ready:
            print("ERROR: detection models failed to load; aborting.")
            return 1

        self.start_heartbeat()

        rtsp_url = self.config.build_rtsp_url(self.device_id)
        if not rtsp_url:
            print(f"ERROR: no RTSP URL for device '{self.device_id}' in config.")
            return 1

        print(f"Opening RTSP stream for device '{self.device_id}': {rtsp_url}")
        cap = self._open_capture(rtsp_url)
        if not cap.isOpened():
            print("ERROR: could not open RTSP stream.")
            return 1

        validate = self.config.get_rtsp_frame_validation()
        print("Edge service running. Press Ctrl+C to stop.")
        try:
            while not self._stop.is_set():
                ret, frame = cap.read()
                if not ret:
                    print("WARNING: failed to read frame; reconnecting in 2s ...")
                    cap.release()
                    if self._stop.wait(2):
                        break
                    cap = self._open_capture(rtsp_url)
                    continue

                if validate and not self._validate_frame(frame):
                    continue

                now = time.time()
                if self.inference_interval and (now - self._last_inference) < self.inference_interval:
                    time.sleep(self.frame_delay)
                    continue
                self._last_inference = now

                try:
                    confirmed = self.detector.process_frame(frame)
                except Exception as exc:  # keep the loop alive on inference errors
                    print(f"Detection error: {exc}")
                    confirmed = []
                if confirmed:
                    self._handle_confirmed(confirmed)

                time.sleep(self.frame_delay)
        finally:
            cap.release()
            self._stop.set()
            print("Edge service stopped.")
        return 0

    # ------------------------------------------------------------- testing
    def process_image(self, image_path):
        """One-shot helper: register, then run detection on a still image.

        Bypasses the min-detection-duration gate (a single frame can never span
        it) so a test image reliably produces a check-vehicle call. Useful for
        the Phase 3.3 acceptance test without a live camera.
        """
        self.register()
        self.detector = DetectionCore(self.config)
        if not self.detector.models_ready:
            print("ERROR: detection models failed to load.")
            return 1

        frame = cv2.imread(image_path)
        if frame is None:
            print(f"ERROR: could not read image '{image_path}'.")
            return 1

        plates = self.detector._read_plates(frame)
        if not plates:
            print("No plates detected in the test image.")
            return 0
        print(f"Detected plates: {sorted(plates)}")
        self._handle_confirmed(sorted(plates))
        return 0
