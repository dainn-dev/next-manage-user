/**
 * Excel Export Utility
 * Provides functions to export data to Excel-compatible format
 */

export interface ExportOptions {
  filename: string
  sheetName?: string
  includeHeaders?: boolean
}

export interface ExcelExportData {
  headers: string[]
  rows: (string | number)[][]
}

/**
 * Export data to CSV format that Excel can open
 */
export function exportToExcel(data: ExcelExportData, options: ExportOptions) {
  try {
    // Create CSV content
    const csvContent = createCSVContent(data)
    
    // Add BOM for UTF-8 to ensure proper encoding in Excel
    const BOM = '\uFEFF'
    const csvWithBOM = BOM + csvContent
    
    // Create blob and download
    const blob = new Blob([csvWithBOM], {
      type: 'text/csv;charset=utf-8'
    })
    
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${options.filename}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
    
    return true
  } catch (error) {
    console.error('Error exporting to Excel:', error)
    return false
  }
}

/**
 * Create CSV content from data
 */
function createCSVContent(data: ExcelExportData): string {
  const { headers, rows } = data
  
  let csvContent = ''
  
  // Add headers
  if (headers.length > 0) {
    csvContent += headers.map(header => escapeCSVField(String(header))).join(',') + '\n'
  }
  
  // Add data rows
  rows.forEach(row => {
    csvContent += row.map(cell => escapeCSVField(String(cell))).join(',') + '\n'
  })
  
  return csvContent
}

/**
 * Escape CSV field content
 */
function escapeCSVField(text: string): string {
  // If field contains comma, quote, or newline, wrap in quotes and escape quotes
  if (text.includes(',') || text.includes('"') || text.includes('\n') || text.includes('\r')) {
    return '"' + text.replace(/"/g, '""') + '"'
  }
  return text
}

/**
 * Export employees to Excel
 */
export function exportEmployeesToExcel(employees: any[], filename: string = 'danh_sach_nhan_vien') {
  const headers = [
    'ID',
    'Mã nhân viên',
    'Họ và tên',
    'Giới tính',
    'Ngày sinh',
    'Số điện thoại',
    'Email',
    'Đơn vị',
    'Chức vụ',
    'Cấp bậc',
    'Trạng thái',
    'Ngày tạo'
  ]

  const rows = employees.map(employee => [
    employee.id || '',
    employee.employeeId || '',
    employee.name || '',
    employee.gender === 'MALE' ? 'Nam' : employee.gender === 'FEMALE' ? 'Nữ' : '',
    employee.birthDate ? new Date(employee.birthDate).toLocaleDateString('vi-VN') : '',
    employee.phone || '',
    employee.email || '',
    employee.department || '',
    employee.position || '',
    employee.rank || '',
    getEmployeeStatusLabel(employee.status),
    employee.createdAt ? new Date(employee.createdAt).toLocaleDateString('vi-VN') : ''
  ])

  return exportToExcel({ headers, rows }, { filename, sheetName: 'Nhân viên' })
}

/**
 * Export vehicles to Excel
 */
export function exportVehiclesToExcel(vehicles: any[], filename: string = 'danh_sach_xe') {
  const headers = [
    'ID',
    'Biển số xe',
    'Chủ xe',
    'Loại xe',
    'Hãng xe',
    'Model',
    'Màu sắc',
    'Năm sản xuất',
    'Số khung',
    'Số máy',
    'Ngày đăng ký',
    'Ngày hết hạn',
    'Loại nhiên liệu',
    'Trạng thái',
    'Ghi chú'
  ]

  const rows = vehicles.map(vehicle => [
    vehicle.id || '',
    vehicle.licensePlate || '',
    vehicle.employeeName || '',
    getVehicleTypeLabel(vehicle.vehicleType),
    vehicle.brand || '',
    vehicle.model || '',
    vehicle.color || '',
    vehicle.year || '',
    vehicle.chassisNumber || '',
    vehicle.engineNumber || '',
    vehicle.registrationDate ? new Date(vehicle.registrationDate).toLocaleDateString('vi-VN') : '',
    vehicle.expiryDate ? new Date(vehicle.expiryDate).toLocaleDateString('vi-VN') : '',
    getFuelTypeLabel(vehicle.fuelType),
    getVehicleStatusLabel(vehicle.status),
    vehicle.notes || ''
  ])

  return exportToExcel({ headers, rows }, { filename, sheetName: 'Xe' })
}

/**
 * Helper functions for status labels
 */
function getEmployeeStatusLabel(status: string): string {
  switch (status) {
    case 'HOAT_DONG': return 'Hoạt động'
    case 'TRANH_THU': return 'Tranh thủ'
    case 'PHEP': return 'Phép'
    case 'LY_DO_KHAC': return 'Lý do Khác'
    default: return status
  }
}

function getVehicleTypeLabel(type: string): string {
  switch (type) {
    case 'car': return 'Ô tô'
    case 'motorbike': return 'Xe máy'
    case 'truck': return 'Xe tải'
    case 'bus': return 'Xe bus'
    default: return type
  }
}

function getFuelTypeLabel(type: string): string {
  switch (type) {
    case 'gasoline': return 'Xăng'
    case 'diesel': return 'Diesel'
    case 'electric': return 'Điện'
    case 'hybrid': return 'Hybrid'
    default: return type || ''
  }
}

function getVehicleStatusLabel(status: string): string {
  switch (status) {
    case 'approved': return 'Duyệt'
    case 'rejected': return 'Không được phép'
    case 'exited': return 'Đã ra'
    case 'entered': return 'Đã vào'
    default: return status
  }
}

/**
 * Export vehicle logs (entry/exit) to Excel
 */
export function exportVehicleLogsToExcel(logs: any[], filename: string = 'bao-cao-xe-ra-vao') {
  const headers = [
    'STT',
    'Biển số xe',
    'Loại',
    'Thời gian',
    'Mục đích',
    'Vị trí cổng',
    'Lái xe',
    'Loại xe',
    'Ghi chú'
  ]

  const rows = logs.map((log, index) => [
    index + 1,
    log.licensePlateNumber || '',
    log.type === 'entry' ? 'Vào' : 'Ra',
    log.entryExitTime ? new Date(log.entryExitTime).toLocaleString('vi-VN') : '',
    log.purpose || '',
    log.gateLocation || '',
    log.driverName || '',
    log.vehicleType === 'internal' ? 'Nội bộ' : 'Bên ngoài',
    log.notes || ''
  ])

  try {
    const csvContent = createCSVContent({ headers, rows })
    const BOM = '﻿'
    const blob = new Blob([BOM + csvContent], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=utf-8' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${filename}.xlsx`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
    return true
  } catch (error) {
    console.error('Error exporting vehicle logs:', error)
    return false
  }
}
