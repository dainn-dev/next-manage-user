#!/usr/bin/env python3
"""Bounded, reproducible camera-ingest workload runner for pilot capacity evidence."""

from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
import json
import math
import os
from pathlib import Path
import random
import time
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from uuid import uuid4


class LoadTestError(RuntimeError):
    pass


def percentile(values: list[float], fraction: float) -> float | None:
    if not values:
        return None
    ordered = sorted(values)
    return ordered[max(0, min(len(ordered) - 1, math.ceil(len(ordered) * fraction) - 1))]


def _read_json(path: Path) -> dict:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise LoadTestError(f"cannot read manifest: {exc}") from exc
    if not isinstance(value, dict):
        raise LoadTestError("manifest must be an object")
    return value


def _post(url: str, camera: dict, event_id: str, timeout: float) -> dict:
    secret = os.environ.get(str(camera["keyEnv"]))
    if not secret:
        raise LoadTestError(f"environment variable {camera['keyEnv']} is not set")
    body = json.dumps({
        "eventId": event_id,
        "cameraId": camera["id"],
        "eventType": "VehicleDetected",
        "occurredAt": datetime.now(timezone.utc).isoformat(),
        "payload": {"source": "dai-314-load-test"},
    }).encode()
    request = Request(url, data=body, method="POST", headers={
        "Content-Type": "application/json", "X-Camera-Id": str(camera["id"]),
        "X-Camera-Key": secret,
    })
    started = time.perf_counter()
    try:
        with urlopen(request, timeout=timeout) as response:
            response.read()
            status, error = response.status, None
    except HTTPError as exc:
        status, error = exc.code, str(exc)
    except (URLError, TimeoutError, OSError) as exc:
        status, error = 0, str(exc)
    return {"eventId": event_id, "status": status,
            "latencyMs": (time.perf_counter() - started) * 1000, "error": error}


def evaluate(results: list[dict], elapsed: float, unique_events: int, slos: dict) -> dict:
    latencies = [float(item["latencyMs"]) for item in results]
    errors = sum(not (200 <= int(item["status"]) < 300) for item in results)
    throughput = len(results) / elapsed if elapsed else 0.0
    error_rate = errors / len(results) if results else 1.0
    p95 = percentile(latencies, .95)
    acknowledged = {str(item["eventId"]) for item in results
                    if 200 <= int(item["status"]) < 300}
    checks = {
        "p95Latency": p95 is not None and p95 <= float(slos["p95LatencyMs"]),
        "errorRate": error_rate <= float(slos["maxErrorRate"]),
        "throughput": throughput >= float(slos["minThroughputPerSecond"]),
        "noUnexplainedLoss": len(acknowledged) == unique_events,
    }
    return {
        "attempts": len(results), "uniqueEvents": unique_events,
        "acknowledgedUniqueEvents": len(acknowledged), "errors": errors,
        "errorRate": error_rate, "throughputPerSecond": throughput,
        "latencyMs": {"p50": percentile(latencies, .50), "p95": p95,
                      "p99": percentile(latencies, .99), "max": max(latencies) if latencies else None},
        "statusCounts": {str(code): sum(item["status"] == code for item in results)
                         for code in sorted({item["status"] for item in results})},
        "checks": checks, "sloMet": all(checks.values()),
    }


def run(manifest_path: str | Path, output: str | Path | None = None) -> dict:
    path = Path(manifest_path).resolve()
    manifest = _read_json(path)
    cameras, workload, slos = manifest.get("cameras"), manifest.get("workload", {}), manifest.get("slos", {})
    if not isinstance(cameras, list) or not cameras:
        raise LoadTestError("at least one camera is required")
    for key in ("durationSeconds", "eventsPerSecond", "concurrency"):
        if float(workload.get(key, 0)) <= 0:
            raise LoadTestError(f"workload.{key} must be positive")
    for key in ("p95LatencyMs", "maxErrorRate", "minThroughputPerSecond"):
        if key not in slos:
            raise LoadTestError(f"slos.{key} is required")
    url = str(manifest["baseUrl"]).rstrip("/") + "/api/v1/parking-events"
    duration = float(workload["durationSeconds"])
    rate = float(workload["eventsPerSecond"])
    burst_rate = rate * float(workload.get("burstMultiplier", 1))
    burst_seconds = min(duration, float(workload.get("burstSeconds", 0)))
    burst_count = int(burst_rate * burst_seconds)
    sustained_count = int(rate * (duration - burst_seconds))
    unique_count = max(1, burst_count + sustained_count)
    event_ids = [str(uuid4()) for _ in range(unique_count)]
    duplicate_count = int(unique_count * float(workload.get("duplicateRate", 0)))
    schedule = [(index / burst_rate, event_ids[index]) for index in range(burst_count)]
    schedule.extend((burst_seconds + index / rate, event_ids[burst_count + index])
                    for index in range(sustained_count))
    if not schedule:
        schedule = [(0.0, event_ids[0])]
    duplicate_ids = random.Random(314).sample(event_ids, min(duplicate_count, unique_count))
    first_times = {event_id: offset for offset, event_id in schedule}
    schedule.extend((min(duration, first_times[event_id] + 0.001), event_id)
                    for event_id in duplicate_ids)
    schedule.sort()
    timeout = float(workload.get("requestTimeoutSeconds", 10))
    results = []
    started = time.perf_counter()
    with ThreadPoolExecutor(max_workers=int(workload["concurrency"])) as pool:
        futures = []
        for index, (offset, event_id) in enumerate(schedule):
            target = started + offset
            if target > time.perf_counter():
                time.sleep(target - time.perf_counter())
            futures.append(pool.submit(_post, url, cameras[index % len(cameras)], event_id, timeout))
        for future in as_completed(futures):
            results.append(future.result())
    elapsed = time.perf_counter() - started
    report = {
        "schemaVersion": 1, "generatedAt": datetime.now(timezone.utc).isoformat(),
        "workloadModel": {**workload, "cameraCount": len(cameras),
                          "dashboardUsers": manifest.get("dashboardUsers"),
                          "retentionDays": manifest.get("retentionDays")},
        "slos": slos, "observed": evaluate(results, elapsed, unique_count, slos),
        "elapsedSeconds": elapsed,
        "note": "Capacity is approved only when this report comes from pilot-equivalent infrastructure.",
    }
    destination = Path(output or manifest.get("outputJson", "reports/dai-314-load.json")).resolve()
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(report, indent=2, sort_keys=True), encoding="utf-8")
    report["outputJson"] = str(destination)
    return report


def main(argv=None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--output-json")
    parser.add_argument("--enforce-slos", action="store_true")
    args = parser.parse_args(argv)
    try:
        report = run(args.manifest, args.output_json)
    except LoadTestError as exc:
        print(f"load test failed: {exc}")
        return 2
    print(json.dumps({"outputJson": report["outputJson"], "sloMet": report["observed"]["sloMet"]}, indent=2))
    return 3 if args.enforce_slos and not report["observed"]["sloMet"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
