# Vehicle Management API - Authentication & User Management

This document describes the authentication and user management APIs that have been added to the Vehicle Management System.

## Authentication

### Login
- **POST** `/api/auth/login`
- **Description**: Authenticate user and receive JWT token
- **Body**:
  ```json
  {
    "username": "admin",
    "password": "admin123"
  }
  ```
- **Response**:
  ```json
  {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "tokenType": "Bearer",
    "username": "admin",
    "email": "admin@vehiclemanagement.com",
    "role": "SUPER_ADMIN",
    "expiresAt": "2024-01-01T12:00:00",
    "user": {
      "id": "uuid",
      "username": "admin",
      "email": "admin@vehiclemanagement.com",
      "firstName": "System",
      "lastName": "Administrator",
      "role": "SUPER_ADMIN",
      "status": "ACTIVE"
    }
  }
  ```

### Get Current User
- **GET** `/api/auth/me`
- **Description**: Get current authenticated user information
- **Headers**: `Authorization: Bearer <token>`
- **Response**: User object

### Logout
- **POST** `/api/auth/logout`
- **Description**: Logout user (client should discard token)
- **Headers**: `Authorization: Bearer <token>`

## User Management (Admin Only)

All user management endpoints require `ADMIN` or `SUPER_ADMIN` role.

### Get All Users
- **GET** `/api/admin/users`
- **Query Parameters**:
  - `page` (default: 0)
  - `size` (default: 10)
  - `sortBy` (default: createdAt)
  - `sortDir` (default: desc)

### Get User by ID
- **GET** `/api/admin/users/{id}`

### Get User by Username
- **GET** `/api/admin/users/username/{username}`

### Search Users
- **GET** `/api/admin/users/search?searchTerm={term}`

### Get Users by Role
- **GET** `/api/admin/users/role/{role}`
- **Roles**: `USER`, `ADMIN`, `SUPER_ADMIN`

### Get Users by Status
- **GET** `/api/admin/users/status/{status}`
- **Statuses**: `ACTIVE`, `INACTIVE`, `LOCKED`, `SUSPENDED`

### Create User
- **POST** `/api/admin/users`
- **Body**:
  ```json
  {
    "username": "newuser",
    "email": "newuser@example.com",
    "password": "password123",
    "firstName": "John",
    "lastName": "Doe",
    "role": "USER",
    "status": "ACTIVE",
    "employeeId": "optional-uuid"
  }
  ```

### Update User
- **PUT** `/api/admin/users/{id}`
- **Body**: Same as create user (all fields optional)

### Delete User
- **DELETE** `/api/admin/users/{id}`

### Update User Status
- **PATCH** `/api/admin/users/{id}/status?status={status}`

### Update User Role (Super Admin Only)
- **PATCH** `/api/admin/users/{id}/role?role={role}`

### Bulk Operations
- **POST** `/api/admin/users/bulk-delete`
  - Body: `["uuid1", "uuid2"]`
- **PUT** `/api/admin/users/bulk-update-status?status={status}`
  - Body: `["uuid1", "uuid2"]`
- **PUT** `/api/admin/users/bulk-update-role?role={role}` (Super Admin Only)
  - Body: `["uuid1", "uuid2"]`

### Utility Endpoints
- **GET** `/api/admin/users/exists/username/{username}`
- **GET** `/api/admin/users/exists/email/{email}`
- **GET** `/api/admin/users/stats/count/role/{role}`
- **GET** `/api/admin/users/stats/count/status/{status}`

## Default Users

The system comes with two default users:

1. **Super Admin**
   - Username: `admin`
   - Password: `admin123`
   - Email: `admin@vehiclemanagement.com`
   - Role: `SUPER_ADMIN`

2. **Regular User**
   - Username: `user`
   - Password: `user123`
   - Email: `user@vehiclemanagement.com`
   - Role: `USER`

## Security

- JWT tokens expire after 24 hours (configurable)
- Passwords are encrypted using BCrypt with strength 12
- Role-based access control (RBAC) implemented
- Method-level security enabled with `@PreAuthorize` annotations

## Usage Examples

### 1. Login
```bash
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

### 2. Get Current User
```bash
curl -X GET http://localhost:8080/api/auth/me \
  -H "Authorization: Bearer <your-jwt-token>"
```

### 3. Create New User (Admin)
```bash
curl -X POST http://localhost:8080/api/admin/users \
  -H "Authorization: Bearer <admin-jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "newuser",
    "email": "newuser@example.com",
    "password": "password123",
    "firstName": "John",
    "lastName": "Doe",
    "role": "USER"
  }'
```

### 4. Get All Users (Admin)
```bash
curl -X GET "http://localhost:8080/api/admin/users?page=0&size=10" \
  -H "Authorization: Bearer <admin-jwt-token>"
```
