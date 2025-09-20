#!/bin/bash

# Docker Build and Push Script for Vehicle Management System
# This script builds and pushes frontend and backend images to Docker Hub

set -e  # Exit on any error

# Configuration
DOCKER_USERNAME="dainndev"
DOCKER_REPOSITORY="vehicle-management"
FRONTEND_IMAGE="$DOCKER_REPOSITORY-frontend"
BACKEND_IMAGE="$DOCKER_REPOSITORY-backend"
VERSION="latest"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
print_header() {
    echo -e "${BLUE}================================${NC}"
    echo -e "${BLUE}  Vehicle Management System${NC}"
    echo -e "${BLUE}  Docker Build & Push Script${NC}"
    echo -e "${BLUE}================================${NC}"
    echo
}

print_step() {
    echo -e "${YELLOW}[STEP]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_docker() {
    print_step "Checking Docker installation..."
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed or not in PATH"
        exit 1
    fi
    print_success "Docker is available"
}

check_docker_login() {
    print_step "Checking Docker Hub login status..."
    if ! docker info | grep -q "Username"; then
        print_error "Not logged in to Docker Hub"
        echo "Please login first: docker login"
        exit 1
    fi
    print_success "Logged in to Docker Hub"
}

get_docker_username() {
    if [ -z "$DOCKER_USERNAME" ]; then
        echo -n "Enter your Docker Hub username: "
        read DOCKER_USERNAME
        if [ -z "$DOCKER_USERNAME" ]; then
            print_error "Docker Hub username is required"
            exit 1
        fi
    fi
    print_success "Using Docker Hub username: $DOCKER_USERNAME"
}

build_frontend() {
    print_step "Building frontend image..."
    echo "Building $DOCKER_USERNAME/$FRONTEND_IMAGE:$VERSION"
    
    docker build \
        -f Dockerfile.frontend \
        -t "$DOCKER_USERNAME/$FRONTEND_IMAGE:$VERSION" \
        -t "$DOCKER_USERNAME/$FRONTEND_IMAGE:latest" \
        .
    
    print_success "Frontend image built successfully"
}

build_backend() {
    print_step "Building backend image..."
    echo "Building $DOCKER_USERNAME/$BACKEND_IMAGE:$VERSION"
    
    docker build \
        -f backend/Dockerfile \
        -t "$DOCKER_USERNAME/$BACKEND_IMAGE:$VERSION" \
        -t "$DOCKER_USERNAME/$BACKEND_IMAGE:latest" \
        backend/
    
    print_success "Backend image built successfully"
}

push_frontend() {
    print_step "Pushing frontend image to Docker Hub..."
    echo "Pushing $DOCKER_USERNAME/$FRONTEND_IMAGE:$VERSION"
    
    docker push "$DOCKER_USERNAME/$FRONTEND_IMAGE:$VERSION"
    docker push "$DOCKER_USERNAME/$FRONTEND_IMAGE:latest"
    
    print_success "Frontend image pushed successfully"
}

push_backend() {
    print_step "Pushing backend image to Docker Hub..."
    echo "Pushing $DOCKER_USERNAME/$BACKEND_IMAGE:$VERSION"
    
    docker push "$DOCKER_USERNAME/$BACKEND_IMAGE:$VERSION"
    docker push "$DOCKER_USERNAME/$BACKEND_IMAGE:latest"
    
    print_success "Backend image pushed successfully"
}

show_images() {
    print_step "Built images:"
    docker images | grep "$DOCKER_USERNAME/$DOCKER_REPOSITORY" || echo "No images found"
}

create_docker_compose_production() {
    print_step "Creating production docker-compose.yml..."
    
    cat > docker-compose.production.yml << EOF
services:
  postgres:
    image: postgres:15-alpine
    container_name: vehicle-management-db
    environment:
      POSTGRES_DB: vehicle_management
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - vehicle-management-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  backend:
    image: $DOCKER_USERNAME/$BACKEND_IMAGE:latest
    container_name: vehicle-management-backend
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      SPRING_DATASOURCE_URL: jdbc:postgresql://postgres:5432/vehicle_management
      SPRING_DATASOURCE_USERNAME: postgres
      SPRING_DATASOURCE_PASSWORD: password
      SPRING_PROFILES_ACTIVE: docker
      SPRING_SERVLET_MULTIPART_MAX_FILE_SIZE: 50MB
      SPRING_SERVLET_MULTIPART_MAX_REQUEST_SIZE: 50MB
      SPRING_SERVLET_MULTIPART_ENABLED: true
    ports:
      - "8080:8080"
    volumes:
      - file_storage:/app/temp
      - csv_storage:/app/csv
    networks:
      - vehicle-management-network
    restart: unless-stopped

  frontend:
    image: $DOCKER_USERNAME/$FRONTEND_IMAGE:latest
    container_name: vehicle-management-frontend
    environment:
      NODE_ENV: production
      NEXT_PUBLIC_API_URL: http://localhost:8080
    ports:
      - "3000:3000"
    depends_on:
      - backend
    networks:
      - vehicle-management-network
    restart: unless-stopped

volumes:
  postgres_data:
  file_storage:
  csv_storage:

networks:
  vehicle-management-network:
    driver: bridge
EOF

    print_success "Production docker-compose.yml created"
}

show_usage() {
    print_step "Usage instructions:"
    echo "To use these images, run:"
    echo "  docker-compose -f docker-compose.production.yml up -d"
    echo
    echo "Or pull and run individually:"
    echo "  docker pull $DOCKER_USERNAME/$FRONTEND_IMAGE:latest"
    echo "  docker pull $DOCKER_USERNAME/$BACKEND_IMAGE:latest"
    echo
    echo "Images are available at:"
    echo "  https://hub.docker.com/r/$DOCKER_USERNAME/$FRONTEND_IMAGE"
    echo "  https://hub.docker.com/r/$DOCKER_USERNAME/$BACKEND_IMAGE"
}

# Main execution
main() {
    print_header
    
    # Check prerequisites
    check_docker
    check_docker_login
    get_docker_username
    
    echo
    print_step "Starting build and push process..."
    echo
    
    # Build images
    build_frontend
    echo
    build_backend
    echo
    
    # Push images
    push_frontend
    echo
    push_backend
    echo
    
    # Show results
    show_images
    echo
    
    # Create production compose file
    create_docker_compose_production
    echo
    
    # Show usage instructions
    show_usage
    echo
    
    print_success "Build and push completed successfully!"
    print_success "Images are now available on Docker Hub"
}

# Handle command line arguments
case "${1:-}" in
    --frontend-only)
        print_header
        check_docker
        check_docker_login
        get_docker_username
        build_frontend
        push_frontend
        show_images
        ;;
    --backend-only)
        print_header
        check_docker
        check_docker_login
        get_docker_username
        build_backend
        push_backend
        show_images
        ;;
    --build-only)
        print_header
        check_docker
        get_docker_username
        build_frontend
        build_backend
        show_images
        ;;
    --help)
        echo "Usage: $0 [option]"
        echo "Options:"
        echo "  --frontend-only    Build and push only frontend"
        echo "  --backend-only     Build and push only backend"
        echo "  --build-only       Build images without pushing"
        echo "  --help             Show this help message"
        echo "  (no option)        Build and push both images"
        ;;
    *)
        main
        ;;
esac
