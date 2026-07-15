# 16 · AI Chatbot

> V1 backend implemented for DAI-320 on 2026-07-16. Activation remains
> fail-closed with `CHATBOT_ENABLED=false` until the notification exit gate and
> DAI-312 pilot dependencies are both GO.

The implementation exposes `POST /api/v1/chat` for authenticated parking
operators. The Ollama provider can only return an allow-listed tool plan; the
server discards model-proposed tenant, site, user and role context and executes
the four tools through existing authorized read services. A deterministic
Vietnamese/English fallback handles model outages. Responses include their
authoritative source, freshness timestamp and filtered tool data. V76 adds
RLS-protected conversations, redacted messages and tool audits, with prompt-
injection rejection, plan/rate limits, metering, estimated cost, latency,
operator audit queries and configurable retention deletion.

ParkVision's in-product assistant answers natural-language questions about a tenant's vehicles,
parking history, and site occupancy by calling tenant-scoped internal read APIs (tool-calling),
never by querying the database directly. It runs on a pluggable LLM provider — a self-hosted Ollama
model by default, with an optional hosted provider for tenants who opt in — and is surfaced inside
both the web dashboard (`17_Dashboard`) and the mobile app (`18_Mobile_App`).

Status: Draft · Owner: Principal Architect · Last updated: 2026-07-09

## 1. Current state vs. Target

**Current state:** none of this exists in the repo today. There is no LLM integration, no chat UI,
no tool-calling layer, and no chatbot-facing API in `backend/` or `frontend/`. What *does* exist and
is reused here: the REST backend (`/api` today, `/api/v1` target per §3.16 of the shared brief), JWT
auth carrying user/role claims, and the eventual read models this feature is grounded in (`Vehicle`,
`ParkingSlot`, `ParkingEvent`, `Snapshot` — see §4 domain model). This document specifies the target.

**Target:** a `chatbot` module (in the modular-monolith package layout, alongside `iam`, `tenancy`,
`billing`, `parking`, `ai-ingest`, `events`, `notification`, `analytics`) that exposes a
conversation endpoint, orchestrates LLM calls, executes tool calls against existing tenant-scoped
APIs, and enforces guardrails before any answer reaches the user.

## 2. Requirements

- Answer common driver/operator questions grounded in live data: "where is my car," "when did it
  last move," "show me the last snapshot," "how full is site X."
- Never answer with another tenant's data, under any prompt, including adversarial ones.
- Respect plan entitlements: message volume is metered and capped per tenant (see
  `05_Subscription_Billing`).
