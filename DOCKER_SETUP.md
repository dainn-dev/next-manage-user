# Unified Docker Setup

This project now uses a unified Docker setup that builds both the frontend (Next.js) and backend (Spring Boot) into a single container image.

## Architecture

The unified setup consists of:

1. **Multi-stage Dockerfile**: Builds both frontend and backend in a single image
2. **Nginx**: Serves the frontend and proxies API requests to the backend
3. **Spring Boot**: Runs the backend API on port 8080
4. **PostgreSQL**: Database container (unchanged)

## How it works

1. **Frontend Build Stage**: Builds the Next.js application with standalone output
2. **Backend Build Stage**: Builds the Spring Boot JAR file
3. **Runtime Stage**: Combines both applications with nginx as a reverse proxy

## Quick Start

### Prerequisites
- Docker and Docker Compose
- Maven (for building the backend)
- Node.js and pnpm (for building the frontend)

### Build and Run

**Linux/Mac:**
```bash
chmod +x build-and-run.sh
./build-and-run.sh
```

**Windows:**
```cmd
build-and-run.bat
```

**Manual build:**
```bash
# Build backend
cd backend
mvn clean package -DskipTests
cd ..

# Build and start containers
docker-compose up --build
```

## Access Points

- **Frontend**: http://localhost
- **Backend API**: http://localhost/api
- **Swagger UI**: http://localhost/api/swagger-ui.html
- **Database**: localhost:5432

## Configuration

### Environment Variables

The application uses the following environment variables:

- `SPRING_DATASOURCE_URL`: Database connection URL
- `SPRING_DATASOURCE_USERNAME`: Database username
- `SPRING_DATASOURCE_PASSWORD`: Database password
- `SPRING_PROFILES_ACTIVE`: Spring profile (set to 'docker')
- `NODE_ENV`: Node environment (set to 'production')

### Volumes

- `file_storage`: Temporary file storage for imports/exports
- `csv_storage`: CSV templates and exports
- `postgres_data`: PostgreSQL data persistence

## Development

For development, you can still run the frontend and backend separately:

**Frontend:**
```bash
pnpm dev
```

**Backend:**
```bash
cd backend
mvn spring-boot:run
```

## Troubleshooting

1. **Build fails**: Ensure Maven and Node.js are installed
2. **Port conflicts**: Check if ports 80 and 5432 are available
3. **Database connection**: Ensure PostgreSQL container is healthy before starting the app
4. **Frontend not loading**: Check nginx configuration in the Dockerfile

## Benefits of Unified Setup

1. **Simplified deployment**: Single container to deploy
2. **Reduced complexity**: No need to manage multiple containers for the application
3. **Better performance**: Nginx serves static files efficiently
4. **Easier scaling**: Single service to scale horizontally
5. **Simplified networking**: No need for complex inter-container communication
