# ADR-1601: Default to local Ollama, offer hosted LLM as an opt-in

- Status: Proposed
- Date: 2026-07-09
- Deciders: Principal Architect
- Context doc: 16_AI_Chatbot

## Context

ParkVision's chatbot answers questions grounded in operationally sensitive, tenant-specific data:
license plates, precise timestamps, slot locations, and camera snapshots (all PII/PHI-adjacent
under most privacy regimes). Today's codebase has no LLM integration at all — this is a greenfield
decision. Tenants range from small single-site operators (cost-sensitive) to enterprise chains that
may require data residency guarantees or on-prem deployment (per §3.14, edge already runs on-site
and connects outbound only, signalling this is a security-conscious customer base). The platform
also needs the LLM to reliably perform tool-calling against a fixed 4-function schema
(`getVehicleLocation`, `getHistory`, `getSnapshot`, `getParkingStatus`), not open-ended generation.

## Decision

Ship a pluggable **LLM Provider Adapter** interface (`ChatProvider`) with two implementations:

1. **Ollama (default, self-hosted)** running an open tool-calling-capable model — **Qwen2.5** or
   **Llama 3.1** — deployed inside the platform's own VPC/cluster (not per-tenant, not on tenant
   premises). This is the default for every plan tier.
2. **Hosted LLM (optional)** — Claude or OpenAI via their API — available as a plan-gated opt-in
   for tenants who want higher-quality reasoning and explicitly consent to sending prompt context
   (which includes plate numbers and slot data) to a third-party API.

Provider selection is a per-tenant configuration flag, checked by the Chat Service before every
conversation turn; it never changes mid-conversation.

## Alternatives considered

- **Hosted-only (Claude/OpenAI for everyone)** — pros: best-in-class tool-calling accuracy and
  reasoning, zero GPU infra to operate; cons: per-token cost scales with every tenant's chat volume,
  tenant PII (plates, timestamps, locations) leaves the VPC on every message, harder data-residency
  story for enterprise/government-adjacent tenants, vendor lock-in.
- **Local-only (Ollama for everyone, no hosted option)** — pros: full data residency, flat
  infrastructure cost regardless of message volume, no per-tenant consent needed; cons: quality
  ceiling on tool-calling reliability and complex multi-turn reasoning versus frontier hosted
  models, the platform now owns GPU capacity planning and model upgrades.
- **Per-tenant self-hosted (tenant runs their own Ollama)** — pros: maximal data residency; cons:
  operationally unrealistic for SMB tenants, fragments support/on-call burden, rejected for v1.

## Consequences

- Positive: predictable infrastructure cost baseline (no linear cost-per-tenant-message on the
  default path); tenant data stays inside the platform's VPC by default; enterprise tenants get an
  upgrade path without an architecture change.
- Negative / trade-offs: the platform must operate and scale GPU inference (Ollama) as a first-class
  service, including model upgrades and an eval harness to catch tool-calling regressions; local
  model tool-calling accuracy needs to be benchmarked and may require prompt/tool-schema tuning that
  frontier hosted models would not need.
- Follow-ups: benchmark Qwen2.5 vs Llama 3.1 specifically on the 4-tool schema before GA; define
  the consent/opt-in flow and data-processing addendum for the hosted path; consider a
  confidence-based fallback (local model escalates to hosted on low tool-call confidence) as a v2.
