# ADR-0301: Modular Monolith First, Strangler Path to Microservices

- Status: Proposed
- Date: 2026-07-09
- Deciders: Principal Architect
- Context doc: 03_SaaS_Architecture

## Context

Today's backend (`backend/`, package `com.vehiclemanagement`) is a single Spring Boot 3.2 /
Java 17 application on Jetty, one Postgres database, no message bus, no service mesh. It has
8 entities and ~10 controllers serving one tenant. The target vision adds nine capability
areas (tenancy, billing, AI ingest, event bus, chatbot, notification, analytics, parking,
IAM) on top of this. Rewriting as microservices from day one would multiply operational
surface (service discovery, distributed tracing, N deployment pipelines, cross-service
transactions) before there is production load or team size to justify it. The team must also
keep shipping the existing single-tenant gate-access flow without a big-bang rewrite.

## Decision

Restructure the existing Spring Boot application into a **modular monolith**: one deployable
JAR/container, but code is organized into packages with enforced boundaries —
`iam`, `tenancy`, `billing`, `parking`, `ai-ingest`, `events`, `chatbot`, `notification`,
`analytics`. Each module owns its own JPA entities/repositories and exposes a narrow
package-private (or `internal`) service interface to other modules; cross-module calls go
through these interfaces, never through direct repository access into another module's
tables. Today's 8 entities map into `parking` (Vehicle, VehicleLog, Gate, Employee,
Department, Position, VehicleAccessRequest) and `iam` (User). New modules are added as the
vision entities land (§4 of the shared brief). Only extract a module into its own deployable
service when a concrete load or team-ownership justification exists (first candidates:
`ai-ingest` for GPU/throughput isolation, `analytics` for heavy read workloads) — this is the
Strangler Fig pattern applied at the module level before it is applied at the deployment level.

## Alternatives considered

- **Microservices from day one** — pros: independent scaling/deploys, clear team ownership;
  cons: massive upfront operational cost (service mesh, distributed transactions, N CI/CD
  pipelines) for a team that hasn't validated the domain boundaries yet; today's single
  8-entity app gives no evidence of where real service seams are.
- **Keep current unstructured single-package app and grow organically** — pros: zero
  refactor cost now; cons: package `com.vehiclemanagement` already mixes concerns; without
  enforced module boundaries the codebase becomes a "big ball of mud" long before
  multi-tenancy, billing, and AI ingest are all added, making a later split far more
  expensive.
- **Modular monolith with Strangler extraction (chosen)** — pros: one deployable to reason
  about now, enforced seams make future extraction mechanical, matches existing Spring Boot
  investment; cons: requires discipline (build-time module boundary checks) to not regress
  into a ball of mud; shared DB across modules still requires care (see ADR-0401).

## Consequences

- Positive: incremental delivery — the existing gate-access flow keeps working as a subset
  of `parking` throughout the migration; one CI/CD pipeline, one deployment unit until a
  module genuinely needs to scale independently; module boundaries double as the future
  microservice boundaries, reducing rewrite risk later.
- Negative / trade-offs: shared database is a coupling point until schema/module ownership
  is fully partitioned (see ADR-0401 for the tenancy-side data model); without tooling
  (e.g. ArchUnit or Java Modules) boundaries can erode silently; a single large deployable
  means one module's memory/GC pressure (e.g. `ai-ingest` under burst load) can affect others
  until it is extracted.
- Follow-ups: add an ArchUnit (or Spring Modulith) test suite that fails the build on
  cross-module repository access; define the extraction criteria (p95 latency, deploy
  cadence mismatch, or team size) that trigger pulling `ai-ingest`/`analytics` into separate
  services; revisit this ADR once the first module is extracted.
