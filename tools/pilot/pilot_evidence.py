#!/usr/bin/env python3
"""Evidence gate for DAI-316 controlled-site pilot and go/no-go decisions."""

from __future__ import annotations

import argparse
from datetime import date, datetime, timedelta, timezone
import hashlib
import json
from pathlib import Path
from typing import Any


REQUIRED_SCENARIOS = {
    "operator_login", "camera_health", "occupancy_map", "plate_read", "relocation",
    "manual_correction", "privacy_retention", "incident_escalation", "rollback",
}
METRICS = {
    "falsePlateReadRate": ("falsePlateReadRateMax", "max"),
    "missedPlateReadRate": ("missedPlateReadRateMax", "max"),
    "occupancyMismatchRate": ("occupancyMismatchRateMax", "max"),
    "relocationAccuracy": ("relocationAccuracyMin", "min"),
    "eventP95LatencyMs": ("eventP95LatencyMsMax", "max"),
    "uptime": ("uptimeMin", "min"),
    "manualCorrectionRate": ("manualCorrectionRateMax", "max"),
    "estimatedCost": ("estimatedCostMax", "max"),
}


class PilotEvidenceError(RuntimeError):
    pass


def read_json(path: str | Path) -> dict[str, Any]:
    path = Path(path)
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise PilotEvidenceError(f"cannot read {path}: {exc}") from exc
    if not isinstance(value, dict):
        raise PilotEvidenceError(f"{path} must contain a JSON object")
    return value


def _required(value: dict[str, Any], keys: tuple[str, ...], label: str) -> None:
    missing = [key for key in keys if key not in value or value[key] in (None, "", [], {})]
    if missing:
        raise PilotEvidenceError(f"{label} is missing: {', '.join(missing)}")


def _day(value: str, label: str) -> date:
    try:
        return date.fromisoformat(value)
    except (TypeError, ValueError) as exc:
        raise PilotEvidenceError(f"{label} must be YYYY-MM-DD") from exc


def validate_profile(profile: dict[str, Any], root: Path | None = None,
                     require_evidence: bool = True) -> tuple[date, date]:
    _required(profile, ("pilotId", "tenantId", "siteId", "siteName", "window", "cameras",
                        "zones", "retentionDays", "privacyNotice", "roles", "supportHours",
                        "rollbackPlan", "calibrationEvidence", "calibrationSettings", "targets", "conditionActions"), "profile")
    if "replace with" in json.dumps(profile).lower() or "example.invalid" in json.dumps(profile).lower():
        raise PilotEvidenceError("profile still contains placeholders")
    start, end = _day(profile["window"].get("start"), "window.start"), _day(profile["window"].get("end"), "window.end")
    days = (end - start).days + 1
    if days < 7 or days > 14:
        raise PilotEvidenceError("pilot observation window must contain 7 to 14 calendar days")
    if not isinstance(profile["cameras"], list) or not profile["cameras"]:
        raise PilotEvidenceError("pilot requires at least one camera")
    if not isinstance(profile["zones"], list) or not profile["zones"]:
        raise PilotEvidenceError("pilot requires at least one constrained zone")
    _required(profile["privacyNotice"], ("version", "location", "postedAt"), "privacyNotice")
    try:
        posted = datetime.fromisoformat(str(profile["privacyNotice"]["postedAt"]))
    except ValueError as exc:
        raise PilotEvidenceError("privacyNotice.postedAt must be ISO-8601") from exc
    if posted.date() >= start:
        raise PilotEvidenceError("privacy notice must be posted before the first observation day")
    _required(profile["roles"], ("pilotOwner", "siteOperator", "securityContact", "privacyContact",
                                 "technicalOnCall"), "roles")
    _required(profile["supportHours"], ("timezone", "schedule", "afterHoursEscalation"), "supportHours")
    _required(profile["calibrationSettings"], ("geometryVersion", "slotMapVersion", "plateThresholdProfile",
                                                "networkProfile", "retentionPolicyVersion"), "calibrationSettings")
    if not isinstance(profile["retentionDays"], int) or profile["retentionDays"] < 1:
        raise PilotEvidenceError("retentionDays must be a positive integer")
    for metric, (target, _) in METRICS.items():
        if target not in profile["targets"]:
            raise PilotEvidenceError(f"targets.{target} is required")
        action = profile["conditionActions"].get(metric, {})
        _required(action, ("owner", "dueDate"), f"conditionActions.{metric}")
        _day(action["dueDate"], f"conditionActions.{metric}.dueDate")
    if require_evidence:
        base = root or Path.cwd()
        paths = [profile["rollbackPlan"], *profile["calibrationEvidence"].values()]
        missing = [item for item in paths if not (base / str(item)).is_file()]
        if missing:
            raise PilotEvidenceError(f"required rehearsal/calibration evidence is missing: {', '.join(missing)}")
    return start, end


