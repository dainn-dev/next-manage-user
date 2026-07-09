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
import uuid
from datetime import datetime, timezone

import cv2
import numpy as np

from config_manager import config_manager

from .detection_core import DetectionCore
from .event_queue import EventQueue
from .gate_client import GateClient


def _utcnow_iso():
    """ISO-8601 UTC timestamp (e.g. ``2026-07-09T10:20:30.123456+00:00``)."""
    return datetime.now(timezone.utc).isoformat()


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
        self._queue_thread = None

        # Store-and-forward queue: confirmed events that could not be delivered
        # are persisted here and re-sent by the retry worker (Phase 4.3).
        self.queue = None
        if self.config.get_queue_enabled():
            try:
                self.queue = EventQueue(self.config.get_queue_path(),
                                        max_events=self.config.get_queue_max_events())
            except Exception as exc:
                print(f"WARNING: could not open store-and-forward queue "
                      f"({self.config.get_queue_path()}): {exc}. Events will be "
                      f"dropped if the backend is unreachable.")
                self.queue = None

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
        """Heartbeat with exponential backoff while the backend is unreachable.

        On success the interval resets to the configured base; on failure it
        doubles (capped) so a downed backend is probed with increasing spacing
        instead of being spammed every ``heartbeat_interval`` seconds. A single
        re-registration attempt is made per failed cycle (the gate may have been
        deleted server-side), and it inherits the same backoff spacing.
        """
        base = self.config.get_gate_heartbeat_interval()
        max_backoff = self.config.get_heartbeat_backoff_max()
        interval = base
        while not self._stop.wait(interval):
            if not self.gate_id:
                interval = base
                continue
            if self.client.heartbeat(self.gate_id):
                if interval != base:
                    print(f"Heartbeat recovered for gate {self.gate_id}; "
                          f"interval back to {base}s")
                interval = base
            else:
                interval = min(max_backoff, max(base, int(interval * 2)))
                print(f"Heartbeat failed; re-registering and backing off to {interval}s ...")
                self.register()

    def start_heartbeat(self):
        self._heartbeat_thread = threading.Thread(
            target=self._heartbeat_loop, name="gate-heartbeat", daemon=True)
        self._heartbeat_thread.start()

    # ----------------------------------------------------- store-and-forward
    def _backoff_delay(self, attempts):
        """Exponential backoff for a queued event: base * 2^(attempts-1), capped."""
        base = self.config.get_queue_retry_base_seconds()
        cap = self.config.get_queue_retry_max_seconds()
        return min(cap, base * (2 ** max(0, attempts - 1)))

    def _flush_queue_once(self):
        """Try to deliver every currently-due queued event.

        Delivered events are removed; permanently-rejected ones are dropped with
        a log line; transient failures are rescheduled with backoff. If the
        backend is still unreachable we stop early so we don't march the whole
        backlog through guaranteed-to-fail network calls in one pass.
        """
        if self.queue is None:
            return
        due = self.queue.due_events(limit=self.config.get_queue_batch_size())
        if not due:
            return
        now = time.time()
        for item in due:
            if self._stop.is_set():
                return
            event = item["event"]
            result = self.client.send_check_event(event)
            if result["delivered"]:
                self.queue.delete(item["id"])
                resp = result["response"]
                print(f"  [FLUSHED] {event['license_plate']} ({event['panel_type']}) "
                      f"approved={resp.get('approved')} — queue depth={self.queue.count()}")
            elif not result["retriable"]:
                self.queue.delete(item["id"])
                print(f"  [DROP] permanent failure for {event['license_plate']}: "
                      f"{result['response'].get('message')}")
            else:
                attempts = item["attempts"] + 1
                self.queue.mark_attempt(item["id"], now + self._backoff_delay(attempts))
                # Backend still down — retry the rest on the next poll.
                if result["response"].get("connection_error"):
                    break

    def _queue_worker(self):
        poll = self.config.get_queue_poll_interval()
        while not self._stop.wait(poll):
            try:
                self._flush_queue_once()
            except Exception as exc:  # never let the worker die on a transient error
                print(f"WARNING: queue worker error: {exc}")

    def start_queue_worker(self):
        if self.queue is None:
            return
        depth = self.queue.count()
        if depth:
            print(f"Store-and-forward queue has {depth} pending event(s) to flush.")
        self._queue_thread = threading.Thread(
            target=self._queue_worker, name="gate-queue", daemon=True)
        self._queue_thread.start()

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
    def _encode_snapshot(self, crop):
        """Encode a cropped plate image (BGR numpy array) to JPEG bytes, downscaled
        to the configured max width. Returns None if there is nothing to encode."""
        if crop is None or getattr(crop, "size", 0) == 0:
            return None
        try:
            max_w = self.config.get_gate_snapshot_max_width()
            h, w = crop.shape[:2]
            if max_w and w > max_w:
                scale = max_w / float(w)
                crop = cv2.resize(crop, (max_w, max(1, int(h * scale))))
            quality = self.config.get_gate_snapshot_jpeg_quality()
            ok, buf = cv2.imencode(".jpg", crop, [int(cv2.IMWRITE_JPEG_QUALITY), quality])
            if not ok:
                return None
            return buf.tobytes()
        except Exception as exc:
            print(f"WARNING: failed to encode snapshot for evidence: {exc}")
            return None

    def _handle_confirmed(self, plates):
        send_snapshot = self.config.get_gate_send_snapshot()
        for lp in plates:
            print(f"Confirmed plate '{lp}' ({self.panel_type}) -> sending to backend")
            snapshot = None
            if send_snapshot and self.detector is not None:
                snapshot = self._encode_snapshot(self.detector.get_last_crop(lp))

            # Each confirmed detection gets a stable client event id + true event
            # time so a store-and-forward retry is deduplicated by the backend and
            # logged at the moment it happened, not when it was finally delivered.
            event = {
                "event_id": str(uuid.uuid4()),
                "license_plate": lp,
                "panel_type": self.panel_type,
                "gate_id": self.gate_id,
                "occurred_at": _utcnow_iso(),
                "snapshot": snapshot,
            }
            snap_tag = " +snapshot" if snapshot else ""
            result = self.client.send_check_event(event)
            if result["delivered"]:
                resp = result["response"]
                print(f"  [OK]{snap_tag} {resp.get('message')} approved={resp.get('approved')}")
            elif result["retriable"] and self.queue is not None:
                self.queue.enqueue(event)
                print(f"  [QUEUED]{snap_tag} backend unreachable "
                      f"({result['response'].get('message')}); stored for retry "
                      f"— queue depth={self.queue.count()}")
            else:
                # No queue configured, or a permanent rejection: nothing to retry.
                print(f"  [FAIL]{snap_tag} {result['response'].get('message')} "
                      f"(retriable={result['retriable']}, queued=no)")

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
        self.start_queue_worker()

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
