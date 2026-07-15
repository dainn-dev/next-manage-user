# DAI-316 controlled-site pilot and go/no-go

## Before observation

Owner: the named pilot owner. Select exactly one tenant/site and constrain cameras and zones in a
copy of `pilot/site-profile.example.json`. Complete the survey, display the versioned privacy
notice, confirm retention, support hours and escalation contacts, and attach real Stage 3/4
capacity, AI calibration, commissioning, staging rehearsal and rollback evidence.

Train the operator and execute every scenario in `pilot/uat.example.json`. The pilot owner must sign
UAT before the first observation day. Validate the gate with:

```powershell
python tools/pilot/pilot_evidence.py validate `
  --profile D:/pilot/site-profile.json --uat D:/pilot/uat.json
```

The validator rejects placeholders, missing rehearsal evidence, an observation window outside
7–14 days, missing targets/action owners, incomplete UAT, or a late signature.

## Daily operation

At the end of every calendar day, export monitoring evidence and reconcile a human sample. Record
false and missed reads, occupancy checks/mismatches, relocation results, event p95 latency, uptime,
manual corrections, incidents, feedback and estimated cost in a daily JSON file. Every unresolved
incident needs category, severity, owner and due date.

```powershell
python tools/pilot/pilot_evidence.py record `
  --profile D:/pilot/site-profile.json --uat D:/pilot/uat.json `
  --observation D:/pilot/daily/2026-08-03.json --evidence-dir pilot/evidence
```

Recorded evidence is immutable and contains the source SHA-256. Corrections use a new incident or
an explicitly reviewed replacement outside this tool; do not silently overwrite the original.
Operators follow the DAI-315 incident/rollback runbook for alerts and preserve correlation IDs.

## Decision gate

After the full window, generate the decision:

```powershell
python tools/pilot/pilot_evidence.py decide `
  --profile D:/pilot/site-profile.json --uat D:/pilot/uat.json `
  --evidence-dir pilot/evidence --output pilot/evidence/go-no-go.json
```

The tool refuses a premature or incomplete report. It aggregates count-based rates, uses the worst
daily p95 latency rather than averaging percentiles, weights uptime by observation hours, and sums
cost. Any unresolved safety/privacy/security blocker results in **no-go**. Other missed targets or
open incidents result in **conditional-go**, with an owner and due date for every condition. A clean
window produces **go**. Both JSON and Markdown reports retain the UAT signer, targets, actuals,
conditions, incidents and decision.

The report also creates the agreed evidence-led baseline V1 order: Notification, AI Chatbot,
Advanced Analytics, Mobile, then Scale-out. The product owner may reorder it only by documenting
the pilot evidence that justifies the change.

## Required sign-off package

- Signed UAT and training attendance
- Site survey, privacy notice evidence, roles, support hours and rollback plan
- Versioned commissioning, AI/capacity and staging rehearsal reports
- One immutable daily record for every day in the approved window
- Dashboard exports, incident timelines, feedback summary and cost/capacity review
- Generated go/conditional-go/no-go JSON and Markdown report
- Pilot owner, security/privacy reviewers and product owner acknowledgement
