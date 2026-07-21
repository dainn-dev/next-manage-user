# Docker Deployment Guide

Hướng dẫn triển khai hệ thống Vehicle Management với Docker Compose.

## Yêu cầu

- Docker Engine 20.10+
- Docker Compose 2.0+
- 4GB RAM khả dụng
- 10GB disk space

## Kiến trúc

Docker Compose khởi động 5 services:

1. **postgres** — PostgreSQL 15 với PostGIS extension
2. **minio** — S3-compatible object storage cho ảnh camera
3. **minio-init** — Tự động tạo bucket khi khởi động
4. **backend** — Spring Boot API (port 8080)
5. **frontend** — Next.js web app (port 3000)

## Cấu hình nhanh

### 1. Tạo file `.env`

```bash
cp .env.example .env
```

### 2. Thiết lập các biến môi trường bắt buộc

```bash
# JWT secrets (REQUIRED - must be set)
export JWT_SECRET=$(openssl rand -base64 32)
export PASSWORD_RESET_FINGERPRINT_SECRET=$(openssl rand -base64 32)

# MinIO credentials (optional - defaults to minioadmin/minioadmin)
export OBJECT_STORAGE_ACCESS_KEY=minioadmin
export OBJECT_STORAGE_SECRET_KEY=minioadmin

# Database password (optional - defaults to password)
export SPRING_DATASOURCE_PASSWORD=password
```

Hoặc thêm vào file `.env`:

```env
JWT_SECRET=your-secret-key-here
PASSWORD_RESET_FINGERPRINT_SECRET=your-reset-secret-here
OBJECT_STORAGE_ACCESS_KEY=minioadmin
OBJECT_STORAGE_SECRET_KEY=minioadmin
SPRING_DATASOURCE_PASSWORD=password
CORS_ALLOWED_ORIGINS=http://localhost:3000
```

### 3. Khởi động toàn bộ stack

```bash
docker-compose up -d
```

### 4. Kiểm tra trạng thái

```bash
docker-compose ps
```

Kết quả mong đợi — tất cả services ở trạng thái `healthy` hoặc `running`:

```
NAME                              STATUS
vehicle-management-backend        Up (healthy)
vehicle-management-db             Up (healthy)
vehicle-management-frontend       Up
vehicle-management-minio          Up (healthy)
vehicle-management-minio-init     Exited (0)
```

## Truy cập services

| Service | URL | Credentials |
|---------|-----|-------------|
| Frontend | http://localhost:3000 | (đăng ký tài khoản mới) |
| Backend API | http://localhost:8080/api | Bearer token từ login |
| MinIO Console | http://localhost:9001 | minioadmin / minioadmin |
| PostgreSQL | localhost:5432 | postgres / password |

## Khởi động từng phần

### Chỉ infrastructure (database + storage)

```bash
docker-compose up -d postgres minio minio-init
```

### Backend + infrastructure

```bash
docker-compose up -d postgres minio minio-init backend
```

### Chạy frontend ở local (development)

```bash
# Infrastructure + backend
docker-compose up -d postgres minio minio-init backend

# Frontend local dev
cd frontend
npm install
npm run dev
```

Frontend sẽ chạy ở http://localhost:3000 và connect tới backend container.

## Quản lý services

### Xem logs

```bash
# Tất cả services
docker-compose logs -f

# Chỉ backend
docker-compose logs -f backend

# Chỉ frontend
docker-compose logs -f frontend

# Chỉ MinIO
docker-compose logs -f minio
```

### Restart một service

```bash
docker-compose restart backend
docker-compose restart frontend
```

### Stop toàn bộ

```bash
docker-compose down
```

### Stop và xóa volumes (reset database + storage)

```bash
docker-compose down -v
```

⚠️ **Cảnh báo:** Lệnh này sẽ xóa tất cả dữ liệu trong database và MinIO storage!

### Rebuild images

```bash
# Rebuild tất cả
docker-compose build

# Rebuild chỉ backend
docker-compose build backend

# Rebuild và restart
docker-compose up -d --build
```

## Troubleshooting

### Backend không khởi động — "JWT_SECRET is required"

Lỗi này xảy ra khi chưa set biến môi trường JWT_SECRET.

**Giải pháp:**

