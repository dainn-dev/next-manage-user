"""Configured file/RTSP runtime checks for the production LPR pipeline."""

from __future__ import annotations

from pathlib import Path
from types import SimpleNamespace
import sys
import threading

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from edge.camera_config import CameraSourceConfig
from edge.camera_runtime import camera_source_location, run_camera_source


class _Capture:
    def __init__(self, frames=(), opened=True):
        self.frames = iter(frames)
        self.opened = opened
        self.released = False

    def isOpened(self):
        return self.opened

    def read(self):
        try:
            return True, next(self.frames)
        except StopIteration:
            return False, None

    def release(self):
        self.released = True


class _Service:
    def __init__(self):
        self.config = SimpleNamespace(
            pipeline=SimpleNamespace(frame_interval_ms=200))
        self.frames = []
        self.logs = []
        self.flushes = 0

    def process_frame(self, frame, captured_at):
        self.frames.append(frame)

    def flush_ingest_queue(self):
        self.flushes += 1

    def _log(self, stage, status, message, **fields):
        self.logs.append((stage, status, message, fields))


def test_rtsp_credentials_are_encoded_without_changing_the_public_config() -> None:
    source = CameraSourceConfig(
        "rtsp", "rtsp://camera.local:8554/live?channel=1", "edge user", "p@ss/word")
    location = camera_source_location(source)
    assert location == (
        "rtsp://edge%20user:p%40ss%2Fword@camera.local:8554/live?channel=1")
    assert source.location == "rtsp://camera.local:8554/live?channel=1"


def test_rtsp_runtime_reconnects_and_processes_bounded_frames() -> None:
    frame = np.zeros((20, 30, 3), dtype=np.uint8)
    captures = [_Capture(opened=False), _Capture([frame, frame])]
    opened = []

    def factory(location, backend):
        opened.append((location, backend))
        return captures.pop(0)

    service = _Service()
    processed = run_camera_source(
        service,
        CameraSourceConfig("rtsp", "rtsp://camera.local/live", "", ""),
        max_frames=2,
        reconnect_seconds=0,
        stop_event=threading.Event(),
        capture_factory=factory,
        monotonic=iter((0.0, 1.0)).__next__,
    )

    assert processed == 2
    assert len(opened) == 2
    assert service.flushes == 1
    assert len(service.frames) == 2
    assert any(status == "reconnecting" for _, status, _, _ in service.logs)


def run() -> None:
    tests = (
        test_rtsp_credentials_are_encoded_without_changing_the_public_config,
        test_rtsp_runtime_reconnects_and_processes_bounded_frames,
    )
    for test in tests:
        test()
        print(f"  ok: {test.__name__}")
    print("\nAll configured camera runtime checks passed.")


if __name__ == "__main__":
    run()
