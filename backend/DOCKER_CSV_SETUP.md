# Docker Setup for CSV Import/Export

This document explains the Docker configuration for supporting CSV file import and export operations.

## Overview

The Docker setup has been configured to support:
- CSV file imports (up to 10MB)
- Excel file imports and exports
- Temporary file storage
- Proper file permissions and security

## Configuration Changes

### 1. Docker Compose (`docker-compose.yml`)

**Added volumes:**
- `file_storage:/app/temp` - For temporary file processing
- `csv_storage:/app/csv` - For CSV template storage and exports

**Added environment variables:**
- `SPRING_SERVLET_MULTIPART_MAX_FILE_SIZE: 10MB`
- `SPRING_SERVLET_MULTIPART_MAX_REQUEST_SIZE: 10MB`
- `SPRING_SERVLET_MULTIPART_ENABLED: true`

### 2. Dockerfile

**Added directories:**
- `/app/temp` - Temporary file storage
- `/app/csv` - CSV file storage

**Security:**
- Proper ownership with non-root user (spring:spring)
- Correct permissions for file operations

### 3. Spring Boot Configuration

**File upload settings:**
```yaml
spring:
  servlet:
    multipart:
      max-file-size: 10MB
      max-request-size: 10MB
      enabled: true
      file-size-threshold: 2KB
      location: /app/temp
```

## Available Endpoints

### CSV Import
```bash
POST /api/entry-exit-requests/import/csv
Content-Type: multipart/form-data
Body: file (CSV file)
```

### Excel Import
```bash
POST /api/entry-exit-requests/import/excel
Content-Type: multipart/form-data
Body: file (Excel file)
```

### Excel Export
```bash
GET /api/entry-exit-requests/export/excel
```

## Usage Instructions

### 1. Build and Start Containers
```bash
cd backend
./rebuild-docker.sh
```

### 2. Test CSV Import
```bash
curl -X POST http://localhost:8080/api/entry-exit-requests/import/csv \
  -F "file=@your-file.csv" \
  -H "Content-Type: multipart/form-data"
```

### 3. Test Excel Export
```bash
curl -X GET http://localhost:8080/api/entry-exit-requests/export/excel \
  --output exported-data.xlsx
```

## File Format Requirements

### CSV Format
```csv
ID,Employee ID,Employee Name,Vehicle ID,License Plate,Request Type,Request Time,Status,Approved By,Approved At,Notes,Created At
(Auto-generated),1,Nguyễn Văn An,1,30A-12345,entry,2024-01-15 08:30:00,pending,,,Sample entry request,(Auto-generated)
```

**Required columns:**
- Employee ID
- Employee Name  
- License Plate
- Request Type (entry/exit)
- Request Time (yyyy-MM-dd HH:mm:ss)
- Status (pending/approved/rejected)

**Optional columns:**
- Approved By
- Approved At (yyyy-MM-dd HH:mm:ss)
- Notes

### Supported Request Types
- `entry` - Entry request
- `exit` - Exit request

### Supported Status Values
- `pending` - Pending approval
- `approved` - Approved
- `rejected` - Rejected

## Troubleshooting

### File Upload Issues
1. Check file size (max 10MB)
2. Verify file format (CSV or Excel)
3. Check container logs: `docker logs vehicle-management-api`

### Permission Issues
1. Verify directory permissions in container
2. Check file ownership: `docker exec vehicle-management-api ls -la /app/temp`

### Volume Issues
1. Check volume mounts: `docker volume ls`
2. Inspect volumes: `docker volume inspect backend_file_storage`

## Security Considerations

- Non-root user execution
- Proper file permissions
- Temporary file cleanup
- File size limits
- Input validation

## Monitoring

### Health Checks
```bash
curl http://localhost:8080/api/actuator/health
```

### Container Status
```bash
docker-compose ps
```

### Logs
```bash
docker-compose logs -f app
```
