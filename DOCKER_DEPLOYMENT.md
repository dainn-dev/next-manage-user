# Docker Deployment Guide

This guide explains how to build and deploy the Vehicle Management System using Docker and Docker Hub.

## Prerequisites

1. **Docker Desktop** installed on your machine
2. **Docker Hub account** (free at [hub.docker.com](https://hub.docker.com))
3. **Git** (to clone the repository)

## Quick Start

### 1. Login to Docker Hub

```bash
docker login
```

Enter your Docker Hub username and password when prompted.

### 2. Build and Push Images

#### Option A: Using the Script (Recommended)

**Linux/macOS:**
```bash
chmod +x docker-build-push.sh
./docker-build-push.sh
```

**Windows:**
```cmd
docker-build-push.bat
```

#### Option B: Manual Commands

```bash
# Set your Docker Hub username
export DOCKER_USERNAME=your-username

# Build frontend
docker build -f Dockerfile.frontend -t $DOCKER_USERNAME/vehicle-management-frontend:latest .

# Build backend
docker build -f backend/Dockerfile -t $DOCKER_USERNAME/vehicle-management-backend:latest backend/

# Push to Docker Hub
docker push $DOCKER_USERNAME/vehicle-management-frontend:latest
docker push $DOCKER_USERNAME/vehicle-management-backend:latest
```

### 3. Deploy with Docker Compose

```bash
# Use the generated production compose file
docker-compose -f docker-compose.production.yml up -d
```

## Image Details

### Frontend Image (`vehicle-management-frontend`)
- **Base Image:** `node:18-alpine`
- **Technology:** Next.js 14 with React
- **Port:** 3000
- **Features:**
  - Optimized production build
  - Static file serving
  - Health checks
  - Non-root user for security

### Backend Image (`vehicle-management-backend`)
- **Base Image:** `openjdk:17-jdk-slim`
- **Technology:** Spring Boot 3.x
- **Port:** 8080
- **Features:**
  - Multi-stage build for smaller size
  - Health checks
  - File upload support
  - Database connectivity

## Environment Variables

### Frontend Environment Variables
```bash
NODE_ENV=production
NEXT_PUBLIC_API_URL=http://localhost:8080
```

### Backend Environment Variables
```bash
SPRING_DATASOURCE_URL=jdbc:postgresql://postgres:5432/vehicle_management
SPRING_DATASOURCE_USERNAME=postgres
SPRING_DATASOURCE_PASSWORD=password
SPRING_PROFILES_ACTIVE=docker
SPRING_SERVLET_MULTIPART_MAX_FILE_SIZE=50MB
SPRING_SERVLET_MULTIPART_MAX_REQUEST_SIZE=50MB
SPRING_SERVLET_MULTIPART_ENABLED=true
```

## Production Deployment

### Using Docker Compose

1. **Clone and setup:**
```bash
git clone <your-repo>
cd next-manage-user
```

2. **Update docker-compose.production.yml:**
   - Replace `your-username` with your Docker Hub username
   - Update environment variables as needed

3. **Deploy:**
```bash
docker-compose -f docker-compose.production.yml up -d
```

### Using Individual Containers

```bash
# Start PostgreSQL
docker run -d \
  --name vehicle-management-db \
  -e POSTGRES_DB=vehicle_management \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=password \
  -p 5432:5432 \
  postgres:15-alpine

# Start Backend
docker run -d \
  --name vehicle-management-backend \
  --link vehicle-management-db:postgres \
  -e SPRING_DATASOURCE_URL=jdbc:postgresql://postgres:5432/vehicle_management \
  -e SPRING_DATASOURCE_USERNAME=postgres \
  -e SPRING_DATASOURCE_PASSWORD=password \
  -p 8080:8080 \
  your-username/vehicle-management-backend:latest

# Start Frontend
docker run -d \
  --name vehicle-management-frontend \
  --link vehicle-management-backend:backend \
  -e NEXT_PUBLIC_API_URL=http://backend:8080 \
  -p 3000:3000 \
  your-username/vehicle-management-frontend:latest
```

## Scaling and Load Balancing

### Using Docker Swarm

```bash
# Initialize swarm
docker swarm init

# Deploy stack
docker stack deploy -c docker-compose.production.yml vehicle-management
```

### Using Kubernetes

Create Kubernetes manifests:

```yaml
# k8s-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: vehicle-management-frontend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: vehicle-management-frontend
  template:
    metadata:
      labels:
        app: vehicle-management-frontend
    spec:
      containers:
      - name: frontend
        image: your-username/vehicle-management-frontend:latest
        ports:
        - containerPort: 3000
        env:
        - name: NEXT_PUBLIC_API_URL
          value: "http://vehicle-management-backend-service:8080"
---
apiVersion: v1
kind: Service
metadata:
  name: vehicle-management-frontend-service
spec:
  selector:
    app: vehicle-management-frontend
  ports:
  - port: 80
    targetPort: 3000
  type: LoadBalancer
```

## Security Considerations

### 1. Environment Variables
- Never commit sensitive data to version control
- Use Docker secrets or external secret management
- Rotate database passwords regularly

### 2. Network Security
```yaml
# Example with custom network
networks:
  vehicle-management-network:
    driver: bridge
    ipam:
      config:
        - subnet: 172.20.0.0/16
```

### 3. Resource Limits
```yaml
# Add to docker-compose.yml
deploy:
  resources:
    limits:
      cpus: '0.5'
      memory: 512M
    reservations:
      cpus: '0.25'
      memory: 256M
```

## Monitoring and Logging

### Health Checks
Both images include health checks:
- Frontend: `GET http://localhost:3000`
- Backend: `GET http://localhost:8080/api/actuator/health`

### Logging
```bash
# View logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f frontend
docker-compose logs -f backend
```

### Monitoring with Prometheus
```yaml
# Add to docker-compose.yml
  prometheus:
    image: prom/prometheus
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
```

## Troubleshooting

### Common Issues

**1. Build Failures**
```bash
# Clean Docker cache
docker system prune -a

# Build with no cache
docker build --no-cache -f Dockerfile.frontend .
```

**2. Connection Issues**
```bash
# Check container logs
docker logs vehicle-management-backend
docker logs vehicle-management-frontend

# Check network connectivity
docker exec -it vehicle-management-frontend ping vehicle-management-backend
```

**3. Database Connection**
```bash
# Check PostgreSQL logs
docker logs vehicle-management-db

# Test database connection
docker exec -it vehicle-management-backend curl http://localhost:8080/api/actuator/health
```

### Performance Optimization

**1. Image Size Optimization**
- Use multi-stage builds
- Remove unnecessary packages
- Use Alpine Linux base images

**2. Build Speed**
- Use `.dockerignore` files
- Leverage Docker layer caching
- Use BuildKit for parallel builds

**3. Runtime Performance**
- Set appropriate resource limits
- Use health checks for better orchestration
- Monitor container metrics

## CI/CD Integration

### GitHub Actions Example

```yaml
# .github/workflows/docker.yml
name: Build and Push Docker Images

on:
  push:
    branches: [main]

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    
    - name: Login to Docker Hub
      uses: docker/login-action@v2
      with:
        username: ${{ secrets.DOCKER_USERNAME }}
        password: ${{ secrets.DOCKER_PASSWORD }}
    
    - name: Build and push frontend
      uses: docker/build-push-action@v4
      with:
        context: .
        file: ./Dockerfile.frontend
        push: true
        tags: ${{ secrets.DOCKER_USERNAME }}/vehicle-management-frontend:latest
    
    - name: Build and push backend
      uses: docker/build-push-action@v4
      with:
        context: ./backend
        file: ./Dockerfile
        push: true
        tags: ${{ secrets.DOCKER_USERNAME }}/vehicle-management-backend:latest
```

## Support

For issues related to Docker deployment:
1. Check the logs: `docker-compose logs`
2. Verify environment variables
3. Ensure all services are healthy
4. Check network connectivity between containers

## License

This deployment guide is part of the Vehicle Management System project.
