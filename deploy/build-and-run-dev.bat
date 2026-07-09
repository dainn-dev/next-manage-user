@echo off
REM Run from this script's dir (deploy/) so docker-compose.dev.yml is found and its
REM ..\frontend and ..\backend build contexts resolve.
cd /d "%~dp0"
echo 🚀 Starting Vehicle Management System - Development Environment

REM Stop any existing containers
echo 🛑 Stopping existing containers...
docker-compose -f docker-compose.dev.yml down

REM Remove old images (optional)
echo 🧹 Cleaning up old images...
docker image prune -f

REM Build and start services
echo 🏗️ Building and starting services...
docker-compose -f docker-compose.dev.yml up --build -d

REM Show status
echo 📊 Service Status:
docker-compose -f docker-compose.dev.yml ps

echo.
echo ✅ Vehicle Management System is starting up!
echo.
echo 📱 Frontend: http://localhost:3000
echo 🔧 Backend API: http://localhost:8080/api
echo 📚 Swagger UI: http://localhost:8080/swagger-ui.html
echo 🗄️ Database: localhost:5432
echo.
echo ⏳ Please wait a few moments for all services to be ready...
echo 🔍 Check logs with: docker-compose -f docker-compose.dev.yml logs -f

pause