def validate_uat(uat: dict[str, Any], profile: dict[str, Any], start: date,
                 root: Path | None = None, require_evidence: bool = False) -> None:
    _required(uat, ("pilotId", "status", "executedAt", "signedAt", "signedBy", "evidence", "training", "scenarios"), "UAT")
    if uat["pilotId"] != profile["pilotId"]:
        raise PilotEvidenceError("UAT pilotId does not match profile")
    if uat["status"] != "approved" or "replace with" in str(uat["signedBy"]).lower():
        raise PilotEvidenceError("UAT must be approved by the named pilot owner")
    try:
        signed = datetime.fromisoformat(str(uat["signedAt"]))
    except ValueError as exc:
        raise PilotEvidenceError("UAT signedAt must be ISO-8601") from exc
    if signed.date() >= start:
        raise PilotEvidenceError("UAT must be signed before the first observation day")
    _required(uat["training"], ("completedAt", "materialVersion", "attendees"), "UAT training")
    try:
        trained = datetime.fromisoformat(str(uat["training"]["completedAt"]))
    except ValueError as exc:
        raise PilotEvidenceError("UAT training.completedAt must be ISO-8601") from exc
    if trained > signed:
        raise PilotEvidenceError("operator training must complete before UAT sign-off")
    if "replace with" in json.dumps(uat["training"]).lower():
        raise PilotEvidenceError("UAT training still contains placeholders")
    if require_evidence and not ((root or Path.cwd()) / str(uat["evidence"])).is_file():
        raise PilotEvidenceError(f"signed UAT evidence is missing: {uat['evidence']}")
    scenarios = {str(item.get("id")): bool(item.get("passed")) for item in uat["scenarios"] if isinstance(item, dict)}
    failed = sorted(item for item in REQUIRED_SCENARIOS if not scenarios.get(item))
    if failed:
        raise PilotEvidenceError(f"UAT scenarios are missing or failed: {', '.join(failed)}")


def validate_observation(item: dict[str, Any], profile: dict[str, Any], start: date, end: date) -> date:
    keys = ("pilotId", "date", "observationHours", "plateReads", "falsePlateReads", "missedPlateReads",
            "occupancyChecks", "occupancyMismatches", "relocations", "correctRelocations", "events",
            "eventP95LatencyMs", "uptime", "manualCorrections", "supportIncidents", "estimatedCost", "incidents")
    _required(item, keys[:-1], "daily observation")
    if "incidents" not in item:
        raise PilotEvidenceError("daily observation is missing: incidents")
    if item["pilotId"] != profile["pilotId"]:
        raise PilotEvidenceError("daily pilotId does not match profile")
    observed = _day(item["date"], "daily date")
    if observed < start or observed > end:
        raise PilotEvidenceError("daily date is outside the approved observation window")
    numeric = keys[2:-1]
    if any(not isinstance(item[key], (int, float)) or item[key] < 0 for key in numeric):
        raise PilotEvidenceError("daily numeric metrics must be non-negative numbers")
    if not 0 <= item["uptime"] <= 1:
        raise PilotEvidenceError("uptime must be between 0 and 1")
    if item["falsePlateReads"] > item["plateReads"] or item["occupancyMismatches"] > item["occupancyChecks"]:
        raise PilotEvidenceError("error counts cannot exceed their measured populations")
    if item["correctRelocations"] > item["relocations"] or item["manualCorrections"] > item["events"]:
        raise PilotEvidenceError("corrected/success counts cannot exceed their measured populations")
    if not isinstance(item["incidents"], list):
        raise PilotEvidenceError("incidents must be an array")
    for incident in item["incidents"]:
        _required(incident, ("id", "category", "severity", "status", "owner", "dueDate"), "incident")
        _day(incident["dueDate"], f"incident {incident['id']} dueDate")
    return observed


