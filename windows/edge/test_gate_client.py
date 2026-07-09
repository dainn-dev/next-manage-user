"""Contract tests for :class:`GateClient.check_vehicle` (Phase 4.5).

Complements ``test_edge_resilience.py`` (which covers the store-and-forward queue
and eventId idempotency) by pinning down the *wire contract* the edge sends to the
backend's ``POST /api/vehicles/check-vehicle``:

* the ``X-Gate-Key`` auth header is present,
* a plain detection is sent as JSON with ``licensePlateNumber`` / ``type`` /
  ``gateId`` (and the Phase 4.3 ``eventId`` / ``occurredAt`` when supplied),
* a detection carrying a snapshot is sent as multipart (form fields + JPEG part)
  with the JSON ``Content-Type`` dropped so ``requests`` sets the boundary,
* a missing gate key omits the header (backend runs open in dev).

No camera, models or live backend: ``requests.post`` is faked at the module level.
Written so it runs both under pytest and as a plain script:
``python windows/edge/test_gate_client.py``.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import gate_client as gate_client_module
from gate_client import GateClient


class _FakeResponse:
    def __init__(self, status_code, body):
        self.status_code = status_code
        self._body = body
        self.text = str(body)

    def json(self):
        return self._body


class _CapturingBackend:
    """Records the kwargs of every POST and returns a canned 200 OK."""

    def __init__(self):
        self.calls = []

    def post(self, url, **kwargs):
        self.calls.append({"url": url, **kwargs})
        return _FakeResponse(200, {
            "approved": True,
            "message": "OK",
            "licensePlateNumber": (kwargs.get("json") or kwargs.get("data") or {})
                .get("licensePlateNumber"),
            "type": (kwargs.get("json") or kwargs.get("data") or {}).get("type"),
        })


class _StubConfig:
    """Minimal config surface used by GateClient.check_vehicle."""

    def __init__(self, gate_key="test-gate-key"):
        self._gate_key = gate_key

    def get_gate_key(self):
        return self._gate_key

    def get_api_url(self):
        return "http://localhost:8080/api/vehicles/check-vehicle"

    def get_api_timeout(self):
        return 5

    # Caching + rate limiting: disabled/neutral so every call hits the network.
    def get_cache_duration(self):
        return 0

    def get_connection_error_cache_duration(self):
        return 0

    def get_rate_limit_enabled(self):
        return False

    def get_rate_limit_max_requests(self):
        return 1000


def _install_backend(gate_key="test-gate-key"):
    backend = _CapturingBackend()
    gate_client_module.requests.post = backend.post  # monkeypatch the network
    client = GateClient(_StubConfig(gate_key))
    return backend, client


def test_json_check_sends_expected_body_and_gate_key_header():
    backend, client = _install_backend()

    client.check_vehicle(
        "51A-123.45", "entry", gate_id="gate-42",
        event_id="evt-1", occurred_at="2026-07-09T10:00:00+00:00")

    assert len(backend.calls) == 1, "exactly one POST is made"
    call = backend.calls[0]
    assert call["url"].endswith("/api/vehicles/check-vehicle")
    # Plain detection -> JSON body, no multipart.
    assert "files" not in call or call["files"] is None
    body = call["json"]
    assert body["licensePlateNumber"] == "51A-123.45"
    assert body["type"] == "entry"
    assert body["gateId"] == "gate-42"
    assert body["eventId"] == "evt-1"
    assert body["occurredAt"] == "2026-07-09T10:00:00+00:00"
    # Auth + JSON content type present.
    assert call["headers"]["X-Gate-Key"] == "test-gate-key"
    assert call["headers"]["Content-Type"] == "application/json"
    print("  ok: JSON check body + X-Gate-Key header are correct")


def test_snapshot_check_is_sent_as_multipart_without_json_content_type():
    backend, client = _install_backend()

    client.check_vehicle(
        "51B-678.90", "exit", gate_id="gate-7", snapshot=b"\xff\xd8jpegbytes",
        event_id="evt-2")

    call = backend.calls[0]
    # Multipart: form fields via data=, the JPEG via files=, boundary set by requests.
    assert call.get("json") is None, "snapshot request must not use a JSON body"
    assert call["data"]["licensePlateNumber"] == "51B-678.90"
    assert call["data"]["type"] == "exit"
    assert call["data"]["gateId"] == "gate-7"
    assert call["data"]["eventId"] == "evt-2"
    assert "snapshot" in call["files"]
    assert call["headers"]["X-Gate-Key"] == "test-gate-key"
    assert "Content-Type" not in call["headers"], (
        "multipart requests must let requests set the boundary Content-Type")
    print("  ok: snapshot check is multipart with no hand-set Content-Type")


def test_missing_gate_key_omits_the_header():
    backend, client = _install_backend(gate_key="")

    client.check_vehicle("51C-000.00", "entry", gate_id="gate-1")

    headers = backend.calls[0]["headers"]
    assert "X-Gate-Key" not in headers, "no header when the gate key is unset"
    print("  ok: missing gate key omits the X-Gate-Key header")


def run():
    for test in (
        test_json_check_sends_expected_body_and_gate_key_header,
        test_snapshot_check_is_sent_as_multipart_without_json_content_type,
        test_missing_gate_key_omits_the_header,
    ):
        test()
    print("\nAll gate_client contract checks passed.")


if __name__ == "__main__":
    run()
