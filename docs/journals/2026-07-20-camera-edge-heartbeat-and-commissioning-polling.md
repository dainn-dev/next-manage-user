# Camera Edge heartbeat and commissioning polling

**Date:** 2026-07-20

## Context

Creating a camera in commissioning only provisions its backend record; it does not prove that the physical Edge process is running. The missing link was a camera-specific heartbeat from Edge, together with periodic UI refresh so an operator can see the backend-owned physical state change without reloading the page.

## Decisions

- A live Camera Edge pipeline starts an immediate heartbeat and repeats it every **20 seconds**. Dry-run mode never sends heartbeat traffic, and shutdown stops the heartbeat worker cleanly.
- Heartbeat success requires exactly **HTTP 200**. Network failures and all other status codes are treated as failures, logged with camera context, and retried with exponential backoff capped at **300 seconds**. A successful response resets the interval to 20 seconds.
- The commissioning Cameras step polls its camera list every **10 seconds** while that step is active. It prevents overlapping requests, ignores stale responses after site/step changes, and retries polling failures silently after the initial load has already reported errors.
- Physical `online` / `offline` status is backend-owned and derived from heartbeat freshness. The camera form no longer lets an operator set these states directly.
- Administrative lifecycle changes are explicit: an existing camera can be **disabled**, or a disabled camera can be **enabled** back to `provisioned` while it waits for a new heartbeat. Creating or editing ordinary camera details does not implicitly overwrite status.

## Test coverage

- Edge tests cover the immediate authenticated heartbeat request and derived camera endpoint, clean shutdown, rejection of non-200 responses, and the dry-run no-network guarantee.
- Existing camera pipeline tests continue to cover ingest payloads, retries, queue replay, and idempotency behavior alongside the new heartbeat worker.
- Commissioning verification covers 10-second refresh behavior, stale-request protection, preservation of the selected camera, removal of direct physical-status editing, and explicit disable/enable payloads.

## Impact

Operators now see a camera become online through actual Edge activity rather than a manually selected UI value. This keeps provisioning, physical health, and administrative disablement as separate states and makes the commissioning screen converge automatically on backend truth.
