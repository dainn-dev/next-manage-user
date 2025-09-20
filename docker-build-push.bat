@echo off
setlocal enabledelayedexpansion

REM Docker Build and Push Script for Vehicle Management System (Windows)
REM This script builds and pushes frontend and backend images to Docker Hub

echo ================================
echo   Vehicle Management System
echo   Docker Build ^& Push Script
echo ================================
echo.

REM Configuration
set DOCKER_REPOSITORY=vehicle-management
set FRONTEND_IMAGE=%DOCKER_REPOSITORY%-frontend
set BACKEND_IMAGE=%DOCKER_REPOSITORY%-backend
set VERSION=latest

REM Check Docker installation
echo [STEP] Checking Docker installation...
docker --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker is not installed or not in PATH
    echo Please install Docker Desktop and try again
    pause
    exit /b 1
)
echo [SUCCESS] Docker is available

REM Check Docker Hub login
echo [STEP] Checking Docker Hub login status...
docker info | findstr "Username" >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Not logged in to Docker Hub
    echo Please login first: docker login
    pause
    exit /b 1
)
echo [SUCCESS] Logged in to Docker Hub

REM Get Docker Hub username
set /p DOCKER_USERNAME="Enter your Docker Hub username: "
if "%DOCKER_USERNAME%"=="" (
    echo [ERROR] Docker Hub username is required
    pause
    exit /b 1
)
echo [SUCCESS] Using Docker Hub username: %DOCKER_USERNAME%

echo.
echo [STEP] Starting build and push process...
echo.

REM Build frontend
echo [STEP] Building frontend image...
echo Building %DOCKER_USERNAME%/%FRONTEND_IMAGE%:%VERSION%
docker build -f Dockerfile.frontend -t %DOCKER_USERNAME%/%FRONTEND_IMAGE%:%VERSION% -t %DOCKER_USERNAME%/%FRONTEND_IMAGE%:latest .
if errorlevel 1 (
    echo [ERROR] Frontend build failed
    pause
    exit /b 1
)
echo [SUCCESS] Frontend image built successfully
echo.

REM Build backend
echo [STEP] Building backend image...
echo Building %DOCKER_USERNAME%/%BACKEND_IMAGE%:%VERSION%
docker build -f backend/Dockerfile -t %DOCKER_USERNAME%/%BACKEND_IMAGE%:%VERSION% -t %DOCKER_USERNAME%/%BACKEND_IMAGE%:latest backend/
if errorlevel 1 (
    echo [ERROR] Backend build failed
    pause
    exit /b 1
)
echo [SUCCESS] Backend image built successfully
echo.

REM Push frontend
echo [STEP] Pushing frontend image to Docker Hub...
echo Pushing %DOCKER_USERNAME%/%FRONTEND_IMAGE%:%VERSION%
docker push %DOCKER_USERNAME%/%FRONTEND_IMAGE%:%VERSION%
if errorlevel 1 (
    echo [ERROR] Frontend push failed
    pause
    exit /b 1
)
docker push %DOCKER_USERNAME%/%FRONTEND_IMAGE%:latest
if errorlevel 1 (
    echo [ERROR] Frontend latest tag push failed
    pause
    exit /b 1
)
echo [SUCCESS] Frontend image pushed successfully
echo.

REM Push backend
echo [STEP] Pushing backend image to Docker Hub...
echo Pushing %DOCKER_USERNAME%/%BACKEND_IMAGE%:%VERSION%
docker push %DOCKER_USERNAME%/%BACKEND_IMAGE%:%VERSION%
if errorlevel 1 (
    echo [ERROR] Backend push failed
    pause
    exit /b 1
)
docker push %DOCKER_USERNAME%/%BACKEND_IMAGE%:latest
if errorlevel 1 (
    echo [ERROR] Backend latest tag push failed
    pause
    exit /b 1
)
echo [SUCCESS] Backend image pushed successfully
echo.

REM Show built images
echo [STEP] Built images:
docker images | findstr "%DOCKER_USERNAME%/%DOCKER_REPOSITORY%"

REM Create production docker-compose file
echo [STEP] Creating production docker-compose.yml...

(
echo services:
echo   postgres:
echo     image: postgres:15-alpine
echo     container_name: vehicle-management-db
echo     environment:
echo       POSTGRES_DB: vehicle_management
echo       POSTGRES_USER: postgres
echo       POSTGRES_PASSWORD: password
echo     ports:
echo       - "5432:5432"
echo     volumes:
echo       - postgres_data:/var/lib/postgresql/data
echo     networks:
echo       - vehicle-management-network
echo     healthcheck:
echo       test: ["CMD-SHELL", "pg_isready -U postgres"]
echo       interval: 10s
echo       timeout: 5s
echo       retries: 5
echo.
echo   backend:
echo     image: %DOCKER_USERNAME%/%BACKEND_IMAGE%:latest
echo     container_name: vehicle-management-backend
echo     depends_on:
echo       postgres:
echo         condition: service_healthy
echo     environment:
echo       SPRING_DATASOURCE_URL: jdbc:postgresql://postgres:5432/vehicle_management
echo       SPRING_DATASOURCE_USERNAME: postgres
echo       SPRING_DATASOURCE_PASSWORD: password
echo       SPRING_PROFILES_ACTIVE: docker
echo       SPRING_SERVLET_MULTIPART_MAX_FILE_SIZE: 50MB
echo       SPRING_SERVLET_MULTIPART_MAX_REQUEST_SIZE: 50MB
echo       SPRING_SERVLET_MULTIPART_ENABLED: true
echo     ports:
echo       - "8080:8080"
echo     volumes:
echo       - file_storage:/app/temp
echo       - csv_storage:/app/csv
echo     networks:
echo       - vehicle-management-network
echo     restart: unless-stopped
echo.
echo   frontend:
echo     image: %DOCKER_USERNAME%/%FRONTEND_IMAGE%:latest
echo     container_name: vehicle-management-frontend
echo     environment:
echo       NODE_ENV: production
echo       NEXT_PUBLIC_API_URL: http://localhost:8080
echo     ports:
echo       - "3000:3000"
echo     depends_on:
echo       - backend
echo     networks:
echo       - vehicle-management-network
echo     restart: unless-stopped
echo.
echo volumes:
echo   postgres_data:
echo   file_storage:
echo   csv_storage:
echo.
echo networks:
echo   vehicle-management-network:
echo     driver: bridge
) > docker-compose.production.yml

echo [SUCCESS] Production docker-compose.yml created

REM Show usage instructions
echo.
echo [STEP] Usage instructions:
echo To use these images, run:
echo   docker-compose -f docker-compose.production.yml up -d
echo.
echo Or pull and run individually:
echo   docker pull %DOCKER_USERNAME%/%FRONTEND_IMAGE%:latest
echo   docker pull %DOCKER_USERNAME%/%BACKEND_IMAGE%:latest
echo.
echo Images are available at:
echo   https://hub.docker.com/r/%DOCKER_USERNAME%/%FRONTEND_IMAGE%
echo   https://hub.docker.com/r/%DOCKER_USERNAME%/%BACKEND_IMAGE%
echo.

echo [SUCCESS] Build and push completed successfully!
echo [SUCCESS] Images are now available on Docker Hub
echo.
pause
