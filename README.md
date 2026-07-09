# Vision License Plate — Vehicle Management System

A monorepo for a license-plate-based vehicle access system: a web admin app, a REST API,
and an edge detector that reads plates from cameras and checks them against the gate.

## Repository layout

```
.
├── frontend/     Next.js 14 admin UI (React, Tailwind, shadcn/ui)
├── backend/      Spring Boot 3 / Java 17 REST API + Postgres (Flyway migrations)
├── windows/      Python edge app — YOLOv5 plate detection/OCR, calls the gate API
├── docker-compose.yml        Full local stack: postgres + backend + frontend
├── docker-compose.dev.yml    Dev variant (init SQL, named volumes)
├── docker-compose-image.yml  Run prebuilt images (no local build)
└── docs / *.md   Deployment, environment, and roles notes
```

> The web app used to live at the repository root; it now lives under `frontend/`.
> The `@/*` import alias is unchanged (relative to `frontend/`), so imports are unaffected.

## Quick start

### Everything via Docker (recommended)

```bash
cp sample.env .env            # then set JWT_SECRET (required) and any GATE_API_KEY
docker compose up --build     # postgres :5432, backend :8080, frontend :3000
```

Open http://localhost:3000. See `UPDATED_CREDENTIALS.md` for the role model and how the
default accounts are seeded (no passwords are committed to this repo).

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
cd windows
pip install -r requirement.txt
cp config.example.json config.json   # set API base_url, gate_key, and camera/RTSP sources
python run_edge.py
```

## Documentation

- `DOCKER_DEPLOYMENT.md` — container build & deployment.
- `ENVIRONMENT_SETUP.md` — environment variables and local setup.
- `UPDATED_CREDENTIALS.md` — role model and default-account handling.

## Ports

| Service  | Port | Notes |
|----------|------|-------|
| Frontend | 3000 | Next.js |
| Backend  | 8080 | REST API under `/api`, WebSocket for live updates |
| Postgres | 5432 | database `vehicle_management` |
