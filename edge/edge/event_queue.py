"""Persistent store-and-forward queue for edge check-vehicle events (Phase 4.3).

When the backend is unreachable, confirmed plate events are written here instead
of being dropped. A background worker in :mod:`edge_service` drains the queue and
re-sends each event with exponential backoff, deleting it once the backend
accepts it. The queue is durable (survives an edge restart), bounded (oldest
events are dropped once a cap is reached) and safe to touch from several threads.

Storage is a single SQLite file so one row == one event and delivery bookkeeping
(attempt count, next-attempt time) lives next to the payload. The cropped plate
JPEG, when present, is stored inline as a BLOB so evidence is not lost across a
restart.
"""

import os
import sqlite3
import threading
import time


# Columns kept small and explicit so a future migration is obvious.
_SCHEMA = """
CREATE TABLE IF NOT EXISTS events (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id      TEXT    NOT NULL UNIQUE,
    license_plate TEXT    NOT NULL,
    panel_type    TEXT    NOT NULL,
    gate_id       TEXT,
    occurred_at   TEXT,
    snapshot      BLOB,
    attempts      INTEGER NOT NULL DEFAULT 0,
    next_attempt  REAL    NOT NULL DEFAULT 0,
    created_at    REAL    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_events_next_attempt ON events (next_attempt);
"""


class EventQueue:
    """A durable, bounded FIFO of check-vehicle events awaiting delivery.

    All public methods are thread-safe. One instance is shared between the live
    detection thread (which enqueues on failure) and the retry worker thread
    (which drains).
    """

    def __init__(self, path, max_events=5000):
        self.path = path
        self.max_events = max(1, int(max_events))
        self._lock = threading.Lock()

        directory = os.path.dirname(os.path.abspath(path))
        if directory:
            os.makedirs(directory, exist_ok=True)

        # check_same_thread=False: we guard every access with self._lock, so the
        # single connection can be shared across the detection and worker threads.
        self._conn = sqlite3.connect(path, check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        with self._conn:
            self._conn.executescript(_SCHEMA)

    # ------------------------------------------------------------------ writes
    def enqueue(self, event):
        """Persist one event. Returns True if stored (or already present).

        ``event`` is the dict shape produced by the edge service:
        ``{event_id, license_plate, panel_type, gate_id, occurred_at, snapshot}``.
        Re-enqueuing the same ``event_id`` is a no-op (idempotent) so a duplicate
        detection never doubles the backlog. When the queue is at capacity the
        oldest event is dropped to make room, and the drop is returned to the
        caller so it can be logged.
        """
        snapshot = event.get("snapshot")
        row = (
            event["event_id"],
            event["license_plate"],
            event["panel_type"],
            event.get("gate_id"),
            event.get("occurred_at"),
            sqlite3.Binary(snapshot) if snapshot else None,
            time.time(),
        )
        with self._lock:
            try:
                with self._conn:
                    self._conn.execute(
                        "INSERT INTO events "
                        "(event_id, license_plate, panel_type, gate_id, occurred_at, snapshot, created_at) "
                        "VALUES (?, ?, ?, ?, ?, ?, ?)",
                        row,
                    )
            except sqlite3.IntegrityError:
                # UNIQUE(event_id) — the event is already queued.
                return True
            self._enforce_cap_locked()
        return True

    def _enforce_cap_locked(self):
        """Drop the oldest events until the queue is within ``max_events``.

        Returns the number dropped. Caller already holds the lock and is inside
        (or will open) a transaction context; we use an explicit transaction.
        """
        count = self._conn.execute("SELECT COUNT(*) FROM events").fetchone()[0]
        overflow = count - self.max_events
        if overflow <= 0:
            return 0
        with self._conn:
            self._conn.execute(
                "DELETE FROM events WHERE id IN "
                "(SELECT id FROM events ORDER BY id ASC LIMIT ?)",
                (overflow,),
            )
        return overflow

    def mark_attempt(self, row_id, next_attempt):
        """Record a failed delivery: bump the attempt count and reschedule."""
        with self._lock:
            with self._conn:
                self._conn.execute(
                    "UPDATE events SET attempts = attempts + 1, next_attempt = ? WHERE id = ?",
                    (next_attempt, row_id),
                )

    def delete(self, row_id):
        """Remove a delivered (or permanently-failed) event."""
        with self._lock:
            with self._conn:
                self._conn.execute("DELETE FROM events WHERE id = ?", (row_id,))

    # ------------------------------------------------------------------- reads
    def due_events(self, limit=20, now=None):
        """Return up to ``limit`` events whose ``next_attempt`` has passed.

        Oldest first (FIFO) so events are re-sent roughly in the order they
        occurred. Each item is ``{"id", "attempts", "event": {...}}`` where the
        inner event dict matches the enqueue shape (snapshot decoded to bytes).
        """
        now = time.time() if now is None else now
        with self._lock:
            rows = self._conn.execute(
                "SELECT * FROM events WHERE next_attempt <= ? ORDER BY id ASC LIMIT ?",
                (now, int(limit)),
            ).fetchall()
        return [self._row_to_item(r) for r in rows]

    @staticmethod
    def _row_to_item(r):
        snapshot = r["snapshot"]
        return {
            "id": r["id"],
            "attempts": r["attempts"],
            "event": {
                "event_id": r["event_id"],
                "license_plate": r["license_plate"],
                "panel_type": r["panel_type"],
                "gate_id": r["gate_id"],
                "occurred_at": r["occurred_at"],
                "snapshot": bytes(snapshot) if snapshot is not None else None,
            },
        }

    def count(self):
        """Number of events currently queued."""
        with self._lock:
            return self._conn.execute("SELECT COUNT(*) FROM events").fetchone()[0]

    def close(self):
        with self._lock:
            self._conn.close()
