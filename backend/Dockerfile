FROM openjdk:17-jdk-slim

WORKDIR /app

# Install wget for health checks
RUN apt-get update && apt-get install -y wget && rm -rf /var/lib/apt/lists/*

# Copy the pre-built JAR file
COPY target/vehicle-management-api-0.0.1-SNAPSHOT.jar app.jar

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
