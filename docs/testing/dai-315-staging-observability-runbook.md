# DAI-315 staging, observability, and incident runbook

## Release and rollback

Owner: Platform on-call. Backup owner: Delivery lead. Pilot escalation: Site operations, then the
principal architect. Billing incidents additionally page the billing owner; OCR incidents page the
AI owner. `ALERT_WEBHOOK_URL` must reference the approved HTTPS paging connector; preflight rejects
local, insecure, malformed, and placeholder receivers.

1. Copy `deploy/staging/.env.example` to `.env`, replace every placeholder, and create
   `deploy/staging/secrets/prometheus-bearer-token` containing a short-lived PLATFORM_ADMIN token.
2. Publish backend and frontend images using the same immutable `RELEASE_VERSION` tag. Retain the
   prior passing tag as `PREVIOUS_RELEASE_VERSION`.
3. Run `scripts/staging-release.ps1 -Action Preflight`, then `-Action Deploy`. Flyway applies
   migrations and Hibernate validates the resulting schema. The command waits for readiness and
   writes versioned evidence beneath `deploy/staging/evidence/`.
4. Confirm Grafana at port 3001, Prometheus targets at port 9090, Alertmanager at port 9093, and the
   Pilot Operations dashboard. The dashboard never needs direct database credentials.
5. Roll back with `scripts/staging-release.ps1 -Action Rollback`. Database migrations must remain
   backward-compatible with `PREVIOUS_RELEASE_VERSION`; destructive schema cleanup is a later
   release after rollback expiry.

## Failure and recovery drills

Run both commands and retain their JSON evidence:

```powershell
scripts/invoke-staging-failure-drill.ps1 -Scenario BackendUnavailable
scripts/invoke-staging-failure-drill.ps1 -Scenario DatabaseUnavailable
```

Each drill stops the representative service, waits for the named alert in Alertmanager, verifies
delivery to the configured staging receiver, restarts the service, and records timestamps. For
camera, ingest, OCR, occupancy, WebSocket, and billing alerts, use the load/evaluation fixtures or
pilot test devices to cross the rule threshold; never corrupt production data to test an alert.

## Backup and restore exercise

The staging backup service creates a compressed PostgreSQL dump daily and retains seven days.
Before every release and monthly, exercise `scripts/verify-backup-restore.ps1`, retain its SHA-256,
row-count summary and measured RTO, then drop only the disposable restore database. Object-storage
retention is 30 days for pilot evidence; verify MinIO lifecycle configuration and a sampled object
restore monthly. A written procedure without current evidence does not pass the gate.

## Incident response

1. Acknowledge, name an incident commander, and record the first correlation ID and release tag.
2. Check Pilot Operations before querying databases. Determine scope: cameras/site, ingest/outbox,
   AI cohort, occupancy, database/storage, WebSocket, or billing.
3. Stop harmful writes if occupancy is corrupt; preserve event/outbox data and snapshots. For lag,
   restore the dependency before replaying durable queues.
4. Roll back when the incident begins with the release and the previous image is schema-compatible.
5. Restore PostgreSQL only after the incident commander approves the measured data-loss window.
6. Validate readiness, queue drain, occupancy reconciliation, WebSocket reconnect, and billing
   idempotency. Resolve the alert only after user impact ends.
7. Within one business day, attach the timeline, correlation IDs, dashboards, release evidence,
   customer impact, remediation owner, and due date to the incident review.

## Exit checklist

- [ ] Clean deploy and rollback evidence for the candidate and previous immutable tags
- [ ] Backend and database failure drills routed to the approved receiver
- [ ] Dashboard shows service, camera, ingest, lag, OCR, occupancy, DB, WebSocket, billing KPIs
- [ ] Backup/restore evidence is current and within the agreed RPO/RTO
- [ ] Prometheus token and all deployment secrets are outside Git and placeholders are rejected
- [ ] Operators have acknowledged ownership/escalation and exercised this runbook
