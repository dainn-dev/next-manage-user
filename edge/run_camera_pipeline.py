#!/usr/bin/env python3
"""DAI-290 camera pipeline scaffold entry point.

This intentionally does not start inference, RTSP capture, persistence, or HTTP transport.
Use --dry-run to validate a local image profile safely, or --validate-runtime to report
future deployment prerequisites before later pipeline stages are installed.
"""

from __future__ import annotations

import argparse
from datetime import datetime, timedelta, timezone
import json
import logging
from pathlib import Path

import numpy as np
import sys

ROOT = Path(__file__).resolve().parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from edge.camera_config import ConfigValidationError, load_camera_pipeline_config
from edge.camera_processing_service import CameraProcessingService, configure_json_logging

CONFIG_ERROR = 2
RUNTIME_READINESS_ERROR = 3
UNSUPPORTED_MODE_ERROR = 4


def _bootstrap_log(level: str, stage: str, status: str, message: str) -> None:
    logging.getLogger("camera_pipeline").log(
        getattr(logging, level),
        json.dumps({
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": level,
            "service": "camera-pipeline",
            "stage": stage,
            "status": status,
            "message": message,
        }, sort_keys=True, separators=(",", ":")),
    )


def _synthetic_frames(mode: str, warmup_frames: int, debounce_frames: int,
                      cooldown_frames: int) -> list[np.ndarray]:
    """Build deterministic BGR frames for an offline motion-gate smoke check."""
    background = np.zeros((240, 320, 3), dtype=np.uint8)
    frames = [background.copy() for _ in range(warmup_frames)]
    if mode == "static":
        frames.extend(background.copy() for _ in range(max(5, debounce_frames + cooldown_frames + 1)))
        return frames

    for index in range(debounce_frames + 3):
        frame = background.copy()
        x = 20 + index * 30
        frame[90:130, x:x + 50] = (255, 255, 255)
        frames.append(frame)
    # Give MOG2 enough quiet samples to emit the inactive transition after active motion.
    frames.extend(background.copy() for _ in range(cooldown_frames + 12))
    return frames


def _run_synthetic_sequence(service: CameraProcessingService, mode: str) -> None:
    motion = service.config.thresholds.motion
    frames = _synthetic_frames(mode, motion.warmup_frames,
                               motion.min_consecutive_active_frames, motion.cooldown_frames)
    first_qualifying_frame = None
    activation_frame = None
    windows_opened = 0
    started_at = datetime.now(timezone.utc)
    interval = timedelta(milliseconds=service.config.pipeline.frame_interval_ms)
    for index, pixels in enumerate(frames):
        decision = service.process_frame(pixels, started_at + interval * index)
        if (first_qualifying_frame is None and decision.measurement.qualifies_as_motion
                and decision.previous_state.value != "warming_up"):
            first_qualifying_frame = decision.frame.frame_number
        if decision.motion_window is not None:
            windows_opened += 1
            activation_frame = decision.frame.frame_number
    service.log_motion_summary(
        mode=mode,
        frames_processed=len(frames),
        windows_opened=windows_opened,
        first_qualifying_frame=first_qualifying_frame,
        activation_frame=activation_frame,
    )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="DAI-290 camera pipeline scaffold")
    parser.add_argument("--config", required=True, help="Required JSON camera-pipeline profile")
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--dry-run", action="store_true",
                      help="Read one configured local image and log skipped future stages")
    mode.add_argument("--validate-runtime", action="store_true",
                      help="Validate future artifact, credential, and output prerequisites without side effects")
    mode.add_argument("--dry-run-sequence", choices=("static", "moving-vehicle"),
                      help="Run deterministic in-memory motion-gate frames without opening a source")
    args = parser.parse_args(argv)

    configure_json_logging("INFO")
    try:
        config = load_camera_pipeline_config(args.config)
    except ConfigValidationError as exc:
        _bootstrap_log("ERROR", "configuration", "failed", str(exc))
        return CONFIG_ERROR

    service = CameraProcessingService(config, configure_json_logging(config.logging.level))
    try:
        if args.dry_run:
            service.dry_run()
            return 0
        if args.validate_runtime:
            service.validate_runtime()
            return 0
        if args.dry_run_sequence:
            _run_synthetic_sequence(service, args.dry_run_sequence)
            return 0
    except ConfigValidationError as exc:
        _bootstrap_log("ERROR", "configuration", "failed", str(exc))
        return RUNTIME_READINESS_ERROR

    _bootstrap_log("ERROR", "configuration", "failed", "unsupported execution mode")
    return UNSUPPORTED_MODE_ERROR


if __name__ == "__main__":
    raise SystemExit(main())
