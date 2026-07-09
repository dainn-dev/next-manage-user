#!/bin/bash

# Run from this script's dir (deploy/) so docker-compose.dev.yml is found and its
# ../frontend and ../backend build contexts resolve.
cd "$(dirname "$0")"

# Build and run development environment
echo "🚀 Starting Vehicle Management System - Development Environment"

# Stop any existing containers
echo "🛑 Stopping existing containers..."
docker-compose -f docker-compose.dev.yml down

# Remove old images (optional - comment out if you want to keep them)
echo "🧹 Cleaning up old images..."
docker image prune -f

# Build and start services
echo "🏗️ Building and starting services..."
docker-compose -f docker-compose.dev.yml up --build -d

# Show status
echo "📊 Service Status:"
docker-compose -f docker-compose.dev.yml ps

echo ""
echo "✅ Vehicle Management System is starting up!"
echo ""
echo "📱 Frontend: http://localhost:3000"
echo "🔧 Backend API: http://localhost:8080/api"
echo "📚 Swagger UI: http://localhost:8080/swagger-ui.html"
echo "🗄️ Database: localhost:5432"
echo ""
echo "⏳ Please wait a few moments for all services to be ready..."
echo "🔍 Check logs with: docker-compose -f docker-compose.dev.yml logs -f"