```bash
export JWT_SECRET=$(openssl rand -base64 32)
export PASSWORD_RESET_FINGERPRINT_SECRET=$(openssl rand -base64 32)
docker-compose up -d backend
```

Hoặc thêm vào file `.env`.

### Backend báo lỗi "Unable to store source image"

Lỗi này xảy ra khi MinIO chưa sẵn sàng hoặc bucket chưa được tạo.

**Kiểm tra:**

```bash
# Xem MinIO status
docker-compose ps minio

# Xem logs của minio-init
docker-compose logs minio-init
```

**Giải pháp:**

```bash
# Restart minio-init để tạo lại bucket
docker-compose up -d minio-init

# Hoặc tạo bucket thủ công qua MinIO Console
# 1. Vào http://localhost:9001
# 2. Login: minioadmin / minioadmin
# 3. Tạo bucket: vehicle-management-snapshots
# 4. Set access policy: public (download)
```

### Frontend không connect được tới backend

**Kiểm tra:**

```bash
# Backend có chạy không?
curl http://localhost:8080/api/health

# CORS config đúng chưa?
docker-compose logs backend | grep CORS
```

**Giải pháp:**

Thêm vào `.env`:

```env
CORS_ALLOWED_ORIGINS=http://localhost:3000
```

Restart backend:

```bash
docker-compose restart backend
```

### Database connection refused

**Kiểm tra:**

```bash
# PostgreSQL có chạy không?
docker-compose ps postgres

# Test kết nối
docker-compose exec postgres psql -U postgres -d vehicle_management -c "SELECT 1;"
```

**Giải pháp:**

```bash
# Restart postgres
docker-compose restart postgres

# Nếu vẫn lỗi, xem logs
docker-compose logs postgres
```

### Port đã được sử dụng

Nếu thấy lỗi "port is already allocated":

```bash
# Kiểm tra process đang dùng port
sudo lsof -i :8080  # Backend
sudo lsof -i :3000  # Frontend
sudo lsof -i :5432  # PostgreSQL
sudo lsof -i :9000  # MinIO

# Dừng process hoặc đổi port trong docker-compose.yml
```

## Production deployment

Để deploy production, bạn cần:

1. **Đổi passwords mặc định:**

```env
SPRING_DATASOURCE_PASSWORD=<strong-password>
OBJECT_STORAGE_ACCESS_KEY=<strong-access-key>
OBJECT_STORAGE_SECRET_KEY=<strong-secret-key>
JWT_SECRET=<strong-jwt-secret>
```

2. **Tắt auto-registration và set GATE_API_KEY:**

```env
GATE_API_KEY=<your-gate-secret>
GATE_ALLOW_OPEN=false
```

3. **Cấu hình HTTPS reverse proxy** (nginx/traefik)

4. **Backup database định kỳ:**

```bash
# Manual backup
docker-compose exec postgres pg_dump -U postgres vehicle_management > backup.sql

# Restore
docker-compose exec -T postgres psql -U postgres vehicle_management < backup.sql
```

5. **Monitor logs và health checks**

## Volumes và data persistence

Dữ liệu được lưu trong Docker volumes:

- `postgres_data` — Database
- `minio_data` — Ảnh camera và parking map stills
- `file_storage` — Temporary files
- `csv_storage` — CSV exports

Backup volumes:

```bash
docker run --rm -v next-manage-user_postgres_data:/data -v $(pwd):/backup alpine \
  tar czf /backup/postgres_backup.tar.gz -C /data .

docker run --rm -v next-manage-user_minio_data:/data -v $(pwd):/backup alpine \
  tar czf /backup/minio_backup.tar.gz -C /data .
```

## Development workflow

### Hot reload backend

```bash
# Dừng backend container
docker-compose stop backend

# Chạy backend local với Maven
cd backend
mvn spring-boot:run
```

Backend local sẽ connect tới Postgres và MinIO trong containers.

### Hot reload frontend

```bash
# Dừng frontend container
docker-compose stop frontend

# Chạy frontend local
cd frontend
npm run dev
```

Frontend local sẽ connect tới backend container ở http://localhost:8080.

## Tài liệu tham khảo

- [Docker Compose docs](https://docs.docker.com/compose/)
- [MinIO docs](https://min.io/docs/minio/linux/index.html)
- [PostgreSQL docs](https://www.postgresql.org/docs/)
