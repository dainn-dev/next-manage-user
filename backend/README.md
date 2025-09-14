# Vehicle Management System API

A Spring Boot REST API for managing vehicles and entry/exit requests in a vehicle management system.

## Features

- **Vehicle Management**: CRUD operations for vehicles with detailed information
- **Entry/Exit Requests**: Manage vehicle entry and exit requests with approval workflow
- **Employee Integration**: Link vehicles to employees
- **Advanced Search**: Search and filter vehicles and requests
- **Statistics**: Get various statistics and reports
- **Pagination**: Efficient data retrieval with pagination support
- **Validation**: Comprehensive input validation
- **Error Handling**: Global exception handling with detailed error responses
- **API Documentation**: Swagger/OpenAPI documentation
- **CORS Support**: Configured for frontend integration

## Technology Stack

- **Java 17**
- **Spring Boot 3.2.0**
- **Spring Data JPA**
- **PostgreSQL**
- **Flyway** (Database migrations)
- **Swagger/OpenAPI** (API documentation)
- **Maven** (Build tool)

## Getting Started

### Prerequisites

- Java 17 or higher
- Maven 3.6 or higher
- PostgreSQL 12 or higher

### Database Setup

1. Create a PostgreSQL database:
```sql
CREATE DATABASE vehicle_management;
```

2. Update the database configuration in `src/main/resources/application.yml`:
```yaml
spring:
  datasource:
    url: jdbc:postgresql://localhost:5432/vehicle_management
    username: your_username
    password: your_password
```

### Running the Application

1. Clone the repository and navigate to the backend directory:
```bash
cd backend
```

2. Run the application:
```bash
mvn spring-boot:run
```

The application will start on `http://localhost:8080`

### API Documentation

Once the application is running, you can access:
- **Swagger UI**: http://localhost:8080/api/swagger-ui.html
- **API Docs**: http://localhost:8080/api/api-docs

## API Endpoints

### Vehicle Management
- `GET /api/vehicles` - Get all vehicles (with pagination)
- `GET /api/vehicles/{id}` - Get vehicle by ID
- `GET /api/vehicles/license-plate/{licensePlate}` - Get vehicle by license plate
- `GET /api/vehicles/employee/{employeeId}` - Get vehicles by employee
- `GET /api/vehicles/type/{vehicleType}` - Get vehicles by type
- `GET /api/vehicles/status/{status}` - Get vehicles by status
- `GET /api/vehicles/search` - Search vehicles
- `POST /api/vehicles` - Create new vehicle
- `PUT /api/vehicles/{id}` - Update vehicle
- `DELETE /api/vehicles/{id}` - Delete vehicle

### Entry/Exit Requests
- `GET /api/entry-exit-requests` - Get all requests (with pagination)
- `GET /api/entry-exit-requests/{id}` - Get request by ID
- `GET /api/entry-exit-requests/employee/{employeeId}` - Get requests by employee
- `GET /api/entry-exit-requests/vehicle/{vehicleId}` - Get requests by vehicle
- `GET /api/entry-exit-requests/type/{requestType}` - Get requests by type
- `GET /api/entry-exit-requests/status/{status}` - Get requests by status
- `GET /api/entry-exit-requests/search` - Search requests
- `POST /api/entry-exit-requests` - Create new request
- `PUT /api/entry-exit-requests/{id}` - Update request
- `PUT /api/entry-exit-requests/{id}/approve` - Approve request
- `PUT /api/entry-exit-requests/{id}/reject` - Reject request
- `DELETE /api/entry-exit-requests/{id}` - Delete request

### Statistics
- `GET /api/vehicles/stats/count/type` - Vehicle count by type
- `GET /api/vehicles/stats/count/fuel-type` - Vehicle count by fuel type
- `GET /api/entry-exit-requests/stats/daily` - Daily request statistics

## Data Models

### Vehicle
```json
{
  "id": "uuid",
  "employeeId": "uuid",
  "employeeName": "string",
  "licensePlate": "string",
  "vehicleType": "CAR|MOTORBIKE|TRUCK|BUS",
  "brand": "string",
  "model": "string",
  "color": "string",
  "year": "integer",
  "engineNumber": "string",
  "chassisNumber": "string",
  "registrationDate": "date",
  "expiryDate": "date",
  "insuranceNumber": "string",
  "insuranceExpiry": "date",
  "status": "ACTIVE|INACTIVE|MAINTENANCE|RETIRED",
  "fuelType": "GASOLINE|DIESEL|ELECTRIC|HYBRID",
  "capacity": "integer",
  "notes": "string",
  "createdAt": "datetime",
  "updatedAt": "datetime"
}
```

### Entry/Exit Request
```json
{
  "id": "uuid",
  "employeeId": "uuid",
  "employeeName": "string",
  "vehicleId": "uuid",
  "licensePlate": "string",
  "requestType": "ENTRY|EXIT",
  "requestTime": "datetime",
  "approvedBy": "string",
  "approvedAt": "datetime",
  "status": "PENDING|APPROVED|REJECTED",
  "notes": "string",
  "createdAt": "datetime"
}
```

## Database Schema

The application uses Flyway for database migrations. The initial schema includes:

1. **employees** - Employee information
2. **vehicles** - Vehicle details linked to employees
3. **entry_exit_requests** - Entry/exit requests for vehicles

Sample data is included in the migrations for testing purposes.

## Configuration

Key configuration options in `application.yml`:

```yaml
server:
  port: 8080
  servlet:
    context-path: /api

spring:
  datasource:
    url: jdbc:postgresql://localhost:5432/vehicle_management
    username: postgres
    password: password
  
  jpa:
    hibernate:
      ddl-auto: validate
    show-sql: false

springdoc:
  api-docs:
    path: /api-docs
  swagger-ui:
    path: /swagger-ui.html
```

## Testing

Run tests with:
```bash
mvn test
```

## Building for Production

Create a JAR file:
```bash
mvn clean package
```

Run the JAR:
```bash
java -jar target/vehicle-management-api-0.0.1-SNAPSHOT.jar
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

This project is licensed under the MIT License.
