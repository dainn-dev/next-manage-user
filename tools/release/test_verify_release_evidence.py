import json
from pathlib import Path

import pytest

from verify_release_evidence import EvidenceError, verify


def write(root: Path, relative: str, value: dict):
    path = root / relative
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value), encoding="utf-8")


def complete(root: Path):
    write(root, "artifacts/security-reliability/security-reliability-report.json", {"status":"passed","scansSkipped":False})
    write(root, "artifacts/security-reliability/backup-restore-report.json", {"backupSha256":"abc","measuredRtoSeconds":2})
    write(root, "artifacts/performance-ai/load.json", {"observed":{"sloMet":True}})
    write(root, "artifacts/performance-ai/ai-evaluation.json", {"evidenceMode":"models","promotionEligible":True,"datasetVersion":"v1"})
    write(root, "deploy/staging/evidence/deploy-v1.json", {"readiness":"UP","releaseVersion":"v1"})
    write(root, "deploy/staging/evidence/rollback-v0.json", {"readiness":"UP"})
    write(root, "deploy/staging/evidence/drill-backendunavailable.json", {"alertmanagerObserved":True,"receiverObserved":True})
    write(root, "deploy/staging/evidence/drill-databaseunavailable.json", {"alertmanagerObserved":True,"receiverObserved":True})
    write(root, "pilot/evidence/go-no-go.json", {"decision":"conditional-go","conditions":[{"owner":"A","dueDate":"2026-01-01"}],"unresolvedSafetyPrivacySecurityBlockers":[]})


def test_complete_evidence_passes(tmp_path):
    complete(tmp_path)
    assert verify(tmp_path)["status"] == "passed"


def test_fixture_ai_is_rejected(tmp_path):
    complete(tmp_path)
    write(tmp_path, "artifacts/performance-ai/ai-evaluation.json", {"evidenceMode":"fixture","promotionEligible":False})
    with pytest.raises(EvidenceError, match="real models"):
        verify(tmp_path)


def test_missing_staging_drill_is_rejected(tmp_path):
    complete(tmp_path)
    (tmp_path / "deploy/staging/evidence/drill-databaseunavailable.json").unlink()
    with pytest.raises(EvidenceError, match="missing evidence"):
        verify(tmp_path)
