# Multi-stage build for backend
FROM maven:3.8.4-openjdk-17 AS builder

# Set working directory for backend
WORKDIR /app

# Copy backend pom.xml first for better caching
COPY pom.xml ./

# Download dependencies
RUN mvn dependency:go-offline -B

# Copy backend source code
COPY src ./src

# Build the backend
RUN mvn clean package -DskipTests

# Runtime stage
FROM openjdk:17-jdk-slim

WORKDIR /app

# Install wget for health checks
RUN apt-get update && apt-get install -y wget && rm -rf /var/lib/apt/lists/*

# Copy the built JAR file from builder stage
COPY --from=builder /app/target/vehicle-management-api-0.0.1-SNAPSHOT.jar app.jar

# Create non-root user
RUN groupadd -g 1001 spring && useradd -r -u 1001 -g spring spring

# Create directories for file operations
RUN mkdir -p /app/temp /app/csv

# Change ownership to spring user
RUN chown -R spring:spring /app

USER spring

EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/api/actuator/health || exit 1

ENTRYPOINT ["java", "-jar", "app.jar"]
