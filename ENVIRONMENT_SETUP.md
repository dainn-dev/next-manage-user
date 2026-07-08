# Environment Setup Guide

This document explains how to set up environment variables for the Vehicle Management System.

## Quick Start

1. **Copy the sample environment file:**
   ```bash
   cp sample.env .env.local
   ```

2. **Update the values in `.env.local`** to match your environment

3. **Restart your development server** after making changes

## Environment Files

### Frontend (Next.js)
- **`.env.local`** - Local development environment variables
- **`.env.production`** - Production environment variables
- **`.env.example`** - Minimal committed template (API URL only)
- **`sample.env`** - Template with all available environment variables

### Backend (Spring Boot)
- **`backend/.env.example`** - Committed template with `SPRING_DATASOURCE_*` and `JWT_SECRET` placeholders
- **`application.yml`** - Default configuration (reads DB URL/credentials and `jwt.secret` from env with defaults)
- **`application-docker.yml`** - Docker-specific configuration (same env overrides)
- Environment variables can override YAML values using the `SPRING_` prefix

### License Plate Monitor (Python detection app)
- **`windows/config.json`** - Active config (runtime). API `base_url` defaults to `http://localhost:8080`.
- **`windows/config.example.json`** - Committed template with placeholder values (port 8080, no real secrets). Copy to `windows/config.json` and fill in real RTSP credentials / auth cookies.

## Quick Setup (copy templates)

```bash
# Frontend
cp .env.example .env.local        # minimal; or: cp sample.env .env.local

# Backend
cp backend/.env.example .env      # then fill in real DB + JWT values

# Detection app
cp windows/config.example.json windows/config.json
```

## Required Environment Variables

### Frontend (NEXT_PUBLIC_* variables)
```bash
NEXT_PUBLIC_API_URL=http://localhost:8080
# Optional: only needed if the frontend calls the gate check-vehicle endpoint.
# Must match the backend GATE_API_KEY.
NEXT_PUBLIC_GATE_API_KEY=
```

### Backend
```bash
SERVER_PORT=8080
SPRING_DATASOURCE_URL=jdbc:postgresql://localhost:5432/vehicle_management
SPRING_DATASOURCE_USERNAME=postgres
SPRING_DATASOURCE_PASSWORD=password
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRATION=86400
# Shared secret required in the X-Gate-Key header for the public, side-effecting
# gate endpoints (POST /api/vehicles/check-vehicle, POST /api/vehicle-logs).
# Empty = open (dev). Set a strong value in production and share it with the
# detection app (windows/config.json api.gate_key or GATE_API_KEY env).
GATE_API_KEY=
```

## Database Configuration

### Local Development
```bash
SPRING_DATASOURCE_URL=jdbc:postgresql://localhost:5432/vehicle_management
SPRING_DATASOURCE_USERNAME=postgres
SPRING_DATASOURCE_PASSWORD=password
```

### Docker Development
```bash
SPRING_DATASOURCE_URL=jdbc:postgresql://postgres:5432/vehicle_management
SPRING_DATASOURCE_USERNAME=postgres
SPRING_DATASOURCE_PASSWORD=password
```

### Production
```bash
SPRING_DATASOURCE_URL=jdbc:postgresql://your-prod-host:5432/vehicle_management
SPRING_DATASOURCE_USERNAME=your_prod_username
SPRING_DATASOURCE_PASSWORD=your_secure_password
```

## Security Configuration

### JWT Configuration
```bash
JWT_SECRET=your_very_secure_jwt_secret_key_at_least_256_bits_long
JWT_EXPIRATION=86400  # 24 hours in seconds
```

### Default Admin User
```bash
SPRING_SECURITY_USER_NAME=admin
SPRING_SECURITY_USER_PASSWORD=admin
```

## License Plate Monitor Configuration

### API Configuration
```bash
LPM_API_BASE_URL=http://localhost:8080
LPM_API_ENDPOINT=/api/vehicles/check-vehicle
LPM_API_TIMEOUT=10
# X-Gate-Key sent with each check-vehicle POST. Set in windows/config.json
# (api.gate_key) or via the GATE_API_KEY env var; must match backend GATE_API_KEY.
LPM_API_GATE_KEY=
```

### TTS Configuration
```bash
LPM_TTS_ENABLED=true
LPM_TTS_USE_GTTS=true
LPM_TTS_RATE=150
LPM_TTS_VOLUME=0.8
LPM_TTS_LANGUAGE=vi
```

## Development vs Production

### Development
- Use `sample.env` as template
- Copy to `.env.local` and customize
- Use local database and API URLs
- Enable debug logging

### Production
- Create `.env.production` with secure values
- Use production database credentials
- Use strong JWT secrets
- Disable debug logging
- Use HTTPS URLs

## Environment Variable Precedence

1. **Environment variables** (highest priority)
2. **`.env.local`** file
3. **`application.yml`** (Spring Boot defaults)
4. **Code defaults** (lowest priority)

## Common Issues

### Frontend API Connection Issues
- Verify `NEXT_PUBLIC_API_URL` matches backend URL
- Check if backend is running on correct port
- Ensure CORS is properly configured

### Database Connection Issues
- Verify database is running
- Check connection string format
- Confirm username/password are correct
- Ensure database exists

### JWT Token Issues
- Verify `JWT_SECRET` is consistent between frontend and backend
- Check token expiration settings
- Ensure proper token format

## Security Best Practices

1. **Never commit `.env` files** to version control
2. **Use strong, unique passwords** for production
3. **Rotate JWT secrets** regularly
4. **Use environment-specific configurations**
5. **Limit database user permissions**
6. **Enable HTTPS in production**

## Troubleshooting

### Check Environment Variables
```bash
# Frontend (Next.js)
npm run dev  # Check console for environment variable warnings

# Backend (Spring Boot)
./mvnw spring-boot:run  # Check startup logs for configuration
```

### Validate Configuration
- Frontend: Check browser console for API connection errors
- Backend: Check application logs for database connection issues
- Database: Verify tables are created and accessible

## Support

If you encounter issues with environment setup:
1. Check this documentation
2. Verify all required variables are set
3. Check application logs for specific error messages
4. Ensure all services (database, backend) are running
