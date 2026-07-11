# Architecture Decision Register — ParkVision

> **Status:** Draft · **Owner:** Principal Architect · **Last updated:** 2026-07-09

This register indexes every Architecture Decision Record (ADR) across the documentation set. ADRs
live inside each document's `adr/` folder. IDs follow the scheme `ADR-<NN><SS>` where `NN` is the
2-digit document number and `SS` is a per-document sequence — so every ID is globally unique.

All ADRs are **Proposed** (dated 2026-07-09) pending review. 48 ADRs across 22 documents.

| ADR | Title | Document |
|-----|-------|----------|
| [ADR-0001](../00_Vision/adr/ADR-0001-product-positioning.md) | Product positioning — vertical multi-tenant SaaS vs generic ANPR toolkit | 00_Vision |
| [ADR-0101](../01_Project_Overview/adr/ADR-0101-evolve-not-rewrite.md) | Evolve the existing system, don't rewrite | 01_Project_Overview |
| [ADR-0102](../01_Project_Overview/adr/ADR-0102-modular-monolith-architecture.md) | Modular monolith architecture style | 01_Project_Overview |
| [ADR-0301](../03_SaaS_Architecture/adr/ADR-0301-modular-monolith-strangler.md) | Modular monolith first, Strangler path to microservices | 03_SaaS_Architecture |
| [ADR-0302](../03_SaaS_Architecture/adr/ADR-0302-rabbitmq-outbox.md) | Introduce RabbitMQ event bus with transactional outbox | 03_SaaS_Architecture |
| [ADR-0303](../03_SaaS_Architecture/adr/ADR-0303-redis-cache-ws-scaleout.md) | Redis for cache and WebSocket scale-out | 03_SaaS_Architecture |
| [ADR-0401](../04_Multi_Tenant_Design/adr/ADR-0401-shared-schema-rls.md) | Shared-schema + RLS vs schema-per-tenant vs DB-per-tenant | 04_Multi_Tenant_Design |
| [ADR-0402](../04_Multi_Tenant_Design/adr/ADR-0402-tenant-context-propagation.md) | Tenant context propagation via JWT claim + RLS session variable | 04_Multi_Tenant_Design |
| [ADR-0501](../05_Subscription_Billing/adr/ADR-0501-stripe-vs-byo.md) | Stripe Billing vs build-your-own | 05_Subscription_Billing |
| [ADR-0502](../05_Subscription_Billing/adr/ADR-0502-usage-metering-event-stream.md) | Usage metering via event stream vs periodic aggregation | 05_Subscription_Billing |
| [ADR-0601](../06_User_RBAC/adr/ADR-0601-custom-jwt-now-oidc-later.md) | Keep custom JWT now, optional OIDC/Keycloak later | 06_User_RBAC |
| [ADR-0602](../06_User_RBAC/adr/ADR-0602-edge-camera-credential-model.md) | Edge/camera credential model — per-camera key with rotation | 06_User_RBAC |
| [ADR-0603](../06_User_RBAC/adr/ADR-0603-platform-member-and-affiliation.md) | Platform MEMBER consumer + multi-org affiliation | 06_User_RBAC |
| [ADR-0604](../06_User_RBAC/adr/ADR-0604-platform-vehicle-and-tenant-registration.md) | Platform vehicle + tenant registration; retail visit-only + QR find-car | 06_User_RBAC |
| [ADR-0701](../07_Camera_Management/adr/ADR-0701-live-view-transport.md) | Live-view transport (WebRTC vs HLS vs MJPEG) | 07_Camera_Management |
| [ADR-0702](../07_Camera_Management/adr/ADR-0702-edge-camera-worker-model.md) | One-process-per-camera vs multi-stream worker pool | 07_Camera_Management |
| [ADR-0801](../08_Parking_Map_Designer/adr/ADR-0801-polygon-storage.md) | Polygon storage as PostGIS geometry vs JSON | 08_Parking_Map_Designer |
| [ADR-0802](../08_Parking_Map_Designer/adr/ADR-0802-editor-build-vs-library.md) | SVG/Canvas polygon editor — build vs adopt a library | 08_Parking_Map_Designer |
| [ADR-0901](../09_AI_Calibration/adr/ADR-0901-calibration-source-of-truth.md) | Where calibration lives (edge vs central backend) and versioning | 09_AI_Calibration |
| [ADR-1001](../10_AI_Pipeline/adr/ADR-1001-ocr-engine-selection.md) | OCR engine selection — PaddleOCR vs YOLOv5-char vs EasyOCR/VietOCR | 10_AI_Pipeline |
| [ADR-1002](../10_AI_Pipeline/adr/ADR-1002-yolov11-vehicle-detection-motion-gating.md) | Add YOLOv11 vehicle detection with motion-gating | 10_AI_Pipeline |
| [ADR-1003](../10_AI_Pipeline/adr/ADR-1003-edge-model-packaging-ota.md) | Edge model packaging and OTA update strategy | 10_AI_Pipeline |
| [ADR-1101](../11_Parking_Slot_Detection/adr/ADR-1101-slot-mapping-location.md) | Where parking-slot mapping runs — on-edge vs backend PostGIS | 11_Parking_Slot_Detection |
| [ADR-1201](../12_Vehicle_Relocation/adr/ADR-1201-relocation-identity-key.md) | Relocation identity key — track_id vs plate vs both, dedup window | 12_Vehicle_Relocation |
| [ADR-1301](../13_Event_Driven_Architecture/adr/ADR-1301-rabbitmq-vs-kafka-vs-redis-streams.md) | RabbitMQ vs Kafka vs Redis Streams | 13_Event_Driven_Architecture |
| [ADR-1302](../13_Event_Driven_Architecture/adr/ADR-1302-transactional-outbox-vs-dual-write.md) | Transactional outbox vs dual-write | 13_Event_Driven_Architecture |
| [ADR-1303](../13_Event_Driven_Architecture/adr/ADR-1303-event-schema-versioning-registry.md) | Event schema and versioning strategy | 13_Event_Driven_Architecture |
| [ADR-1401](../14_Backend_API/adr/ADR-1401-api-versioning-strategy.md) | API versioning — /api/v1 + additive evolution, legacy /api kept | 14_Backend_API |
| [ADR-1402](../14_Backend_API/adr/ADR-1402-ingest-idempotency-backpressure.md) | Ingest API idempotency and backpressure | 14_Backend_API |
| [ADR-1501](../15_Database_Design/adr/ADR-1501-uuid-pks-tenant-id-everywhere.md) | Keep UUID PKs; add tenant_id to every tenant-owned table | 15_Database_Design |
| [ADR-1502](../15_Database_Design/adr/ADR-1502-postgis-slot-geometry.md) | PostGIS for parking-slot geometry | 15_Database_Design |
| [ADR-1503](../15_Database_Design/adr/ADR-1503-time-partitioning-parking-event.md) | Time-partition ParkingEvent (native Postgres now, TimescaleDB later) | 15_Database_Design |
| [ADR-1504](../15_Database_Design/adr/ADR-1504-stop-ddl-auto-migration-only.md) | Stop ddl-auto:update — migration-only schema management | 15_Database_Design |
| [ADR-1601](../16_AI_Chatbot/adr/ADR-1601-local-ollama-vs-hosted-llm.md) | Default to local Ollama, offer hosted LLM as an opt-in | 16_AI_Chatbot |
| [ADR-1602](../16_AI_Chatbot/adr/ADR-1602-tool-calling-tenant-scoped-apis.md) | Tool-calling against tenant-scoped internal APIs | 16_AI_Chatbot |
| [ADR-1603](../16_AI_Chatbot/adr/ADR-1603-chatbot-data-access-guardrails.md) | Chatbot data-access guardrails — tenant injection, PII, rate limits | 16_AI_Chatbot |
| [ADR-1701](../17_Dashboard/adr/ADR-1701-fetch-context-vs-react-query.md) | Keep fetch + Context now; adopt react-query at scale | 17_Dashboard |
| [ADR-1702](../17_Dashboard/adr/ADR-1702-parking-map-render-approach.md) | Parking map renders via SVG overlay driven by the designer | 17_Dashboard |
| [ADR-1801](../18_Mobile_App/adr/ADR-1801-react-native-expo-vs-pwa-vs-native.md) | React Native (Expo) for the driver/owner mobile app | 18_Mobile_App |
| [ADR-1802](../18_Mobile_App/adr/ADR-1802-push-delivery-token-management.md) | Push delivery via FCM/APNs with backend-owned token lifecycle | 18_Mobile_App |
| [ADR-1901](../19_Notification/adr/ADR-1901-notification-delivery-architecture.md) | Notification delivery (event-bus consumer + channel adapters) | 19_Notification |
| [ADR-1902](../19_Notification/adr/ADR-1902-push-provider-multichannel-fanout.md) | Push provider & multi-channel fan-out with per-user preferences | 19_Notification |
| [ADR-2001](../20_Analytics/adr/ADR-2001-analytics-projections-vs-oltp.md) | Analytics via event-stream projections vs querying OLTP | 20_Analytics |
| [ADR-2002](../20_Analytics/adr/ADR-2002-time-series-store-choice.md) | Time-series store (Postgres partitioning now, TimescaleDB later) | 20_Analytics |
| [ADR-2101](../21_Deployment/adr/ADR-2101-kubernetes-for-prod.md) | Kubernetes for prod vs compose/swarm | 21_Deployment |
| [ADR-2102](../21_Deployment/adr/ADR-2102-object-storage-minio-s3.md) | Object storage MinIO/S3 for snapshots vs local disk | 21_Deployment |
| [ADR-2103](../21_Deployment/adr/ADR-2103-managed-vs-selfhosted-stateful-services.md) | Managed vs self-hosted stateful services | 21_Deployment |
| [ADR-2201](../22_Testing/adr/ADR-2201-testcontainers-integration-testing.md) | Testcontainers-based integration testing | 22_Testing |
| [ADR-2202](../22_Testing/adr/ADR-2202-ai-model-evaluation-harness.md) | AI model evaluation harness & acceptance thresholds | 22_Testing |
| [ADR-2401](../24_Future_Features/adr/ADR-2401-franchise-reseller-tenancy-model.md) | Franchise / reseller multi-level tenancy model | 24_Future_Features |

## Conventions

- **Statuses:** Proposed → Accepted → Superseded/Deprecated. Update the ADR's `Status` line when a
  decision is ratified or replaced; note the superseding ADR id.
- New ADRs go in the relevant document's `adr/` folder using the next `ADR-<NN><SS>` sequence and
  are added as a row here.