def _ratio(top: float, bottom: float) -> float | None:
    return top / bottom if bottom else None


def build_decision(profile: dict[str, Any], uat: dict[str, Any], observations: list[dict[str, Any]],
                   root: Path | None = None, require_evidence: bool = True) -> dict[str, Any]:
    start, end = validate_profile(profile, root, require_evidence)
    validate_uat(uat, profile, start, root, require_evidence)
    by_day: dict[date, dict[str, Any]] = {}
    for item in observations:
        observed = validate_observation(item, profile, start, end)
        if observed in by_day:
            raise PilotEvidenceError(f"duplicate observation for {observed}")
        by_day[observed] = item
    expected = {start + timedelta(days=index) for index in range((end - start).days + 1)}
    missing = sorted(expected - set(by_day))
    if missing:
        raise PilotEvidenceError("full observation window is incomplete: " + ", ".join(map(str, missing)))
    rows = [by_day[day] for day in sorted(by_day)]
    total = lambda key: sum(float(item[key]) for item in rows)
    hours = total("observationHours")
    metrics = {
        "falsePlateReadRate": _ratio(total("falsePlateReads"), total("plateReads")),
        "missedPlateReadRate": _ratio(total("missedPlateReads"), total("plateReads") + total("missedPlateReads")),
        "occupancyMismatchRate": _ratio(total("occupancyMismatches"), total("occupancyChecks")),
        "relocationAccuracy": _ratio(total("correctRelocations"), total("relocations")),
        "eventP95LatencyMs": max(float(item["eventP95LatencyMs"]) for item in rows),
        "uptime": _ratio(sum(float(item["uptime"]) * float(item["observationHours"]) for item in rows), hours),
        "manualCorrectionRate": _ratio(total("manualCorrections"), total("events")),
        "estimatedCost": total("estimatedCost"),
    }
    conditions: list[dict[str, Any]] = []
    for metric, (target_name, direction) in METRICS.items():
        actual, target = metrics[metric], float(profile["targets"][target_name])
        passed = actual is not None and (actual <= target if direction == "max" else actual >= target)
        if not passed:
            conditions.append({"type": "metric", "metric": metric, "actual": actual, "target": target,
                               **profile["conditionActions"][metric]})
    incidents = [incident for item in rows for incident in item["incidents"]]
    feedback = sorted({str(note).strip() for item in rows for note in item.get("operatorFeedback", [])
                       if str(note).strip()})
    unresolved = [item for item in incidents if item["status"] != "resolved"]
    for item in unresolved:
        conditions.append({"type": "incident", **item})
    blockers = [item for item in unresolved if item["category"] in {"safety", "privacy", "security"}
                and item["severity"] == "blocker"]
    decision = "no-go" if blockers else ("conditional-go" if conditions else "go")
    backlog = [
        {"priority": 1, "item": "Notification", "evidence": "incident response and operator escalation"},
        {"priority": 2, "item": "AI Chatbot", "evidence": "operator support and vehicle lookup"},
        {"priority": 3, "item": "Advanced Analytics", "evidence": "pilot KPI and cohort analysis"},
        {"priority": 4, "item": "Mobile", "evidence": "operator/driver feedback"},
        {"priority": 5, "item": "Scale-out", "evidence": "measured site capacity and cost"},
    ]
    return {
        "schemaVersion": 1, "pilotId": profile["pilotId"], "generatedAt": datetime.now(timezone.utc).isoformat(),
        "window": profile["window"], "daysRecorded": len(rows), "uatSignedBy": uat["signedBy"],
        "metrics": metrics, "targets": profile["targets"], "supportIncidents": int(total("supportIncidents")),
        "operatorFeedback": feedback,
        "unresolvedSafetyPrivacySecurityBlockers": blockers, "conditions": conditions,
        "decision": decision, "v1Backlog": backlog,
        "note": "Decision is derived from the complete versioned daily evidence set; source records remain immutable.",
    }


