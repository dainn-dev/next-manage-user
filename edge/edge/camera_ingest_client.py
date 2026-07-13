"""Authenticated, idempotent Camera Management ingest transport."""

from __future__ import annotations

from dataclasses import dataclass
import json
from pathlib import Path
import time
from typing import Callable, Protocol

import requests

from edge.camera_config import IngestConfig
from edge.camera_types import OutboundEvent


class CameraIngestError(RuntimeError):
    """Camera ingest transport configuration is not ready."""


@dataclass(frozen=True)
class IngestResult:
    delivered: bool
    retryable: bool
    dry_run: bool
    attempts: int
    status_code: int | None
    response: dict[str, object] | None = None
    error: str | None = None


class CameraIngestTransport(Protocol):
    def ensure_ready(self) -> None: ...

    def send(self, event: OutboundEvent,
             snapshot_path: Path | None = None) -> IngestResult: ...


class CameraIngestClient:
    """POST typed LPR events, retrying only failures that may succeed unchanged."""

    def __init__(self, config: IngestConfig, camera_id: str, *,
                 post: Callable[..., object] | None = None,
                 sleep: Callable[[float], None] = time.sleep):
        self.config = config
        self.camera_id = camera_id
        self._post = post or requests.post
        self._sleep = sleep

    def ensure_ready(self) -> None:
        if not self.config.dry_run and not self.config.camera_key.strip():
            raise CameraIngestError(
                "camera ingest key is required unless ingest.dry_run is enabled")

    def send(self, event: OutboundEvent,
             snapshot_path: Path | None = None) -> IngestResult:
        envelope = event.to_ingest_envelope()
        if self.config.dry_run:
            return IngestResult(
                delivered=False, retryable=False, dry_run=True, attempts=0,
                status_code=None, response=envelope)

        try:
            snapshot = snapshot_path.read_bytes() if snapshot_path is not None else None
        except OSError as exc:
            return IngestResult(
                delivered=False, retryable=False, dry_run=False, attempts=0,
                status_code=None, error=f"unable to read snapshot '{snapshot_path}': {exc}")

        headers = {
            "Accept": "application/json",
            "X-Camera-Id": self.camera_id,
            "X-Camera-Key": self.config.camera_key,
            "Idempotency-Key": str(event.event_id),
        }
        for attempt in range(1, self.config.max_attempts + 1):
            try:
                if snapshot is None:
                    response = self._post(
                        self.config.url, json=envelope,
                        headers={**headers, "Content-Type": "application/json"},
                        timeout=self.config.timeout_seconds,
                    )
                else:
                    files = {
                        "event": (None, json.dumps(envelope, separators=(",", ":")),
                                  "application/json"),
                        self.config.snapshot_part: (
                            snapshot_path.name if snapshot_path is not None else "plate.jpg",
                            snapshot, event.snapshot.content_type if event.snapshot else "image/jpeg"),
                    }
                    response = self._post(
                        self.config.url, files=files, headers=headers,
                        timeout=self.config.timeout_seconds,
                    )
            except requests.exceptions.RequestException as exc:
                if attempt < self.config.max_attempts:
                    self._sleep(self._backoff(attempt, None))
                    continue
                return IngestResult(
                    delivered=False, retryable=True, dry_run=False, attempts=attempt,
                    status_code=None, error=f"network error: {exc}")

            status = int(response.status_code)
            if status == 202:
                try:
                    body = response.json()
                except (TypeError, ValueError):
                    body = None
                if (isinstance(body, dict)
                        and body.get("eventId") == str(event.event_id)
                        and body.get("status") == "accepted"):
                    return IngestResult(
                        delivered=True, retryable=False, dry_run=False, attempts=attempt,
                        status_code=status, response=body)
                return IngestResult(
                    delivered=False, retryable=False, dry_run=False, attempts=attempt,
                    status_code=status, error="invalid 202 acknowledgement from ingest API")

            retryable = status in {408, 425, 429} or status >= 500
            if retryable and attempt < self.config.max_attempts:
                self._sleep(self._backoff(attempt, response))
                continue
            body_text = str(getattr(response, "text", ""))[:500]
            return IngestResult(
                delivered=False, retryable=retryable, dry_run=False, attempts=attempt,
                status_code=status,
                error=f"ingest API rejected event with HTTP {status}: {body_text}")

        raise AssertionError("unreachable ingest retry state")

    def _backoff(self, attempt: int, response: object | None) -> float:
        headers = getattr(response, "headers", {}) if response is not None else {}
        retry_after = headers.get("Retry-After") if hasattr(headers, "get") else None
        if retry_after is not None:
            try:
                return min(self.config.retry_max_seconds, max(0.0, float(retry_after)))
            except (TypeError, ValueError):
                pass
        return min(
            self.config.retry_max_seconds,
            self.config.retry_base_seconds * (2 ** (attempt - 1)),
        )
