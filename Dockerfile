# Multi-stage build for both frontend and backend
FROM node:18-alpine AS frontend-builder

# Set working directory for frontend
WORKDIR /app/frontend

# Copy frontend package files
COPY package.json pnpm-lock.yaml ./

# Install pnpm and dependencies
RUN npm install -g pnpm && pnpm install --frozen-lockfile

# Copy frontend source code
COPY . .

# Build the frontend
RUN pnpm build

# Backend build stage
FROM maven:3.8.4-openjdk-17 AS backend-builder

# Set working directory for backend
WORKDIR /app/backend

# Copy backend pom.xml first for better caching
COPY backend/pom.xml ./

# Download dependencies
RUN mvn dependency:go-offline -B

# Copy backend source code
COPY backend/src ./src

# Build the backend
RUN mvn clean package -DskipTests

# Final runtime stage
FROM openjdk:17-jdk-slim

WORKDIR /app

# Install nginx and other required packages
RUN apt-get update && \
    apt-get install -y nginx wget && \
    rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd -g 1001 appuser && useradd -r -u 1001 -g appuser appuser

# Copy built frontend from frontend-builder stage
COPY --from=frontend-builder /app/frontend/.next/standalone ./
COPY --from=frontend-builder /app/frontend/.next/static ./.next/static
COPY --from=frontend-builder /app/frontend/public ./public

# Copy built backend JAR from backend-builder stage
COPY --from=backend-builder /app/backend/target/vehicle-management-api-0.0.1-SNAPSHOT.jar ./app.jar

# Create directories for file operations
RUN mkdir -p /app/temp /app/csv /var/log/nginx

# Configure nginx to serve frontend and proxy backend
RUN echo 'server { \
    listen 80; \
    server_name localhost; \
    \
    # Increase client max body size for large file uploads \
    client_max_body_size 50M; \
    client_body_timeout 60s; \
    client_header_timeout 60s; \
    \
    # Serve frontend static files \
    location / { \
        root /app; \
        try_files $uri $uri/ /index.html; \
    } \
    \
    # Proxy API requests to backend \
    location /api/ { \
        proxy_pass http://localhost:8080; \
        proxy_set_header Host $host; \
        proxy_set_header X-Real-IP $remote_addr; \
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; \
        proxy_set_header X-Forwarded-Proto $scheme; \
        proxy_connect_timeout 60s; \
        proxy_send_timeout 60s; \
        proxy_read_timeout 60s; \
        proxy_request_buffering off; \
    } \
    \
    # Proxy actuator endpoints \
    location /actuator/ { \
        proxy_pass http://localhost:8080; \
        proxy_set_header Host $host; \
        proxy_set_header X-Real-IP $remote_addr; \
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; \
        proxy_set_header X-Forwarded-Proto $scheme; \
    } \
}' > /etc/nginx/sites-available/default

# Create startup script
RUN echo '#!/bin/bash' > /app/start.sh && \
    echo 'set -e' >> /app/start.sh && \
    echo '' >> /app/start.sh && \
    echo '# Start backend in background' >> /app/start.sh && \
    echo 'java -jar /app/app.jar &' >> /app/start.sh && \
    echo '' >> /app/start.sh && \
    echo '# Wait for backend to be ready' >> /app/start.sh && \
    echo 'echo "Waiting for backend to start..."' >> /app/start.sh && \
    echo 'while ! wget --no-verbose --tries=1 --spider http://localhost:8080/api/actuator/health 2>/dev/null; do' >> /app/start.sh && \
    echo '    sleep 2' >> /app/start.sh && \
    echo 'done' >> /app/start.sh && \
    echo 'echo "Backend is ready!"' >> /app/start.sh && \
    echo '' >> /app/start.sh && \
    echo '# Start nginx in foreground' >> /app/start.sh && \
    echo 'nginx -g "daemon off;"' >> /app/start.sh && \
    chmod +x /app/start.sh

# Change ownership to appuser
RUN chown -R appuser:appuser /app /var/log/nginx

USER appuser

EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost/api/actuator/health || exit 1

ENTRYPOINT ["/app/start.sh"]
