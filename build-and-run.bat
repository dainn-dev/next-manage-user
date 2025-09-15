@echo off
echo Building and starting the unified vehicle management application...

REM Build the backend first (required for the Docker build)
echo Building backend...
cd backend
call mvn clean package -DskipTests
cd ..

REM Build and start with docker-compose
echo Building and starting Docker containers...
docker-compose down
docker-compose build --no-cache
docker-compose up -d

echo Application is starting up...
echo Frontend will be available at: http://localhost
echo Backend API will be available at: http://localhost/api
echo Swagger UI will be available at: http://localhost/api/swagger-ui.html

REM Show logs
echo Showing application logs...
docker-compose logs -f app