def render_markdown(report: dict[str, Any]) -> str:
    lines = ["# Controlled pilot go/no-go report", "", f"- Pilot: `{report['pilotId']}`",
             f"- Window: {report['window']['start']} to {report['window']['end']}",
             f"- UAT signed by: {report['uatSignedBy']}", f"- Decision: **{report['decision']}**", "",
             "## Measured results", "", "| Metric | Actual | Target |", "|---|---:|---:|"]
    target_by_metric = {metric: target for metric, (target, _) in METRICS.items()}
    for metric, actual in report["metrics"].items():
        lines.append(f"| {metric} | {actual if actual is not None else 'n/a'} | {report['targets'][target_by_metric[metric]]} |")
    lines.extend(["", "## Conditions and unresolved incidents", ""])
    if report["conditions"]:
        for item in report["conditions"]:
            lines.append(f"- `{item.get('metric', item.get('id'))}` — owner: {item['owner']}; due: {item['dueDate']}")
    else:
        lines.append("- None.")
    lines.extend(["", "## Prioritized V1 backlog", ""])
    lines.extend(f"{item['priority']}. {item['item']} — {item['evidence']}" for item in report["v1Backlog"])
    return "\n".join(lines) + "\n"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Record and decide a controlled parking-site pilot")
    sub = parser.add_subparsers(dest="command", required=True)
    validate = sub.add_parser("validate")
    record = sub.add_parser("record")
    decide = sub.add_parser("decide")
    for command in (validate, record, decide):
        command.add_argument("--profile", required=True)
        command.add_argument("--uat", required=True)
    record.add_argument("--observation", required=True)
    record.add_argument("--evidence-dir", default="pilot/evidence")
    decide.add_argument("--evidence-dir", default="pilot/evidence")
    decide.add_argument("--output", default="pilot/evidence/go-no-go.json")
    args = parser.parse_args(argv)
    try:
        profile_path = Path(args.profile).resolve()
        profile, uat = read_json(profile_path), read_json(args.uat)
        start, end = validate_profile(profile, Path.cwd(), True)
        validate_uat(uat, profile, start, Path.cwd(), True)
        if args.command == "validate":
            print("Pilot profile and signed UAT are valid.")
            return 0
        evidence = Path(args.evidence_dir).resolve()
        if args.command == "record":
            observation_path = Path(args.observation).resolve()
            observation = read_json(observation_path)
            observed = validate_observation(observation, profile, start, end)
            destination = evidence / "daily" / f"{observed}.json"
            if destination.exists():
                raise PilotEvidenceError(f"immutable observation already exists: {destination}")
            destination.parent.mkdir(parents=True, exist_ok=True)
            observation["sourceSha256"] = hashlib.sha256(observation_path.read_bytes()).hexdigest()
            observation["recordedAt"] = datetime.now(timezone.utc).isoformat()
            destination.write_text(json.dumps(observation, indent=2, sort_keys=True), encoding="utf-8")
            print(destination)
            return 0
        observations = [read_json(path) for path in sorted((evidence / "daily").glob("*.json"))]
        report = build_decision(profile, uat, observations, Path.cwd(), True)
        destination = Path(args.output).resolve()
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_text(json.dumps(report, indent=2, sort_keys=True), encoding="utf-8")
        destination.with_suffix(".md").write_text(render_markdown(report), encoding="utf-8")
        print(json.dumps({"decision": report["decision"], "output": str(destination)}, indent=2))
        return 0
    except PilotEvidenceError as exc:
        print(f"pilot evidence failed: {exc}")
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