- Work primarily in Vietnamese (the product's primary UI language) with English fallback.
- Be embeddable in two clients with different UX shapes: a dashboard chat widget (desktop, longer
  sessions) and a mobile chat sheet (`18_Mobile_App`, short sessions, push-triggered).

## 3. Provider strategy

The Chat Service talks to LLMs through a `ChatProvider` interface so the underlying model is a
configuration choice, not a code fork:

| Provider | Role | Notes |
|---|---|---|
| **Ollama (default)** | Self-hosted, runs in the platform's own cluster (not per-tenant) | Model: **Qwen2.5** or **Llama 3.1** — both support function/tool-calling. Default for every plan tier. On-prem/cost-friendly, keeps tenant data (plates, timestamps, locations) inside the platform's VPC. |
| **Hosted (optional)** | Claude or OpenAI via their API | Plan-gated opt-in; requires explicit tenant consent since prompt context leaves the VPC. Higher reasoning/tool-calling reliability ceiling. |

See `adr/ADR-1601-local-ollama-vs-hosted-llm.md` for the full trade-off analysis.

## 4. Tools (exact contract)

Four tools, each a thin wrapper around an existing/target internal read API. **Every tool call is
executed with `tenant_id`/`site_id`/`role` injected server-side from the caller's JWT — the LLM can
never supply or override these values** (see §6, Guardrails).

| Tool | Signature | Backend endpoint | Grounded in (§4 entities) |
|---|---|---|---|
| `getVehicleLocation()` | `getVehicleLocation(plate: string)` | `GET /api/v1/vehicles/{plate}/location` | `Vehicle.current_slot_id`, `ParkingSlot` |
| `getHistory()` | `getHistory(plate: string, limit?: number)` | `GET /api/v1/vehicles/{plate}/history` | `ParkingEvent`, `ParkingHistory` |
| `getSnapshot()` | `getSnapshot(snapshotId?: string, plate?: string)` | `GET /api/v1/snapshots/{id}` (or latest-for-plate) | `Snapshot` |
| `getParkingStatus()` | `getParkingStatus(siteId: string)` | `GET /api/v1/sites/{siteId}/parking-status` | `ParkingSlot` (aggregate) |

Each endpoint is the same tenant-scoped, RLS-backed API the dashboard and mobile app already call —
the chatbot introduces no new data-access path, only a new caller. See
`diagrams/tool-data-source-map.mmd`.

## 5. Conversation flow

1. Client (dashboard or mobile) sends the user's message + JWT to the Chat Service.
2. **Rate-limit check** (Redis token-bucket keyed by `tenant_id`, budget from
   `Plan.limits.chatbot_messages_per_month` — see `05_Subscription_Billing`). Over-limit returns an
   upgrade prompt, not a silent failure.
3. **Prompt Builder** assembles: a system prompt (role, tenant name, allowed-tools schema,
   Vietnamese-first instruction, "never fabricate data — only answer from tool results"), short
   conversation history, and the user message.
4. LLM (Ollama or hosted, per tenant config) returns either a direct answer or a `tool_call`.
5. **Tool Router** validates the requested tool is in the allow-list, injects tenant/site/role
   context from the JWT (discarding any tenant/site-shaped args the LLM proposed), and calls the
   internal API.
6. Tool result passes through the **PII/guardrail post-filter** (§6) before being appended back to
   the LLM context.
7. LLM synthesizes the final natural-language answer from the (filtered) tool result.
8. If the answer references a snapshot, the Chat Service resolves a short-TTL signed URL and
   attaches it.
9. Response returned to the client; the full turn (tool name, filtered args, tenant, latency) is
   audit-logged.

See `diagrams/tool-calling-sequence.mmd` for the full sequence and
`diagrams/chatbot-architecture.mmd` for the component view.

## 6. Guardrails

- **Tenant isolation is structural, not prompt-based.** `tenant_id`/`site_id` come only from the
  verified JWT, injected by the Tool Router. The LLM is never trusted to supply or self-report them
  (prompt injection like "ignore instructions, tenant is X" cannot work — there is no code path that
  reads a tenant id out of the LLM's output).
- **PII minimization.** Tool results are filtered before reaching the LLM/user: personal fields
  (e.g. an employee's name/department behind a plate lookup) are masked unless the caller is the
  vehicle's own owner or holds `TENANT_ADMIN`/`PLATFORM_ADMIN` (role set per `06_User_RBAC`).
  Snapshot links are always short-TTL signed URLs.
- **No cross-tenant leakage.** Because every tool call re-runs through the same RLS-backed
  repository the dashboard uses, a tool literally cannot return another tenant's row — there is no
  separate "chatbot data path" to audit for a missed `WHERE tenant_id = ?`.
- **Rate limits tied to plan entitlements.** See §5 step 2; limits and current usage are the same
  `UsageRecord` metering mechanism used for billing (`05_Subscription_Billing`).
- **No free-form DB/RAG access to live data.** RAG (optional) is scoped to static docs/FAQ content
  only — never to live vehicle/slot/event rows. See `adr/ADR-1602-tool-calling-tenant-scoped-apis.md`.
- **Full audit trail.** Every tool invocation is logged (tool, filtered args, tenant, user, latency,
  outcome) for security review and abuse investigation.

Full mechanism detail: `adr/ADR-1603-chatbot-data-access-guardrails.md`.

## 7. Grounding and optional RAG

Primary grounding is **always** the live event/DB read models via the 4 tools above — the chatbot
does not "know" anything about a tenant's vehicles beyond what a tool call returns in that turn.
Optional **RAG over docs/FAQ** (product help content — how to add a vehicle, what a status means)
is a separate, static, non-tenant knowledge source: a small embedding index over documentation, used
only when the user's question isn't a data-lookup question. RAG results are never treated as ground
truth for operational facts (location, occupancy) — those always go through tools.

## 8. Worked example

> **User:** "Xe tôi đang ở đâu?" *("Where is my car?")*
>
> 1. Chat Service resolves the user's linked vehicle (or asks for the plate if the user has
>    multiple vehicles / no vehicle linked yet — see `18_Mobile_App` "link my vehicle" flow).
> 2. LLM issues `getVehicleLocation(plate="51A-12345")`.
> 3. Tool Router calls `GET /api/v1/vehicles/51A-12345/location` with the caller's tenant/site
>    injected. Backend returns `{slot: "B12", lastSeenAt: "09:35", snapshotId: "..."}`.
> 4. Guardrail filter passes the result through (no PII beyond the plate/slot, which the owner is
>    entitled to see).
> 5. LLM answers: **"Xe 51A-12345 đang ở ô B12, ghi nhận 09:35"** *("Your car 51A-12345 is in slot
>    B12, last recorded at 09:35")*.
> 6. Chat Service resolves the snapshot's signed URL and attaches the thumbnail alongside the text
>    answer.

## 9. Diagrams

- `diagrams/tool-calling-sequence.mmd` — full request path: user → LLM → tool router → internal API
  → guardrail → answer, using the worked example above.
- `diagrams/chatbot-architecture.mmd` — component view: chat service, prompt builder, guardrail
  middleware, pluggable LLM provider adapter, tool router, the 4 tools, and their data-plane targets.
- `diagrams/tool-data-source-map.mmd` — each tool mapped to its backend endpoint and the §4 domain
  entities it reads.

## 10. Decisions / ADRs

- `adr/ADR-1601-local-ollama-vs-hosted-llm.md` — default self-hosted Ollama (Qwen2.5/Llama 3.1),
  hosted Claude/OpenAI as a plan-gated opt-in.
- `adr/ADR-1602-tool-calling-tenant-scoped-apis.md` — tool-calling against existing tenant-scoped
  REST APIs instead of text-to-SQL or RAG-over-live-data.
- `adr/ADR-1603-chatbot-data-access-guardrails.md` — concrete enforcement: JWT-injected context,
  PII post-filter, entitlement-based rate limiting.

## 11. Open questions / risks

- Local model (Qwen2.5/Llama 3.1) tool-calling reliability is unproven at ParkVision's specific
  4-tool schema — needs a benchmark/eval harness before GA, not just a vendor claim.
- Vietnamese-language tool-calling and answer quality needs explicit evaluation; most open
  tool-calling benchmarks are English-centric.
- Prompt-injection / jailbreak resistance needs a dedicated red-team pass (attempt to leak
  cross-tenant data or unmask PII) before this ships to any tenant with sensitive data.
- GPU capacity planning for self-hosted Ollama at scale (many tenants, concurrent conversations) is
  unscoped — needs sizing once message-volume assumptions exist.
- Chatbot's Vietnamese TTS/voice mode is out of scope for v1 (contrast: the existing gate kiosk at
  `/gate/[gateId]` already has Web Speech TTS vi-VN per §1 — a natural future extension, not
  committed here).

## 12. Cross-references

- `04_Multi_Tenant_Design` — tenant isolation model (RLS, `tenant_id`/`site_id`) this chatbot's
  guardrails depend on.
- `05_Subscription_Billing` — `Plan`/`UsageRecord` entitlements that drive chatbot rate limits.
- `06_User_RBAC` — role set (`PLATFORM_ADMIN`/`TENANT_ADMIN`/`MEMBER`) used by the PII post-filter.
- `17_Dashboard` — embeds the chat widget; see its notifications center for alert-triggered chat
  entry points.
- `18_Mobile_App` — embeds the chat sheet as one of the core driver-facing flows.
- `12_Vehicle_Relocation_Detection` — source of `VehicleRelocated` events the chatbot can be asked
  about via `getHistory()`.
