#!/bin/bash
# Start backend with MinIO credentials

cd "$(dirname "$0")/backend"

export OBJECT_STORAGE_ACCESS_KEY=minioadmin
export OBJECT_STORAGE_SECRET_KEY=minioadmin

echo "Starting backend with MinIO credentials..."
mvn spring-boot:run
