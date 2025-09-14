# Excel Import/Export API for Entry/Exit Requests

## Overview
This document describes the Excel import/export functionality for Entry/Exit Requests in the Vehicle Management System.

## Backend API Endpoints

### Export Endpoints

#### 1. Export All Requests
- **Endpoint**: `POST /api/entry-exit-requests/export/excel`
- **Description**: Exports all entry/exit requests to Excel
- **Response**: Excel file download
- **Filename**: `entry_exit_requests.xlsx`

#### 2. Export by Status
- **Endpoint**: `POST /api/entry-exit-requests/export/excel/status/{status}`
- **Description**: Exports requests filtered by status
- **Parameters**:
  - `status`: `pending`, `approved`, or `rejected`
- **Response**: Excel file download
- **Filename**: `entry_exit_requests_{status}.xlsx`

#### 3. Export by Date Range
- **Endpoint**: `POST /api/entry-exit-requests/export/excel/date-range`
- **Description**: Exports requests within a date range
- **Parameters**:
  - `startDate`: Start date (yyyy-MM-dd HH:mm:ss)
  - `endDate`: End date (yyyy-MM-dd HH:mm:ss)
- **Response**: Excel file download
- **Filename**: `entry_exit_requests_{startDate}_to_{endDate}.xlsx`

### Import Endpoints

#### 4. Import from Excel
- **Endpoint**: `POST /api/entry-exit-requests/import/excel`
- **Description**: Imports entry/exit requests from Excel file
- **Content-Type**: `multipart/form-data`
- **Parameters**:
  - `file`: Excel file (.xlsx or .xls)
- **Response**: `ImportResultDto`
```json
{
  "totalRows": 10,
  "successCount": 8,
  "errorCount": 2,
  "errors": ["Row 3: Employee not found: John Doe", "Row 7: Invalid date format"],
  "importedRequests": [...]
}
```

#### 5. Download Template
- **Endpoint**: `GET /api/entry-exit-requests/template/excel`
- **Description**: Downloads Excel template for import
- **Response**: Excel file download
- **Filename**: `entry_exit_requests_template.xlsx`

## Excel File Format

### Headers
| Column | Field | Type | Required | Description |
|--------|-------|------|----------|-------------|
| A | ID | String | No | Auto-generated (leave empty for new records) |
| B | Employee ID | String | Yes | Employee UUID or ID |
| C | Employee Name | String | Yes | Employee name |
| D | Vehicle ID | String | No | Vehicle UUID (auto-filled from license plate) |
| E | License Plate | String | Yes | Vehicle license plate |
| F | Request Type | String | Yes | "entry" or "exit" |
| G | Request Time | DateTime | Yes | Format: yyyy-MM-dd HH:mm:ss |
| H | Status | String | No | "pending", "approved", or "rejected" (default: "pending") |
| I | Approved By | String | No | Name of approver |
| J | Approved At | DateTime | No | Format: yyyy-MM-dd HH:mm:ss |
| K | Notes | String | No | Additional notes |
| L | Created At | DateTime | No | Auto-generated (leave empty) |

### Sample Data
```
ID | Employee ID | Employee Name | Vehicle ID | License Plate | Request Type | Request Time | Status | Approved By | Approved At | Notes | Created At
(Auto) | 1 | Nguyễn Văn An | (Auto) | 30A-12345 | entry | 2024-01-15 08:30:00 | pending | | | Sample notes | (Auto)
```

## Frontend Implementation

### Components

#### 1. EntryExitExportDialog
- **Location**: `components/vehicles/entry-exit-export-dialog.tsx`
- **Features**:
  - Export all requests
  - Export by status filter
  - Export by date range
  - Download template
  - Progress indicators

#### 2. EntryExitImportDialog
- **Location**: `components/vehicles/entry-exit-import-dialog.tsx`
- **Features**:
  - File upload with validation
  - Import progress tracking
  - Detailed error reporting
  - Success/failure statistics
  - Template download

### API Service

#### EntryExitRequestExcelApiService
- **Location**: `lib/api/entry-exit-request-excel-api.ts`
- **Methods**:
  - `exportAllToExcel()`: Export all requests
  - `exportByStatusToExcel(status)`: Export by status
  - `exportByDateRangeToExcel(startDate, endDate)`: Export by date range
  - `importFromExcel(file)`: Import from Excel file
  - `downloadTemplate()`: Download template

## Usage Instructions

### Export Data
1. Navigate to Vehicle Requests page
2. Click "Xuất Excel" button
3. Choose export type:
   - **All**: Export all requests
   - **By Status**: Select status filter
   - **By Date Range**: Select start and end dates
4. Click "Xuất Excel" to download

### Import Data
1. Navigate to Vehicle Requests page
2. Click "Nhập Excel" button
3. Download template (optional)
4. Fill template with data
5. Upload Excel file
6. Review import results
7. Check error details if any

## Validation Rules

### Required Fields
- Employee ID or Employee Name
- License Plate
- Request Type (entry/exit)
- Request Time

### Data Validation
- Employee must exist in system
- Vehicle must exist in system (by license plate)
- Request Type must be "entry" or "exit"
- Status must be "pending", "approved", or "rejected"
- Date format must be yyyy-MM-dd HH:mm:ss

### Error Handling
- Invalid file format
- Missing required fields
- Invalid data types
- Non-existent employees/vehicles
- Invalid date formats
- Duplicate entries

## Dependencies

### Backend
- Apache POI (Excel processing)
- Spring Boot
- JPA/Hibernate

### Frontend
- React
- TypeScript
- Next.js
- Lucide React (icons)

## Error Codes

| Error | Description | Solution |
|-------|-------------|----------|
| 400 | Invalid file format | Use .xlsx or .xls files |
| 400 | Missing required fields | Fill all required columns |
| 404 | Employee not found | Check employee ID/name |
| 404 | Vehicle not found | Check license plate |
| 422 | Invalid data format | Check date/time formats |
| 500 | Server error | Contact administrator |

## Best Practices

### For Export
- Use appropriate filters to reduce file size
- Export regularly for backup purposes
- Use date ranges for large datasets

### For Import
- Always use the provided template
- Validate data before importing
- Import in small batches for large datasets
- Review error reports carefully
- Test with sample data first

## Troubleshooting

### Common Issues
1. **File not uploading**: Check file size and format
2. **Import errors**: Verify employee/vehicle exist in system
3. **Date format errors**: Use yyyy-MM-dd HH:mm:ss format
4. **Permission errors**: Check user permissions
5. **Timeout errors**: Reduce batch size

### Support
For technical support, contact the development team with:
- Error messages
- Sample data
- Steps to reproduce
- Browser/OS information
