# ADR-1602: Tool-calling against tenant-scoped internal APIs, not direct DB access or RAG-over-live-data

- Status: Proposed
- Date: 2026-07-09
- Deciders: Principal Architect
- Context doc: 16_AI_Chatbot

## Context

The chatbot must ground answers in live operational data — vehicle location, history, snapshots,
parking-slot occupancy — that lives in tenant-owned Postgres tables protected today (per ADR-0401 in
`04_Multi_Tenant_Design`, the multi-tenancy ADR) by Row-Level Security keyed on `tenant_id`/`site_id`
(§3.2). Any mechanism that lets the LLM read this data must not become a way to bypass that
isolation boundary — a leaked plate location or snapshot for the wrong tenant is a real data
breach, not a cosmetic bug. There is also a temptation, common in chatbot architectures, to let the
LLM generate SQL directly (text-to-SQL) or to embed live operational rows into a vector store for
RAG retrieval.

## Decision

The chatbot **only** accesses tenant data through **function/tool-calling** against a fixed,
reviewed set of internal REST read endpoints — `getVehicleLocation()`, `getHistory()`,
`getSnapshot()`, `getParkingStatus()` — that are the same tenant-scoped APIs (same auth middleware,
same RLS-backed repositories) used by the dashboard (`17_Dashboard`) and mobile app
(`18_Mobile_App`). The LLM never sees a database connection, a table name, or a way to construct
arbitrary queries. Retrieval-Augmented Generation (RAG) is scoped strictly to **static,
non-tenant** content — product docs and FAQ — and is explicitly out of scope for live operational
(vehicle/slot/event) data.

## Alternatives considered

- **Text-to-SQL (LLM writes SQL, backend executes it read-only)** — pros: maximal query flexibility,
  answers arbitrary ad-hoc questions; cons: a prompt-injected or malformed query is an active SQL
  injection / data-exfiltration surface even against a read replica, tenant isolation would depend
  on prompt-level trust rather than the same enforced RLS+service-layer checks every other client
  uses, very hard to audit "what did the bot actually query."
- **RAG over a tenant's live operational rows (embed vehicle/slot/event rows into a vector store)**
  — pros: flexible semantic retrieval, no new endpoints per question type; cons: embeddings go stale
  the moment a slot changes (this data changes every few seconds), a vector index is a second place
  tenant isolation must be independently re-implemented and re-audited, and embedding PII (plates,
  timestamps) creates another at-rest copy of sensitive data to protect and purge on offboarding.

## Consequences

- Positive: the chatbot's data-access surface is exactly 4 reviewable endpoints, each already
  covered by the dashboard/mobile app's existing auth, tenancy, and audit story; adding a new
  chatbot capability is a normal "add an endpoint" change, not a new isolation mechanism; RAG stays
  cheap and low-risk because it never touches live tenant rows.
- Negative / trade-offs: the chatbot can only answer questions the 4 tools (plus future tools)
  explicitly support — open-ended "show me all vehicles that entered twice last week" style
  questions require a new tool/endpoint rather than an ad-hoc query.
- Follow-ups: define a lightweight process for adding new tools (schema review + tenant-scoping
  review) as chatbot use cases grow; revisit RAG-over-tenant-data only if a strong product need
  emerges, with a dedicated ADR for how isolation would be re-enforced in the vector layer.
