# System-wide diagrams

> **Status:** Draft · **Owner:** Principal Architect · **Last updated:** 2026-07-09

Cross-cutting Mermaid v11 diagrams that tie the whole platform together. Each document folder also
carries its own topic-specific diagrams under `NN_Title/diagrams/`.

| File | Type | Shows |
|------|------|-------|
| [saas-architecture.mmd](./saas-architecture.mmd) | flowchart | Container view: edge, cloud modular monolith, RabbitMQ/Redis/Postgres/object-store/LLM, clients |
| [ai-pipeline.mmd](./ai-pipeline.mmd) | flowchart | End-to-end edge AI pipeline, marking today vs NEW stages |
| [event-driven.mmd](./event-driven.mmd) | flowchart | Outbox → RabbitMQ topic exchange → consumer queues + DLQ |
| [erd-overview.mmd](./erd-overview.mmd) | erDiagram | High-level target data model (tenant/site/slot/vehicle/event) |
| [kubernetes-architecture.mmd](./kubernetes-architecture.mmd) | flowchart | Production Kubernetes topology |
| [business-flow-overview.mmd](./business-flow-overview.mmd) | sequenceDiagram | Entry → relocation → notification → chatbot, end to end |

## Rendering

These are plain Mermaid source files. Render with the Mermaid CLI:

```bash
npx -y @mermaid-js/mermaid-cli -i diagrams/saas-architecture.mmd -o out.svg
```

or paste into any Mermaid-aware viewer (mermaid.live, GitHub, VS Code Mermaid preview). GitHub also
renders ```` ```mermaid ```` fenced blocks inline inside the document READMEs.

The full diagram inventory spans **88 Mermaid files** — 6 here plus 82 across the 25 document
folders (see each document's *Diagrams* section).
