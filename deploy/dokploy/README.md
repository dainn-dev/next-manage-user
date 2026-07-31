# Deploy via Dokploy

Deploy the Vehicle Management stack (backend + frontend + Postgres + MinIO) from
this git repository using Dokploy's Docker Compose service.

## Files

- `deploy/dokploy/docker-compose.yml` — compose stack that builds `backend/` and
  `frontend/` from source, wires them to `dokploy-network`, and exposes them via
  Traefik with HTTPS.
- `frontend/Dockerfile` — accepts `NEXT_PUBLIC_API_URL` / `NEXT_PUBLIC_GATE_API_KEY`
  build args (Next.js inlines them at build time).
- `.dockerignore` — keeps the frontend build context (repo root) small.

## Setup in the Dokploy web UI

1. Create a **Project** and add a new **Service** of type **Compose**.
2. Compose Type: **Docker Compose**.
3. Source: your git provider (GitHub/GitLab/Gitea) and the repository + branch
   containing this project.
4. **Compose Path**: `./deploy/dokploy/docker-compose.yml`.
5. In the **Environment** tab, set at minimum:

   ```env
   VM_DOMAIN=vm.example.com                     # frontend domain
   API_DOMAIN=api.example.com                   # backend domain
   JWT_SECRET=<openssl rand -base64 32>
   PASSWORD_RESET_FINGERPRINT_SECRET=<openssl rand -base64 32>
   CORS_ALLOWED_ORIGINS=https://vm.example.com
   NEXT_PUBLIC_API_URL=https://api.example.com
   ```

   Optional: `POSTGRES_PASSWORD`, `OBJECT_STORAGE_ACCESS_KEY`,
   `OBJECT_STORAGE_SECRET_KEY`, `GATE_API_KEY`, `NEXT_PUBLIC_GATE_API_KEY`,
   `JWT_EXPIRATION`.

   Point `*.example.com` A/AAAA records (or a wildcard) at the server. Use the
   Dokploy **Domains** tab instead if you prefer managing Traefik there.
6. Deploy. Dokploy clones the repo and runs:

   ```bash
   docker compose -f deploy/dokploy/docker-compose.yml up -d --build
   ```

   Build contexts in the Compose file are relative to its location under
   `deploy/dokploy/`: `../../backend` selects the backend project and `../..`
   selects the repository root for the frontend build.

## Result

| Service  | URL                                     |
|----------|-----------------------------------------|
| Frontend | `https://vm.example.com`                |
| Backend  | `https://api.example.com/api`           |
| MinIO    | internal (only reachable on the server) |

Data is persisted in the `postgres_data`, `minio_data`, `file_storage` and
`csv_storage` volumes.

## Notes

- Do **not** set `container_name` in the compose file — Dokploy manages container
  names (logs/metrics/domains break otherwise).
- `NEXT_PUBLIC_*` values are baked into the frontend bundle at build time, so a
  change to `NEXT_PUBLIC_API_URL` requires a fresh deployment (not just a restart).
- The stack is re-created on every deployment (`--force-recreate`), so it is safe
  to redeploy after pushing new code.
