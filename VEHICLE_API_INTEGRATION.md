# Vehicle Management & Entry/Exit Request API Integration

This document describes the complete implementation of the Vehicle Management and Entry/Exit Request functionality with backend API integration.

## 🚗 Vehicle Management API

### Backend Endpoints

The Vehicle API provides comprehensive CRUD operations and advanced features:

#### Base URL: `/api/vehicles`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Get all vehicles (paginated) |
| GET | `/list` | Get all vehicles (no pagination) |
| GET | `/{id}` | Get vehicle by ID |
| GET | `/license-plate/{licensePlate}` | Get vehicle by license plate |
| GET | `/employee/{employeeId}` | Get vehicles by employee |
| GET | `/type/{vehicleType}` | Get vehicles by type |
| GET | `/status/{status}` | Get vehicles by status |
| GET | `/search` | Search vehicles by criteria |
| GET | `/search/type/{vehicleType}` | Search vehicles by type |
| GET | `/search/status/{status}` | Search vehicles by status |
| POST | `/` | Create new vehicle |
| PUT | `/{id}` | Update vehicle |
| DELETE | `/{id}` | Delete vehicle |
| GET | `/exists/license-plate/{licensePlate}` | Check if license plate exists |
| GET | `/stats/count/status/{status}` | Get vehicle count by status |
| GET | `/stats/count/type` | Get vehicle count by type |
| GET | `/stats/count/fuel-type` | Get vehicle count by fuel type |

### Vehicle Data Structure

```typescript
interface Vehicle {
  id: string
  employeeId: string
  employeeName: string
  licensePlate: string
  vehicleType: "car" | "motorbike" | "truck" | "bus"
  brand?: string
  model?: string
  color?: string
  year?: number
  engineNumber?: string
  chassisNumber?: string
  registrationDate: string
  expiryDate?: string
  insuranceNumber?: string
  insuranceExpiry?: string
  status: "active" | "inactive" | "maintenance" | "retired"
  fuelType?: "gasoline" | "diesel" | "electric" | "hybrid"
  capacity?: number
  notes?: string
  createdAt: string
  updatedAt: string
}
```

## 🚪 Entry/Exit Request API

### Backend Endpoints

The Entry/Exit Request API provides comprehensive request management:

#### Base URL: `/entry-exit-requests`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Get all requests (paginated) |
| GET | `/list` | Get all requests (no pagination) |
| GET | `/{id}` | Get request by ID |
| GET | `/employee/{employeeId}` | Get requests by employee |
| GET | `/vehicle/{vehicleId}` | Get requests by vehicle |
| GET | `/type/{requestType}` | Get requests by type |
| GET | `/status/{status}` | Get requests by status |
| GET | `/search` | Search requests by criteria |
| GET | `/search/type/{requestType}` | Search requests by type |
| GET | `/search/status/{status}` | Search requests by status |
| GET | `/date-range` | Get requests by date range |
| GET | `/employee/{employeeId}/date-range` | Get employee requests by date range |
| GET | `/vehicle/{vehicleId}/date-range` | Get vehicle requests by date range |
| POST | `/` | Create new request |
| PUT | `/{id}` | Update request |
| PUT | `/{id}/approve` | Approve request |
| PUT | `/{id}/reject` | Reject request |
| DELETE | `/{id}` | Delete request |
| GET | `/stats/count/status/{status}` | Get request count by status |
| GET | `/stats/count/type/{requestType}` | Get request count by type |
| GET | `/stats/unique-vehicles/date-range` | Get unique vehicle count in date range |
| GET | `/stats/daily` | Get daily statistics |

### Entry/Exit Request Data Structure

```typescript
interface EntryExitRequest {
  id: string
  employeeId: string
  employeeName: string
  vehicleId: string
  licensePlate: string
  requestType: "entry" | "exit"
  requestTime: string
  approvedBy?: string
  approvedAt?: string
  status: "pending" | "approved" | "rejected"
  notes?: string
  createdAt: string
}
```

## 🎨 Frontend Implementation

### API Services

#### Vehicle API Service (`vehicleApi`)

- **Type-safe API calls** with proper TypeScript interfaces
- **Automatic error handling** with fallback to mock data
- **Comprehensive endpoint coverage** for all vehicle operations
- **Pagination support** for large datasets
- **Search and filtering** capabilities

#### Entry/Exit Request API Service (`entryExitRequestApi`)

- **Complete CRUD operations** for request management
- **Approval/rejection workflows** with proper API calls
- **Date range filtering** for time-based queries
- **Statistics and analytics** endpoints
- **Advanced search capabilities**

### Data Service Integration

The `dataService` has been updated to:

- **Use real API calls** for all vehicle and request operations
- **Fallback to mock data** when API is unavailable
- **Handle async operations** properly with error handling
- **Provide comprehensive logging** for debugging
- **Maintain data consistency** across operations

### UI Components

#### Vehicle Management Page

- **Loading states** with spinner animations
- **Error handling** with user-friendly messages and retry functionality
- **Real-time data updates** after all operations
- **Tabbed interface** for vehicles and requests
- **Responsive design** for all screen sizes

#### Vehicle Table Component

- **Search and filter** functionality with real-time results
- **Bulk operations** support with API integration
- **Refresh functionality** connected to API
- **Action buttons** for CRUD operations
- **Status indicators** and visual feedback

