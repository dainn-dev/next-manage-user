#!/usr/bin/env python3
"""Headless Detection Edge Service launcher (Phase 3.3).

Runs the license-plate detection pipeline as a service with no GUI: it reads an
RTSP stream, self-registers as a gate, heartbeats, and POSTs confirmed plates to
the backend check-vehicle endpoint tagged with its gateId.

Usage:
    python run_edge.py                      # run the live RTSP service
    python run_edge.py --config other.json  # use a different config file
    python run_edge.py --image test.jpg     # one-shot: detect + send from an image
    python run_edge.py --register-only      # register + heartbeat once, then exit

Configuration lives in config.json (see config.example.json, section "gate").
The gate key is read from api.gate_key or the GATE_API_KEY environment variable.
"""

import argparse
import os
import sys

# Make sibling modules (config_manager, function/, edge/) importable regardless
# of the current working directory.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


def main():
    parser = argparse.ArgumentParser(description="Headless license-plate detection edge service")
    parser.add_argument("--config", default=None,
                        help="Path to a config.json (default: ./config.json)")
    parser.add_argument("--image", default=None,
                        help="Run one-shot detection on an image file and exit")
    parser.add_argument("--register-only", action="store_true",
                        help="Register the gate and send a single heartbeat, then exit")
    parser.add_argument("--camera-pipeline-config", default=None,
                        help="Run the lpr-mvp-v1 file/RTSP pipeline using this JSON profile")
    args = parser.parse_args()

    if args.camera_pipeline_config:
        from run_camera_pipeline import main as run_camera_pipeline
        return run_camera_pipeline([
            "--config", args.camera_pipeline_config,
            "--run-camera",
        ])

    # Allow overriding the config file before the singleton is heavily used.
    import config_manager as config_module
    if args.config:
        config_module.config_manager = config_module.ConfigManager(args.config)
    config = config_module.config_manager

    from edge.edge_service import EdgeService
    service = EdgeService(config)

    if args.image:
        return service.process_image(args.image)

    if args.register_only:
        gate_id = service.register()
        if not gate_id:
            print("Registration failed.")
            return 1
        ok = service.client.heartbeat(gate_id)
        print(f"Heartbeat {'succeeded' if ok else 'failed'} for gate {gate_id}")
        return 0 if ok else 1

    return service.run()


if __name__ == "__main__":
    sys.exit(main())
