"""Store-and-forward resilience tests for the edge (Phase 4.3).

Runs without a camera, detection models or a live backend: it fakes the backend
at the ``requests`` layer and drives :class:`EventQueue` + :class:`GateClient`
directly. Exercises the three acceptance scenarios:

1. Backend down  -> confirmed events land in the persistent queue (nothing lost).
2. Backend up    -> the worker drains the queue; every event is delivered once,
                    with its ORIGINAL timestamp; the queue ends empty.
3. Same event id retried twice -> the backend records a single logical event.

Run:  python windows/edge/test_edge_resilience.py
"""

import os
import sys
import tempfile
import uuid

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import gate_client as gate_client_module
from event_queue import EventQueue
from gate_client import GateClient


class _FakeResponse:
    def __init__(self, status_code, body):
        self.status_code = status_code
        self._body = body
        self.text = str(body)

    def json(self):
        return self._body


class FakeBackend:
    """A toggleable backend that also deduplicates by eventId (mirrors the Java
    ``GateEventDeduplicator``) so we can assert client-side idempotency."""

    def __init__(self):
        self.up = True
        self.logs = []              # one entry per *processed* (deduped) event
        self.requests_seen = 0      # every POST that reached us while up
        self._seen_event_ids = {}   # eventId -> response body

    def post(self, url, **kwargs):
        self.requests_seen += 1
        if not self.up:
            raise gate_client_module.requests.exceptions.ConnectionError("backend down")

        # Body arrives as JSON (json=) or form fields (data=) for multipart.
        payload = kwargs.get("json") or kwargs.get("data") or {}
        event_id = payload.get("eventId")
        if event_id and event_id in self._seen_event_ids:
            # Idempotent replay: return the original result, create no new log.
            return _FakeResponse(200, self._seen_event_ids[event_id])

        body = {
            "approved": True,
            "message": "OK",
            "licensePlateNumber": payload.get("licensePlateNumber"),
            "type": payload.get("type"),
        }
        self.logs.append({
            "eventId": event_id,
            "licensePlateNumber": payload.get("licensePlateNumber"),
            "occurredAt": payload.get("occurredAt"),
        })
        if event_id:
            self._seen_event_ids[event_id] = body
        return _FakeResponse(200, body)


class _StubConfig:
    """Minimal config surface used by GateClient."""
    def get_gate_key(self): return "test-key"
    def get_api_url(self): return "http://localhost:8080/api/vehicles/check-vehicle"
    def get_api_timeout(self): return 5


def _make_event(plate, occurred_at):
    return {
        "event_id": str(uuid.uuid4()),
        "license_plate": plate,
        "panel_type": "entry",
        "gate_id": "gate-1",
        "occurred_at": occurred_at,
        "snapshot": None,
    }


def _assert(cond, msg):
    if not cond:
        raise AssertionError(msg)
    print(f"  ok: {msg}")


def run():
    backend = FakeBackend()
    gate_client_module.requests.post = backend.post  # monkeypatch the network
    client = GateClient(_StubConfig())

    tmpdir = tempfile.mkdtemp(prefix="edge_q_")
    qpath = os.path.join(tmpdir, "events.sqlite3")
    queue = EventQueue(qpath, max_events=100)

    # --- Scenario 1: backend down -> events queued, none lost -----------------
    backend.up = False
    events = [
        _make_event("51A-111.11", "2026-07-09T10:00:00+00:00"),
        _make_event("51B-222.22", "2026-07-09T10:00:05+00:00"),
        _make_event("51C-333.33", "2026-07-09T10:00:09+00:00"),
    ]
    for ev in events:
        result = client.send_check_event(ev)
        _assert(not result["delivered"] and result["retriable"],
                f"offline send of {ev['license_plate']} is a retriable failure")
        queue.enqueue(ev)
    _assert(queue.count() == 3, "3 events persisted while backend down")
    _assert(len(backend.logs) == 0, "backend created no logs while down")

    # Durability: reopen the queue file (simulates an edge restart).
    queue.close()
    queue = EventQueue(qpath, max_events=100)
    _assert(queue.count() == 3, "queued events survive a restart")

    # --- Scenario 2: backend up -> worker drains, original timestamps kept -----
    backend.up = True
    due = queue.due_events(limit=50)
    _assert(len(due) == 3, "all 3 events are due for retry")
    for item in due:
        res = client.send_check_event(item["event"])
        _assert(res["delivered"], f"delivered {item['event']['license_plate']} on recovery")
        queue.delete(item["id"])
    _assert(queue.count() == 0, "queue is empty after successful flush")
    _assert(len(backend.logs) == 3, "backend now has exactly 3 logs")
    got_times = {l["licensePlateNumber"]: l["occurredAt"] for l in backend.logs}
    _assert(got_times["51A-111.11"] == "2026-07-09T10:00:00+00:00",
            "log carries the ORIGINAL event time, not the resend time")

    # --- Scenario 3: same event id twice -> single logical log ----------------
    dup = _make_event("51D-444.44", "2026-07-09T11:00:00+00:00")
    r1 = client.send_check_event(dup)
    r2 = client.send_check_event(dup)  # identical eventId (a lost-ack retry)
    _assert(r1["delivered"] and r2["delivered"], "both sends of the same event delivered")
    dup_logs = [l for l in backend.logs if l["eventId"] == dup["event_id"]]
    _assert(len(dup_logs) == 1, "retrying the same event id creates no duplicate log")

    # --- Bonus: queue cap drops oldest -----------------------------------------
    small = EventQueue(os.path.join(tmpdir, "cap.sqlite3"), max_events=2)
    for i in range(5):
        small.enqueue(_make_event(f"CAP-{i}", "2026-07-09T12:00:00+00:00"))
    _assert(small.count() == 2, "queue cap keeps only the newest N events")

    print("\nAll edge resilience checks passed.")


if __name__ == "__main__":
    run()
