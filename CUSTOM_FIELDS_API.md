# Custom Fields API Implementation

This document describes the implementation of the Custom Fields functionality with backend API integration.

## 🏗️ Backend Implementation

### Database Schema

The `custom_fields` table includes the following columns:

- `id` (UUID, Primary Key)
- `name` (VARCHAR, Unique) - Field display name
- `type` (ENUM) - Field type: text, number, date, select, checkbox, textarea
- `options` (TEXT) - JSON string for select field options
- `required` (BOOLEAN) - Whether the field is required
- `category` (VARCHAR) - Field category for grouping
- `field_order` (INTEGER) - Display order
- `description` (TEXT) - Field description
- `default_value` (TEXT) - Default value for the field
- `validation_rules` (TEXT) - JSON string for validation rules
- `is_active` (BOOLEAN) - Whether the field is active
- `created_at` (TIMESTAMP) - Creation timestamp
- `updated_at` (TIMESTAMP) - Last update timestamp

### API Endpoints

#### Base URL: `/api/custom-fields`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Get all custom fields (paginated) |
| GET | `/list` | Get all custom fields (no pagination) |
| GET | `/active` | Get all active custom fields |
| GET | `/active/paginated` | Get active custom fields (paginated) |
| GET | `/{id}` | Get custom field by ID |
| GET | `/category/{category}` | Get fields by category |
| GET | `/category/{category}/active` | Get active fields by category |
| GET | `/type/{type}` | Get fields by type |
| GET | `/type/{type}/active` | Get active fields by type |
| GET | `/required/{required}` | Get fields by required flag |
| GET | `/required/{required}/active` | Get active fields by required flag |
| GET | `/search` | Search fields by name or category |
| POST | `/` | Create new custom field |
| PUT | `/{id}` | Update custom field |
| DELETE | `/{id}` | Delete custom field |
| PATCH | `/{id}/toggle-status` | Toggle field active status |
| PUT | `/reorder` | Reorder fields |
| GET | `/categories` | Get all unique categories |
| GET | `/categories/active` | Get active categories |
| GET | `/stats/category` | Get statistics by category |
| GET | `/stats/category/active` | Get active statistics by category |
| GET | `/stats/type` | Get statistics by type |
| GET | `/stats/type/active` | Get active statistics by type |
| GET | `/exists/name/{name}` | Check if field name exists |
| GET | `/exists/name/{name}/exclude/{id}` | Check if field name exists (excluding ID) |

### Sample Data

The migration includes 20 sample custom fields covering:

- **Basic Information**: Employee ID, Full Name
- **Contact Information**: Email, Phone, Address
- **Work Information**: Department, Position, Hire Date
- **Personal Information**: Birth Date, Gender
- **Emergency Information**: Emergency Contact, Emergency Phone
- **Financial Information**: Salary
- **Security Information**: Access Level
- **Vehicle Information**: Has Vehicle, Vehicle Type, License Plate, Insurance
- **Additional Information**: Notes, Is Active

## 🎨 Frontend Implementation

### API Service

The `customFieldsApi` service provides:

- **Automatic error handling** with fallback to mock data
- **Type-safe API calls** with proper TypeScript interfaces
- **Consistent response handling** across all endpoints
- **Environment-based configuration** for API URL

### Data Service Integration

The `dataService` has been updated to:

- **Use real API calls** for custom fields operations
- **Fallback to mock data** when API is unavailable
- **Handle async operations** properly
- **Provide error logging** for debugging

### UI Components

#### Custom Fields Page
- **Loading states** with spinner animation
- **Error handling** with retry functionality
- **Real-time data updates** after operations
- **Friendly user interface** with emojis and clear messaging

#### Custom Fields Table
- **Search and filter** functionality
- **Refresh button** connected to API
- **Action buttons** for CRUD operations
- **Responsive design** for different screen sizes

## 🚀 Setup Instructions

### Backend Setup

1. **Start the backend server**:
   ```bash
   cd backend
   ./mvnw spring-boot:run
   ```

2. **Verify database migration**:
   - The `V3__Create_custom_fields_table.sql` migration will run automatically
   - Sample data will be inserted into the `custom_fields` table

3. **Test API endpoints**:
   - Visit `http://localhost:8080/api/swagger-ui.html` for API documentation
   - Test endpoints using the Swagger UI

### Frontend Setup

1. **Set environment variable**:
   ```bash
   # Create .env.local file
   echo "NEXT_PUBLIC_API_URL=http://localhost:8080/api" > .env.local
   ```

2. **Start the frontend**:
   ```bash
   pnpm dev
   ```

3. **Access the application**:
   - Visit `http://localhost:3000/custom-fields`
   - The page will load custom fields from the API

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NEXT_PUBLIC_API_URL` | Backend API base URL | `http://localhost:8080/api` |

### API Configuration

The API service automatically:
- **Handles CORS** with `@CrossOrigin(origins = "*")`
- **Provides Swagger documentation** with `@Tag` annotations
- **Validates input** with `@Valid` annotations
- **Returns proper HTTP status codes**

## 📊 Features

### Backend Features

- ✅ **Full CRUD operations** for custom fields
- ✅ **Advanced search and filtering**
- ✅ **Pagination support**
- ✅ **Field reordering**
- ✅ **Category management**
- ✅ **Statistics and analytics**
- ✅ **Data validation**
- ✅ **Error handling**

### Frontend Features

- ✅ **Real-time data loading**
- ✅ **Loading and error states**
- ✅ **Search and filter UI**
- ✅ **Responsive design**
- ✅ **Friendly user interface**
- ✅ **API integration with fallback**
- ✅ **Type-safe operations**

## 🐛 Troubleshooting

### Common Issues

1. **API Connection Failed**:
   - Check if backend server is running on port 8080
   - Verify `NEXT_PUBLIC_API_URL` environment variable
   - Check browser console for CORS errors

2. **Database Migration Issues**:
   - Ensure PostgreSQL is running
   - Check database connection in `application.yml`
   - Verify migration files are in correct order

3. **Frontend Build Errors**:
   - Run `pnpm install` to install dependencies
   - Check TypeScript errors in console
   - Verify all imports are correct

### Debug Mode

Enable debug logging by setting:
```bash
# In .env.local
NODE_ENV=development
```

This will show detailed API request/response logs in the browser console.

## 🔄 Migration from Mock Data

The implementation includes automatic fallback to mock data when the API is unavailable, ensuring:

- **Seamless development** without backend dependency
- **Graceful degradation** in case of API issues
- **Easy testing** with consistent mock data
- **Production readiness** with real API integration

## 📈 Performance Considerations

- **Pagination** for large datasets
- **Caching** of frequently accessed data
- **Optimized queries** with proper indexing
- **Lazy loading** of non-critical data
- **Error boundaries** for robust error handling

## 🔐 Security Features

- **Input validation** on both frontend and backend
- **SQL injection prevention** with JPA
- **CORS configuration** for cross-origin requests
- **Error message sanitization** to prevent information leakage
