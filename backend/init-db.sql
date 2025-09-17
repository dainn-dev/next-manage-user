-- Initialize database for vehicle management system
-- This script runs when the PostgreSQL container starts for the first time

-- Create database if it doesn't exist (this is handled by POSTGRES_DB env var)
-- CREATE DATABASE vehicle_management;

-- Grant permissions to postgres user (default user)
GRANT ALL PRIVILEGES ON DATABASE vehicle_management TO postgres;

-- Create extensions if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Set timezone
SET timezone = 'Asia/Ho_Chi_Minh';