#### Vehicle Requests Table Component

- **Request management** with approval/rejection workflows
- **Status filtering** and search capabilities
- **Date range filtering** for historical data
- **Bulk operations** for multiple requests
- **Real-time updates** after status changes

## 🚀 Setup Instructions

### Backend Setup

1. **Start the backend server**:
   ```bash
   cd backend
   ./mvnw spring-boot:run
   ```

2. **Verify database migrations**:
   - `V1__Create_employees_table.sql` - Employee management
   - `V2__Create_vehicles_table.sql` - Vehicle management
   - `V3__Create_custom_fields_table.sql` - Custom fields
   - `V4__Insert_sample_data.sql` - Sample data

3. **Test API endpoints**:
   - Visit `http://localhost:8080/swagger-ui.html` for API documentation
   - Test vehicle endpoints: `/vehicles`
   - Test request endpoints: `/entry-exit-requests`

### Frontend Setup

1. **Set environment variable**:
   ```bash
   # Create .env.local file
   echo "NEXT_PUBLIC_API_URL=http://localhost:8080" > .env.local
   ```

2. **Start the frontend**:
   ```bash
   pnpm dev
   ```

3. **Access the application**:
   - Visit `http://localhost:3000/vehicles`
   - The page will load vehicles and requests from the API

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NEXT_PUBLIC_API_URL` | Backend API base URL | `http://localhost:8080` |

### API Configuration

Both APIs automatically:
- **Handle CORS** with `@CrossOrigin(origins = "*")`
- **Provide Swagger documentation** with `@Tag` annotations
- **Validate input** with `@Valid` annotations
- **Return proper HTTP status codes**
- **Support pagination** and sorting

## 📊 Features

### Vehicle Management Features

- ✅ **Full CRUD Operations** (Create, Read, Update, Delete)
- ✅ **Advanced Search & Filtering** by license plate, type, status, employee
- ✅ **Pagination Support** for large datasets
- ✅ **License Plate Validation** with duplicate checking
- ✅ **Vehicle Type Support** (car, motorbike, truck, bus)
- ✅ **Status Management** (active, inactive, maintenance, retired)
- ✅ **Fuel Type Tracking** (gasoline, diesel, electric, hybrid)
- ✅ **Insurance & Registration** date tracking
- ✅ **Statistics & Analytics** by type, status, fuel type
- ✅ **Bulk Operations** for multiple vehicles

### Entry/Exit Request Features

- ✅ **Request Management** with approval workflows
- ✅ **Employee & Vehicle Association** with proper relationships
- ✅ **Request Types** (entry/exit) with status tracking
- ✅ **Approval System** with approver tracking
- ✅ **Date Range Filtering** for historical analysis
- ✅ **Search Capabilities** across all request fields
- ✅ **Statistics & Analytics** by status, type, date ranges
- ✅ **Unique Vehicle Tracking** in date ranges
- ✅ **Daily Statistics** for reporting
- ✅ **Bulk Operations** for multiple requests

### Frontend Features

- ✅ **Real-time Data Loading** from API
- ✅ **Loading & Error States** with user feedback
- ✅ **Search & Filter UI** with instant results
- ✅ **Refresh Functionality** connected to API
- ✅ **Friendly User Interface** with clear messaging
- ✅ **Type-safe Operations** with TypeScript
- ✅ **Responsive Design** for all devices
- ✅ **Graceful Degradation** with mock data fallback
- ✅ **Error Recovery** with retry mechanisms

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

4. **Data Not Loading**:
   - Check API endpoints in browser network tab
   - Verify backend logs for errors
   - Ensure database has sample data

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

- **Pagination** for large datasets (vehicles and requests)
- **Caching** of frequently accessed data
- **Optimized queries** with proper database indexing
- **Lazy loading** of non-critical data
- **Error boundaries** for robust error handling
- **Parallel API calls** for better performance

## 🔐 Security Features

- **Input validation** on both frontend and backend
- **SQL injection prevention** with JPA
- **CORS configuration** for cross-origin requests
- **Error message sanitization** to prevent information leakage
- **License plate validation** to prevent duplicates
- **Request approval workflows** for access control

## 🎯 Use Cases

### Vehicle Management

1. **Add New Vehicle**: Register a new vehicle with complete details
2. **Update Vehicle Info**: Modify vehicle details, status, or ownership
3. **Search Vehicles**: Find vehicles by license plate, type, or owner
4. **Bulk Operations**: Update multiple vehicles simultaneously
5. **Vehicle Statistics**: View analytics by type, status, or fuel type

### Entry/Exit Request Management

1. **Create Request**: Submit entry/exit requests for vehicles
2. **Approve/Reject**: Process pending requests with approval workflows
3. **Track History**: View request history by employee, vehicle, or date range
4. **Generate Reports**: Export statistics and analytics
5. **Monitor Activity**: Track unique vehicles and daily statistics

## 🚀 Future Enhancements

- **Real-time notifications** for request status changes
- **Mobile app integration** for field operations
- **Advanced reporting** with charts and graphs
- **Integration with external systems** (parking, security)
- **Automated approval workflows** based on rules
- **GPS tracking** for vehicle locations
- **QR code generation** for quick vehicle identification

The implementation provides a solid foundation for vehicle and request management with room for future enhancements and integrations.
