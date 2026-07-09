#!/usr/bin/env python3
"""Build a labelling manifest from the production error corpus (DAI-257 / B1, B2).

Phase 4.2 stores a cropped plate snapshot per check in ``vehicle_log.image_path``;
Phase 4.4 raises a ``vehicle_access_requests`` row (source=GATE, status
PENDING/REJECTED) for every unregistered / hard plate, also carrying an
``image_path``. Those two tables are exactly the "images the system got wrong or
was unsure about" — the highest-value seed for a test/train set.

This script reads those rows over the DB (read-only), copies the referenced
snapshot files next to a CSV manifest, and pre-fills the machine-read plate as a
*hint* the human labeller corrects. Nothing here writes to the app DB or touches
the running system.

    python export_testset.py \
        --db "postgresql://user:pass@host:5432/vehicledb" \
        --uploads-root /path/to/backend            # dir that holds ./uploads/... \
        --out ./testset --since 2026-06-01

Output:
    ./testset/images/*.jpg
    ./testset/labels.csv          # filename,plate,tags,source,read_at,gate  (plate = HINT to correct)

Dependencies: psycopg2-binary (only if you pass --db). Without --db, pass
--manifest-json to feed rows exported by any other means (e.g. the REST API).
"""

import argparse
import csv
import json
import os
import re
import shutil


def sanitize(s):
    return re.sub(r"[^A-Za-z0-9]", "", (s or "")) or "unknown"


def rows_from_db(dsn, since):
    import psycopg2  # lazy: only needed for --db mode
    # source='rejected'/'pending' rows are the hard cases; vehicle_log snapshots
    # are the general population. UNION both, keep only rows that carry an image.
    sql = """
      SELECT license_plate_number AS plate, image_path, entry_exit_time AS ts,
             gate_location AS gate, 'log' AS source
        FROM vehicle_log
       WHERE image_path IS NOT NULL AND (%(since)s IS NULL OR entry_exit_time >= %(since)s)
      UNION ALL
      SELECT license_plate AS plate, image_path, created_at AS ts,
             CAST(gate_id AS text) AS gate, lower(status::text) AS source
        FROM vehicle_access_requests
       WHERE image_path IS NOT NULL AND source = 'GATE'
         AND (%(since)s IS NULL OR created_at >= %(since)s)
      ORDER BY ts DESC
    """
    with psycopg2.connect(dsn) as conn, conn.cursor() as cur:
        cur.execute(sql, {"since": since})
        cols = [c.name for c in cur.description]
        return [dict(zip(cols, r)) for r in cur.fetchall()]


def resolve_local(image_path, uploads_root):
    """Map a stored web path (/uploads/snapshots/xxx.jpg) to a file on disk."""
    rel = image_path.lstrip("/")
    for base in (uploads_root, os.path.join(uploads_root, "backend"), "."):
        cand = os.path.join(base, rel)
        if os.path.isfile(cand):
            return cand
    return None


def main():
    ap = argparse.ArgumentParser(description="Export snapshot corpus into a labelling manifest")
    ap.add_argument("--db", help="postgres DSN; omit to use --manifest-json")
    ap.add_argument("--manifest-json", help="pre-exported rows [{plate,image_path,ts,gate,source}]")
    ap.add_argument("--uploads-root", default=".", help="dir under which /uploads/... resolves")
    ap.add_argument("--out", default="./testset")
    ap.add_argument("--since", default=None, help="ISO date filter, e.g. 2026-06-01")
    args = ap.parse_args()

    if args.db:
        rows = rows_from_db(args.db, args.since)
    elif args.manifest_json:
        with open(args.manifest_json, encoding="utf-8") as fh:
            rows = json.load(fh)
    else:
        ap.error("pass either --db or --manifest-json")

    img_dir = os.path.join(args.out, "images")
    os.makedirs(img_dir, exist_ok=True)
    manifest = os.path.join(args.out, "labels.csv")

    written, missing = 0, 0
    with open(manifest, "w", encoding="utf-8", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(["filename", "plate", "tags", "source", "read_at", "gate"])
        for r in rows:
            src_path = resolve_local(r["image_path"], args.uploads_root)
            if not src_path:
                missing += 1
                continue
            plate_hint = r.get("plate") or ""
            fname = f"{sanitize(plate_hint)}_{written}{os.path.splitext(src_path)[1] or '.jpg'}"
            shutil.copy2(src_path, os.path.join(img_dir, fname))
            # 'rejected'/'pending' rows are pre-tagged as hard cases for the labeller
            tag = "hard" if r.get("source") in ("rejected", "pending") else ""
            w.writerow([fname, plate_hint, tag, r.get("source", ""),
                        str(r.get("ts", "")), r.get("gate", "")])
            written += 1

    print(f"wrote {written} images + {manifest}  ({missing} rows had no resolvable file)")
    print("NEXT: a human corrects the `plate` column (it is the machine hint, not truth)")
    print("      and adds tags: military,red,2line,1line,blur,tilt,night,dirty ...")


if __name__ == "__main__":
    main()
