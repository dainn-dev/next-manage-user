from datetime import date, timedelta

import pytest

import json

from pilot_evidence import PilotEvidenceError, build_decision, main, validate_profile, validate_uat


def profile():
    actions = {metric: {"owner": "Owner", "dueDate": "2026-08-20"} for metric in (
        "falsePlateReadRate", "missedPlateReadRate", "occupancyMismatchRate", "relocationAccuracy",
        "eventP95LatencyMs", "uptime", "manualCorrectionRate", "estimatedCost")}
    return {
        "pilotId": "pilot-1", "tenantId": "tenant", "siteId": "site", "siteName": "Site",
        "window": {"start": "2026-08-03", "end": "2026-08-09"}, "cameras": ["camera"], "zones": ["zone"],
        "retentionDays": 30, "privacyNotice": {"version": "v1", "location": "entrance", "postedAt": "2026-08-01"},
        "roles": {"pilotOwner": "Owner", "siteOperator": "Operator", "securityContact": "Security",
                  "privacyContact": "Privacy", "technicalOnCall": "On-call"},
        "supportHours": {"timezone": "Asia/Ho_Chi_Minh", "schedule": "07:00-22:00", "afterHoursEscalation": "Owner"}, "rollbackPlan": "rollback.md",
        "calibrationEvidence": {"commissioning": "commissioning.json"},
        "calibrationSettings": {"geometryVersion": "v1", "slotMapVersion": "v1", "plateThresholdProfile": "v1",
                                "networkProfile": "v1", "retentionPolicyVersion": "v1"},
        "targets": {"falsePlateReadRateMax": .02, "missedPlateReadRateMax": .05,
                    "occupancyMismatchRateMax": .02, "relocationAccuracyMin": .95,
                    "eventP95LatencyMsMax": 500, "uptimeMin": .995,
                    "manualCorrectionRateMax": .03, "estimatedCostMax": 500},
        "conditionActions": actions,
    }


def uat():
    return {"pilotId": "pilot-1", "status": "approved", "executedAt": "2026-08-01T10:00:00+07:00",
            "signedAt": "2026-08-02T10:00:00+07:00", "signedBy": "Pilot Owner", "evidence": "uat.md",
            "training": {"completedAt": "2026-08-01T09:00:00+07:00", "materialVersion": "v1", "attendees": ["Operator"]},
            "scenarios": [{"id": item, "passed": True} for item in (
                "operator_login", "camera_health", "occupancy_map", "plate_read", "relocation",
                "manual_correction", "privacy_retention", "incident_escalation", "rollback")]}


def observations(incident=None):
    rows = []
    for index in range(7):
        rows.append({"pilotId": "pilot-1", "date": str(date(2026, 8, 3) + timedelta(days=index)),
                     "observationHours": 12, "plateReads": 100, "falsePlateReads": 1, "missedPlateReads": 2,
                     "occupancyChecks": 100, "occupancyMismatches": 1, "relocations": 20,
                     "correctRelocations": 20, "events": 200, "eventP95LatencyMs": 250, "uptime": .999,
                     "manualCorrections": 2, "supportIncidents": 1 if incident and index == 0 else 0,
                     "estimatedCost": 20, "operatorFeedback": ["Map was clear"],
                     "incidents": [incident] if incident and index == 0 else []})
    return rows


def test_complete_passing_window_produces_go():
    report = build_decision(profile(), uat(), observations(), require_evidence=False)
    assert report["decision"] == "go"
    assert report["daysRecorded"] == 7
    assert report["v1Backlog"][0]["item"] == "Notification"
    assert report["operatorFeedback"] == ["Map was clear"]


def test_open_security_blocker_forces_no_go_with_owner_and_due_date():
    incident = {"id": "SEC-1", "category": "security", "severity": "blocker", "status": "open",
                "owner": "Security owner", "dueDate": "2026-08-10"}
    report = build_decision(profile(), uat(), observations(incident), require_evidence=False)
    assert report["decision"] == "no-go"
    assert report["conditions"][0]["owner"] == "Security owner"


def test_missing_observation_day_refuses_premature_decision():
    with pytest.raises(PilotEvidenceError, match="full observation window is incomplete"):
        build_decision(profile(), uat(), observations()[:-1], require_evidence=False)


def test_uat_must_be_signed_before_observation():
    value = uat()
    value["signedAt"] = "2026-08-03T06:00:00+07:00"
    start, _ = validate_profile(profile(), require_evidence=False)
    with pytest.raises(PilotEvidenceError, match="before the first observation day"):
        validate_uat(value, profile(), start)


def test_decide_cli_writes_json_and_markdown(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    value = profile()
    value["rollbackPlan"] = "rollback.md"
    value["calibrationEvidence"] = {"commissioning": "commissioning.json"}
    (tmp_path / "rollback.md").write_text("tested", encoding="utf-8")
    (tmp_path / "commissioning.json").write_text("{}", encoding="utf-8")
    (tmp_path / "uat.md").write_text("signed", encoding="utf-8")
    profile_path, uat_path = tmp_path / "profile.json", tmp_path / "uat.json"
    profile_path.write_text(json.dumps(value), encoding="utf-8")
    uat_path.write_text(json.dumps(uat()), encoding="utf-8")
    daily = tmp_path / "evidence" / "daily"
    daily.mkdir(parents=True)
    for item in observations():
        (daily / f"{item['date']}.json").write_text(json.dumps(item), encoding="utf-8")
    output = tmp_path / "evidence" / "decision.json"
    code = main(["decide", "--profile", str(profile_path), "--uat", str(uat_path),
                 "--evidence-dir", str(tmp_path / "evidence"), "--output", str(output)])
    assert code == 0
    assert json.loads(output.read_text(encoding="utf-8"))["decision"] == "go"
    assert output.with_suffix(".md").is_file()
