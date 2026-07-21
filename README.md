# Vision License Plate — Vehicle Management System

A monorepo for a license-plate-based vehicle access system: a web admin app, a REST API,
and an edge detector that reads plates from cameras and checks them against the gate.

## Repository layout

```
.
├── frontend/     Next.js 14 admin UI (React, Tailwind, shadcn/ui)
├── backend/      Spring Boot 3 / Java 25 REST API + Postgres (Flyway migrations)
├── edge/         Python edge app — YOLOv5 plate detection/OCR, calls the gate API
├── docker-compose.yml        Canonical local stack: postgres + backend + frontend
├── deploy/       Deployment helpers
│   ├── docker-compose.dev.yml    Dev variant (init SQL, named volumes)
│   ├── docker-compose-image.yml  Run prebuilt images (no local build)
│   └── docker-build-push.*, build-and-run-dev.*   Build/push & dev-up scripts
└── docs/         Deployment, environment, and roles notes
```

> The web app used to live at the repository root; it now lives under `frontend/`.
> The `@/*` import alias is unchanged (relative to `frontend/`), so imports are unaffected.

## Quick start

### Everything via Docker (recommended)

```bash
cp sample.env .env            # then set JWT_SECRET (required) and any GATE_API_KEY
docker compose up --build     # postgres :5432, backend :8080, frontend :3000
```

Open http://localhost:3000. Sample login accounts for local testing are below; role details
live in [`docs/UPDATED_CREDENTIALS.md`](docs/UPDATED_CREDENTIALS.md) and [`docs/06_User_RBAC`](docs/06_User_RBAC/README.md).

### Sample accounts (local / testing)

Seeded only when the DB is empty and `app.seed-demo-users=true` (default in local
`DataSeederService`). **Dev/test only — do not use in production.**

| Username | Password | Role | Notes |
|----------|----------|------|-------|
| `admin` | `SecurePass123!` | `PLATFORM_ADMIN` | Platform console (`/platform/*`). `tenant_id` NULL. Email: `admin@vehiclemanagement.com` |
| `user` | `UserPass123!` | `MEMBER` | Platform consumer. `tenant_id` NULL; affiliated to the DEFAULT tenant. Email: `user@vehiclemanagement.com` |

Not auto-seeded (create as needed for multi-role testing):

| How | Role | Typical password in e2e |
|-----|------|-------------------------|
| `POST /api/auth/register` (public org signup) | `TENANT_ADMIN` | `SecurePass123!` |
| TA creates user with role `SITE_MANAGER` + `siteIds` | `SITE_MANAGER` | `SecurePass123!` |
| TA `POST /api/member-affiliations/invite` | `MEMBER` (+ affiliation) | chosen at invite |

Optional Flyway bootstrap (only if both env vars are set): username `platform_admin` via
`PLATFORM_ADMIN_EMAIL` + `PLATFORM_ADMIN_PASSWORD_HASH` (V42). Gate/edge calls use
`GATE_API_KEY` as header `X-Gate-Key` (open if unset in local dev).

### Frontend only (local dev)

```bash
cd frontend
pnpm install
pnpm dev                      # http://localhost:3000
```

Copy `../.env.example` to `frontend/.env.local` and point `NEXT_PUBLIC_API_URL` at the backend.

### Backend only (local dev)

```bash
cd backend
mvn spring-boot:run           # http://localhost:8080/api  (needs a running Postgres)
```

Configuration lives in `backend/src/main/resources/application.yml`; DB schema is managed by
Flyway migrations under `backend/src/main/resources/db/migration/`.

### Edge detector

```bash
cd edge
pip install -r requirement.txt
cp config.example.json config.json   # set API base_url, gate_key, and camera/RTSP sources
python run_edge.py
```

`edge/config.json` holds runtime secrets (auth cookies / gate key) and is gitignored — only
`config.example.json` is committed.

## Documentation

- **[DOCKER.md](DOCKER.md)** — **Docker Compose setup guide** (PostgreSQL, MinIO, Backend, Frontend)
- `docs/DOCKER_DEPLOYMENT.md` — container build & deployment.
- `docs/ENVIRONMENT_SETUP.md` — environment variables and local setup.
- `docs/UPDATED_CREDENTIALS.md` — roles + sample testing accounts.
- `docs/06_User_RBAC/README.md` — RBAC matrix, MEMBER affiliation, JWT claims.

## Deployment helpers (`deploy/`)

- `deploy/build-and-run-dev.sh` / `.bat` — build & start the dev stack (`docker-compose.dev.yml`).
- `deploy/docker-build-push.sh` / `.bat` — build and push frontend/backend images to Docker Hub.
- `deploy/docker-compose-image.yml` — run prebuilt images without a local build.

## Ports

| Service  | Port | Notes |
|----------|------|-------|
| Frontend | 3000 | Next.js |
| Backend  | 8080 | REST API under `/api`, WebSocket for live updates |
| Postgres | 5432 | database `vehicle_management` |
| MinIO    | 9000 | S3-compatible object storage (API) |
| MinIO Console | 9001 | Web UI for bucket management |
