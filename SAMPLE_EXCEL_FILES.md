# Sample Excel Files for Entry/Exit Request Import

## 📁 Available Sample Files

### 1. `sample_entry_exit_requests.csv`
- **Purpose**: Complete sample file with 10 entry/exit requests
- **Format**: CSV (can be opened in Excel)
- **Use Case**: Testing import functionality with realistic data

### 2. `entry_exit_template.csv`
- **Purpose**: Template with headers and one sample row
- **Format**: CSV (can be opened in Excel)
- **Use Case**: Starting point for creating new import files

## 📊 Sample Data Overview

The sample files contain the following types of data:

### Request Types
- **entry**: Vehicle entering the premises
- **exit**: Vehicle leaving the premises

### Status Types
- **pending**: Awaiting approval
- **approved**: Approved by administrator
- **rejected**: Rejected by administrator

### Sample Employees
- Nguyễn Văn An (ID: 1)
- Trần Thị Bình (ID: 2)
- Lê Văn Cường (ID: 3)
- Phạm Thị Dung (ID: 4)
- Hoàng Văn Em (ID: 5)
- Võ Thị Phương (ID: 6)

### Sample Vehicles
- 30A-12345 (ID: 1)
- 29B-67890 (ID: 2)
- 51C-11111 (ID: 3)
- 43D-22222 (ID: 4)
- 92E-33333 (ID: 5)
- 75F-44444 (ID: 6)

## 🔧 How to Use

### Option 1: Convert CSV to Excel
1. Open the CSV file in Excel or Google Sheets
2. Save as Excel format (.xlsx)
3. Use the Excel file for import testing

### Option 2: Use CSV Directly
1. Some systems accept CSV files
2. Upload the CSV file directly

### Option 3: Create Your Own
1. Use the template file as a starting point
2. Add your own data following the format
3. Save as Excel format

## 📋 File Format Requirements

### Required Columns
| Column | Description | Example | Required |
|--------|-------------|---------|----------|
| ID | Auto-generated ID | (Auto-generated) | No |
| Employee ID | Employee identifier | 1 | Yes |
| Employee Name | Employee full name | Nguyễn Văn An | Yes |
| Vehicle ID | Vehicle identifier | 1 | No (auto-filled) |
| License Plate | Vehicle license plate | 30A-12345 | Yes |
| Request Type | entry or exit | entry | Yes |
| Request Time | Date and time | 2024-01-15 08:30:00 | Yes |
| Status | pending/approved/rejected | pending | No |
| Approved By | Approver name | admin | No |
| Approved At | Approval time | 2024-01-15 09:20:00 | No |
| Notes | Additional notes | Sample notes | No |
| Created At | Creation time | (Auto-generated) | No |

### Data Validation Rules

#### Request Type
- Must be exactly: `entry` or `exit`
- Case sensitive

#### Status
- Must be exactly: `pending`, `approved`, or `rejected`
- Case sensitive
- Default: `pending`

#### Date Format
- Must be: `yyyy-MM-dd HH:mm:ss`
- Example: `2024-01-15 08:30:00`

#### Employee and Vehicle
- Employee ID and License Plate must exist in the system
- Employee Name is used as fallback if Employee ID not found

## 🚀 Testing the Import

### Step 1: Prepare the File
1. Open `sample_entry_exit_requests.csv` in Excel
2. Save as Excel format (.xlsx)
3. Or use the CSV file directly

### Step 2: Test Import
1. Go to Vehicle Requests page
2. Click "Nhập Excel" button
3. Upload the sample file
4. Review import results

### Step 3: Verify Results
- Check success/error counts
- Review any error messages
- Verify data appears in the system

## ⚠️ Important Notes

### Before Importing
1. **Ensure employees exist**: The sample employees (IDs 1-6) must exist in your system
2. **Ensure vehicles exist**: The sample vehicles (license plates) must exist in your system
3. **Check date format**: Use the exact format `yyyy-MM-dd HH:mm:ss`

### Common Issues
1. **Employee not found**: Add the sample employees to your system first
2. **Vehicle not found**: Add the sample vehicles to your system first
3. **Date format error**: Ensure dates are in the correct format
4. **Invalid status**: Use only `pending`, `approved`, or `rejected`

## 📝 Creating Your Own Data

### Template Usage
1. Copy `entry_exit_template.csv`
2. Add your data rows
3. Follow the format exactly
4. Save as Excel format

### Data Guidelines
- Use existing Employee IDs and License Plates
- Follow the exact date format
- Use valid status values
- Add meaningful notes

## 🔍 Troubleshooting

### Import Errors
- Check that all required fields are filled
- Verify Employee ID and License Plate exist
- Ensure date format is correct
- Check for typos in status values

### File Format Issues
- Ensure file is saved as .xlsx or .xls
- Check that headers match exactly
- Verify no extra spaces in data

### System Requirements
- Employees must exist in the system
- Vehicles must exist in the system
- User must have import permissions

## 📞 Support

If you encounter issues:
1. Check the error messages in the import dialog
2. Verify your data format matches the sample
3. Ensure all referenced employees and vehicles exist
4. Contact the development team for assistance
