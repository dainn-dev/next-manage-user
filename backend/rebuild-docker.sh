#!/bin/bash

echo "Building application with CSV import/export support..."

# Build the application
echo "Step 1: Building Spring Boot application..."
mvn clean package -DskipTests

if [ $? -ne 0 ]; then
    echo "❌ Maven build failed!"
    exit 1
fi

echo "✅ Maven build successful!"

# Stop existing containers
echo "Step 2: Stopping existing containers..."
docker-compose down

# Remove old images
echo "Step 3: Removing old application image..."
docker rmi backend-app 2>/dev/null || true

# Build and start with new configuration
echo "Step 4: Building and starting Docker containers..."
docker-compose up --build -d

if [ $? -eq 0 ]; then
    echo "✅ Docker containers started successfully!"
    echo ""
    echo "🚀 Application is running at: http://localhost:8080/api"
    echo "📊 Swagger UI available at: http://localhost:8080/api/swagger-ui.html"
    echo "🗄️  Database accessible at: localhost:5432"
    echo ""
    echo "📁 CSV import/export features:"
    echo "   - Temporary files: /app/temp (in container)"
    echo "   - CSV storage: /app/csv (in container)"
    echo "   - Max file size: 10MB"
    echo ""
    echo "📋 Available endpoints:"
    echo "   - CSV Import: POST /api/entry-exit-requests/import/csv"
    echo "   - Excel Import: POST /api/entry-exit-requests/import/excel"
    echo "   - CSV Export: GET /api/entry-exit-requests/export/excel"
else
    echo "❌ Docker build failed!"
    exit 1
fi
