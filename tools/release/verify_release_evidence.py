#!/usr/bin/env python3
"""Fail-closed validation of DAI-312 release and pilot evidence."""

from __future__ import annotations

import argparse
import json
from pathlib import Path


class EvidenceError(RuntimeError):
    pass


def load(path: Path) -> dict:
    if not path.is_file():
        raise EvidenceError(f"missing evidence: {path}")
    try:
        value = json.loads(path.read_text(encoding="utf-8-sig"))
    except json.JSONDecodeError as exc:
        raise EvidenceError(f"invalid JSON evidence {path}: {exc}") from exc
    if not isinstance(value, dict):
        raise EvidenceError(f"evidence must be an object: {path}")
    return value


def one(root: Path, pattern: str) -> dict:
    matches = sorted(root.glob(pattern))
    if not matches:
        raise EvidenceError(f"missing evidence matching: {pattern}")
    return load(matches[-1])


def verify(root: Path) -> dict:
    security = load(root / "artifacts/security-reliability/security-reliability-report.json")
    if security.get("status") != "passed" or security.get("scansSkipped") is True:
        raise EvidenceError("security gate must pass with vulnerability scans enabled")
    recovery = load(root / "artifacts/security-reliability/backup-restore-report.json")
    if not recovery.get("backupSha256") or float(recovery.get("measuredRtoSeconds", 0)) <= 0:
        raise EvidenceError("backup/restore evidence lacks checksum or measured RTO")
    load_report = load(root / "artifacts/performance-ai/load.json")
    if load_report.get("observed", {}).get("sloMet") is not True:
        raise EvidenceError("pilot-equivalent load SLO is not met")
    ai = load(root / "artifacts/performance-ai/ai-evaluation.json")
    if ai.get("evidenceMode") != "models" or ai.get("promotionEligible") is not True:
        raise EvidenceError("AI evidence must use real models and be promotion eligible")
    deploy = one(root, "deploy/staging/evidence/deploy-*.json")
    rollback = one(root, "deploy/staging/evidence/rollback-*.json")
    if deploy.get("readiness") != "UP" or rollback.get("readiness") != "UP":
        raise EvidenceError("staging deploy and rollback must both finish ready")
    for scenario in ("backendunavailable", "databaseunavailable"):
        drill = load(root / f"deploy/staging/evidence/drill-{scenario}.json")
        if drill.get("alertmanagerObserved") is not True or drill.get("receiverObserved") is not True:
            raise EvidenceError(f"alert routing drill did not pass: {scenario}")
    pilot = load(root / "pilot/evidence/go-no-go.json")
    if pilot.get("decision") not in {"go", "conditional-go"}:
        raise EvidenceError("release requires a go or conditional-go pilot decision")
    if pilot.get("unresolvedSafetyPrivacySecurityBlockers"):
        raise EvidenceError("pilot contains unresolved safety/privacy/security blockers")
    conditions = pilot.get("conditions", [])
    if any(not item.get("owner") or not item.get("dueDate") for item in conditions):
        raise EvidenceError("every conditional-go item requires owner and dueDate")
    return {"status": "passed", "pilotDecision": pilot["decision"],
            "datasetVersion": ai.get("datasetVersion"), "releaseVersion": deploy.get("releaseVersion")}


def main(argv=None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", default=".")
    args = parser.parse_args(argv)
    try:
        print(json.dumps(verify(Path(args.root).resolve()), indent=2))
        return 0
    except EvidenceError as exc:
        print(f"release evidence failed: {exc}")
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
