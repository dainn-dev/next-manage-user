# ADR-2102: Object storage MinIO/S3 for snapshots vs local disk

- Status: Proposed
- Date: 2026-07-09
- Deciders: Principal Architect
- Context doc: 21_Deployment

## Context

Today, evidence snapshots (`VehicleLog.imagePath`, `Vehicle.imagePath`) are stored on **local
disk** at `uploads/snapshots` and served by the backend at `/uploads/**` (brief §1). In
`docker-compose.yml` this is backed by named Docker volumes (`file_storage`, `csv_storage`) local
to the single Docker host; the edge's offline queue additionally stores snapshot bytes as a BLOB
inside the SQLite store-and-forward queue while offline (brief §1). This works for a single-host,
single-tenant deployment where the backend always runs on the same machine with the same disk.
It does not work once the backend runs as multiple **Kubernetes pods behind a Deployment**
(ADR-2101): pod-local disk is ephemeral and not shared across replicas, so a snapshot written by
one pod would be invisible to a request served by another pod, and pod rescheduling would lose
data entirely without a persistent volume attached to every replica.

## Decision

Move snapshot storage (and other binary artifacts — exported reports, chatbot-retrieved
attachments) to **S3-compatible object storage**: **MinIO** self-hosted for dev/on-prem
deployments and as the default in Kubernetes, with the option to point at a managed **S3**
(or GCS/Azure Blob via S3-compatible gateway) in cloud production deployments. Concretely:

- The backend's snapshot-write path changes from `File.write(uploads/snapshots/...)` to an S3
  client call (bucket per environment, key prefixed by `tenant_id/site_id/...` for isolation and
  lifecycle policies), returning an `object_url` stored on the `Snapshot` entity (brief §4)
  instead of a local path.
- **Local disk remains supported for dev only** — the dev Docker Compose topology
  (`21_Deployment` diagram) adds a MinIO service alongside Postgres so the dev environment
  exercises the real code path (S3 API) without needing cloud credentials, rather than branching
  application logic between "disk mode" and "S3 mode."
- Camera-event ingestion uses a backend server-side S3 PUT: the edge sends its snapshot in the
  authenticated multipart ingest request, the backend writes a tenant/camera-scoped object key,
  and the event stores that key rather than image bytes or a public URL. This keeps storage
  credentials off edge devices and preserves the current device-facing API.
- Presigned URLs are used for the frontend/mobile app to fetch snapshots directly from object
  storage rather than proxying every image byte through the backend. A future retrieval endpoint
  resolves the stored object key and issues a short-lived presigned GET after authorization.
- Retention/lifecycle policies (tied to billing-plan retention days, brief §3.10) are enforced via
  bucket lifecycle rules where possible, reducing custom cleanup-job code.

## Alternatives considered

- **S3-compatible object storage (MinIO self-hosted / S3 managed)** (chosen).
  - Pros: works identically whether the backend runs as 1 pod or 50; MinIO gives an
    S3-API-compatible on-prem option (useful for tenants with data-residency requirements) while
    still allowing a swap to managed S3/GCS/Azure Blob in cloud regions without changing
    application code (same S3 API); natural fit for presigned-URL delivery, offloading bandwidth
    from the backend; lifecycle policies handle retention cheaply.
  - Cons: another stateful service to operate (or another vendor bill, if managed); requires
    migrating the existing local-disk snapshot path and updating both backend write code and any
    place that assumes `/uploads/**` is servable directly from the backend process.

- **Shared network filesystem (NFS / a `ReadWriteMany` PersistentVolume) mounted into every pod,
  keeping today's local-disk code path unchanged.**
  - Pros: minimal code change — the backend keeps writing to a path, just a network-backed one.
  - Cons: `ReadWriteMany` volumes are a known operational pain point on most managed Kubernetes
    (cloud-provider CSI drivers often don't support RWX, or only via a slower NFS-backed class);
    no natural presigned-URL/CDN story; scales worse than object storage for concurrent
    multi-tenant write load; rejected as a worse fit for the cloud-K8s target than migrating to a
    proper object store.

- **Keep local disk per pod, accept snapshot loss on pod rescheduling / route all snapshot
  requests to a single "sticky" backend replica.**
  - Pros: zero migration effort.
  - Cons: directly contradicts the horizontal-scale-out goal of ADR-2101 (either you lose data on
    reschedule, or you defeat autoscaling by pinning snapshot traffic to one replica); snapshots
    are evidence data (gate-access audit trail today, relocation/dispute evidence in the target
    vision) — losing them on a routine pod reschedule is not acceptable; rejected.

## Consequences

- Positive: snapshot storage becomes stateless-pod-safe, a prerequisite for ADR-2101's
  Deployment/HPA model; presigned URLs reduce backend bandwidth load; retention-by-plan
  (brief §3.10) gets a natural enforcement point via bucket lifecycle rules; MinIO gives on-prem/
  data-residency-sensitive tenants a deployable option without a separate code path.
- Negative / trade-offs: existing local-disk snapshot code (`uploads/snapshots`, `/uploads/**`)
  needs a real migration (data + code), not just new-code-goes-to-S3; adds an object-storage
  dependency to every environment including dev (mitigated — MinIO in dev Compose is
  lightweight); presigned URLs need short expiry + tenant-scoped key design to avoid leaking
  cross-tenant snapshot access.
- Follow-ups: bucket/key naming convention and lifecycle policy definitions are implementation
  tickets; the edge's SQLite offline-queue BLOB storage (brief §1, "keep & extend this") is
  unaffected by this ADR — it remains a local durability buffer until the event is successfully
  forwarded, at which point the snapshot lands in object storage via the normal ingest path.
