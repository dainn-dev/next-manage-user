# ADR-1303: Event schema and versioning strategy

- Status: Proposed
- Date: 2026-07-09
- Deciders: Principal Architect
- Context doc: 13_Event_Driven_Architecture

## Context

Today there is no formal event schema at all — the closest analog is the ad hoc JSON body of
`VehicleCheckRequest` (license plate, type, gateId, eventId, snapshot) posted to
`/api/vehicles/check-vehicle`. Once nine domain event types (MotionDetected,
VehicleDetected, PlateRecognized, VehicleEntered, VehicleRelocated, VehicleExited,
PersonDetected, SnapshotSaved, NotificationSent) flow through RabbitMQ to five independent
consumers (`../diagrams/event-bus-topology.mmd`), each maintained on its own release cadence,
an uncoordinated schema change in the producer (ingest API / edge) can silently break a
consumer. We also need every event to be replayable from the `ParkingEvent.payload jsonb`
column (see `15_Database_Design`) years after it was written, by code that may look
different from what wrote it.

## Decision

1. Every event envelope carries: `event_id` (UUID, idempotency key), `event_type` (string,
   one of the nine names), `event_version` (integer, starts at `1`), `tenant_id`, `site_id`,
   `occurred_at`, `payload` (type-specific JSON object). The envelope itself is versioned
   independently of the payload.
2. Payload changes are **additive-only within a version**: new optional fields may be added
   freely; required-field removal or type changes require bumping `event_version` and
   publishing under the same `event_type` with the new version tag in the envelope.
3. Consumers read `event_version` and apply the matching (or a documented backward-compatible)
   deserializer; unknown/newer versions are logged and routed to a holding
   queue rather than crashing the consumer.
4. Schemas are defined once as JSON Schema documents checked into the backend repo
   (`backend/src/main/resources/events/schemas/<event_type>/v<N>.json`) and are the single
   source of truth for both the Java producer/consumer DTOs and any edge-side payload
   construction — this is the "registry" for now: file-based, versioned in git, validated in
   CI, not a separate running service.

## Alternatives considered

- **No formal schema, JSON by convention** (status quo pattern extended as-is) — fastest to
  ship, but the first incompatible field change silently breaks a consumer with no compile-
  or CI-time signal. Rejected once there are 5+ independent consumers.
- **Full schema registry service** (e.g. Confluent Schema Registry, Avro/Protobuf) — strong
  compatibility enforcement and compact wire format, but adds a new running service, a new
  serialization format the edge (Python) and backend (Java) both need libraries for, and
  operational weight disproportionate to a modular monolith at this stage. Rejected for now.
- **Git-versioned JSON Schema files, additive-only evolution (chosen)** — pros: zero new
  infrastructure, human-readable, diffable in PR review, easy for the edge team (Python) to
  consume without a codegen toolchain, matches the "OpenAPI 3.1 is the contract" style already
  chosen for the REST API (§3.16). Cons: compatibility is enforced by review discipline and
  CI schema-diff checks rather than a server that rejects incompatible writes at publish time.

## Consequences

- Positive: consumers can be upgraded independently; old events in `ParkingEvent.payload`
  remain interpretable because `event_version` travels with them; no new infra to operate.
- Negative / trade-offs: compatibility is convention + CI-enforced, not broker-enforced — a
  careless PR could still break the contract without a schema-registry-style hard gate.
- Follow-ups: add a CI check that diffs schema files against the previous release and fails
  on breaking changes without a version bump; revisit a real schema registry if/when the
  event catalog or consumer count grows substantially, or if a second language/runtime
  joins as a producer.
