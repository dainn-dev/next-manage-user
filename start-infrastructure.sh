#!/bin/bash
# Start MinIO standalone for local development
# This script starts only MinIO and PostgreSQL, allowing you to run backend/frontend locally

set -e

echo "🚀 Starting infrastructure services (PostgreSQL + MinIO)..."

# Check if docker compose is available
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Start only infrastructure services
docker compose up -d postgres minio minio-init

echo ""
echo "⏳ Waiting for services to be ready..."
sleep 5

# Check service health
echo ""
echo "📊 Service status:"
docker compose ps postgres minio

echo ""
echo "✅ Infrastructure is ready!"
echo ""
echo "Services available at:"
echo "  • PostgreSQL: localhost:5432"
echo "  • MinIO API: http://localhost:9000"
echo "  • MinIO Console: http://localhost:9001 (minioadmin / minioadmin)"
echo ""
echo "Next steps:"
echo "  1. Start backend: cd backend && mvn spring-boot:run"
echo "  2. Start frontend: cd frontend && npm run dev"
echo ""
echo "To stop infrastructure:"
echo "  docker compose stop postgres minio"
