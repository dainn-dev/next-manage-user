# DAI-313 security and reliability report

## Implemented controls

- Deployed gate endpoints fail closed when `GATE_API_KEY` is absent; open mode requires the explicit local-only `GATE_ALLOW_OPEN=true` setting.
- Only actuator health is anonymous. Metrics and other actuator data require PLATFORM_ADMIN.
- Legacy gate snapshots are denied because their old paths carry no tenant authorization metadata. Other legacy media requires authentication; new tenant-scoped object references are signed only when their key matches the active tenant.
- Credentialed CORS is restricted to `CORS_ALLOWED_ORIGINS` instead of accepting every origin.
- Existing RLS, camera rotation, webhook/idempotency, occupancy, and edge durable-queue tests are assembled into one repeatable gate.

## Commands and evidence

- `pwsh scripts/run-security-reliability.ps1` produces `artifacts/security-reliability/security-reliability-report.json` plus per-suite logs and runs backend/frontend High-severity vulnerability gates. `-SkipScans` is diagnostic only and deliberately reports `incomplete` with a non-zero exit.
- `pwsh scripts/verify-backup-restore.ps1` creates a PostgreSQL custom-format backup, restores it into an isolated verification database, queries critical row counts, and records SHA-256 and measured RTO.
- Run container/dependency vulnerability scans in the release environment and attach reports. Any Critical/High finding blocks release until remediated or rescanned clean.

## Recovery targets and sign-off

Pilot targets: database RPO ≤ 24 hours and measured RTO ≤ 4 hours. Object-storage versioning/replication and restore must be exercised in the deployment environment because local MinIO does not prove the production provider's recovery behavior.

| Evidence | Result | Owner | Timestamp |
|---|---|---|---|
| Security/replay gate |  |  |  |
| PostgreSQL backup/restore |  |  |  |
| Object-storage recovery |  |  |  |
| Dependency/container scans |  |  |  |
| Critical/High findings |  |  |  |
