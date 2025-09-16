#!/bin/bash

echo "Building Docker containers for Frontend (port 3000) and Backend (port 8080)..."

echo ""
echo "Stopping any running containers..."
docker-compose down

echo ""
echo "Building and starting containers..."
docker-compose up --build -d

echo ""
echo "Checking container status..."
docker-compose ps

echo ""
echo "Build complete!"
echo "Frontend: http://localhost:3000"
echo "Backend API: http://localhost:8080/api"
echo "Database: localhost:5432"

echo ""
echo "To view logs:"
echo "  Frontend: docker-compose logs frontend"
echo "  Backend: docker-compose logs backend"
echo "  Database: docker-compose logs postgres"
