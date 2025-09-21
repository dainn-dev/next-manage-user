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
 * Export statistics report to Excel
 */
export function exportStatisticsToExcel(data: {
  employees: any[]
  vehicles: any[]
  departments: any[]
  users: any[]
  positions: any[]
  vehicleStats?: any
  userStats?: any
  positionStats?: any
}, filename: string = 'bao_cao_thong_ke') {
  try {
    const timestamp = new Date().toLocaleString('vi-VN')
    
    // Create comprehensive statistics report
    const reportData = generateStatisticsReport(data, timestamp)
    
    return exportToExcel(reportData, { 
      filename, 
      sheetName: 'Báo cáo thống kê' 
    })
  } catch (error) {
    console.error('Error exporting statistics:', error)
    return false
  }
}

/**
 * Generate comprehensive statistics report
 */
function generateStatisticsReport(data: any, timestamp: string): ExcelExportData {
  const { employees, vehicles, departments, users, positions, vehicleStats, userStats, positionStats } = data
  
  // Calculate statistics
  const employeeStats = calculateEmployeeStatistics(employees)
  const vehicleStatsCalc = calculateVehicleStatistics(vehicles)
  const departmentStats = calculateDepartmentStatistics(employees, departments)
  
  const headers = [
    'Loại thống kê',
    'Mô tả',
    'Số lượng',
    'Tỷ lệ (%)',
    'Ghi chú'
  ]
  
  const rows: (string | number)[][] = [
    // Header
    ['BÁO CÁO THỐNG KÊ TỔNG QUAN', '', '', '', ''],
    ['Thời gian tạo báo cáo:', timestamp, '', '', ''],
    ['', '', '', '', ''],
    
    // Employee Statistics
    ['THỐNG KÊ NHÂN VIÊN', '', '', '', ''],
    ['Tổng số nhân viên', 'Tổng số nhân viên trong hệ thống', employeeStats.total, 100, ''],
    ['Hoạt động', 'Nhân viên đang hoạt động', employeeStats.active, employeeStats.total > 0 ? Math.round((employeeStats.active / employeeStats.total) * 100) : 0, ''],
    ['Tranh thủ', 'Nhân viên tranh thủ', employeeStats.tranhThu, employeeStats.total > 0 ? Math.round((employeeStats.tranhThu / employeeStats.total) * 100) : 0, ''],
    ['Phép', 'Nhân viên đang phép', employeeStats.phep, employeeStats.total > 0 ? Math.round((employeeStats.phep / employeeStats.total) * 100) : 0, ''],
    ['Lý do khác', 'Nhân viên lý do khác', employeeStats.lyDoKhac, employeeStats.total > 0 ? Math.round((employeeStats.lyDoKhac / employeeStats.total) * 100) : 0, ''],
    ['Tuổi trung bình', 'Tuổi trung bình của nhân viên', employeeStats.avgAge, '', ''],
    ['', '', '', '', ''],
    
    // Vehicle Statistics
    ['THỐNG KÊ XE', '', '', '', ''],
    ['Tổng số xe', 'Tổng số xe trong hệ thống', vehicleStatsCalc.total, 100, ''],
    ['Đã duyệt', 'Xe đã được duyệt', vehicleStatsCalc.approved, vehicleStatsCalc.total > 0 ? Math.round((vehicleStatsCalc.approved / vehicleStatsCalc.total) * 100) : 0, ''],
    ['Không được phép', 'Xe không được phép', vehicleStatsCalc.rejected, vehicleStatsCalc.total > 0 ? Math.round((vehicleStatsCalc.rejected / vehicleStatsCalc.total) * 100) : 0, ''],
    ['Đã ra', 'Xe đã rời khỏi khu vực', vehicleStatsCalc.exited, vehicleStatsCalc.total > 0 ? Math.round((vehicleStatsCalc.exited / vehicleStatsCalc.total) * 100) : 0, ''],
    ['Đã vào', 'Xe đã vào khu vực', vehicleStatsCalc.entered, vehicleStatsCalc.total > 0 ? Math.round((vehicleStatsCalc.entered / vehicleStatsCalc.total) * 100) : 0, ''],
    ['Ô tô', 'Số lượng ô tô', vehicleStatsCalc.cars, vehicleStatsCalc.total > 0 ? Math.round((vehicleStatsCalc.cars / vehicleStatsCalc.total) * 100) : 0, ''],
    ['Xe máy', 'Số lượng xe máy', vehicleStatsCalc.motorbikes, vehicleStatsCalc.total > 0 ? Math.round((vehicleStatsCalc.motorbikes / vehicleStatsCalc.total) * 100) : 0, ''],
    ['Xe tải', 'Số lượng xe tải', vehicleStatsCalc.trucks, vehicleStatsCalc.total > 0 ? Math.round((vehicleStatsCalc.trucks / vehicleStatsCalc.total) * 100) : 0, ''],
    ['Xe bus', 'Số lượng xe bus', vehicleStatsCalc.buses, vehicleStatsCalc.total > 0 ? Math.round((vehicleStatsCalc.buses / vehicleStatsCalc.total) * 100) : 0, ''],
    ['', '', '', '', ''],
    
    // Department Statistics
    ['THỐNG KÊ ĐƠN VỊ', '', '', '', ''],
    ['Tổng số đơn vị', 'Tổng số đơn vị trong hệ thống', departments.length, 100, ''],
    ...departmentStats.map(dept => [
      dept.name,
      `Nhân viên trong ${dept.name}`,
      dept.employeeCount,
      employeeStats.total > 0 ? Math.round((dept.employeeCount / employeeStats.total) * 100) : 0,
      ''
    ]),
    ['', '', '', '', ''],
    
    // User Statistics
    ['THỐNG KÊ NGƯỜI DÙNG', '', '', '', ''],
    ['Tổng số người dùng', 'Tổng số tài khoản người dùng', users.length, 100, ''],
    ['Quản trị viên', 'Người dùng có quyền admin', users.filter((u: any) => u.accessLevel === 'ADMIN').length, users.length > 0 ? Math.round((users.filter((u: any) => u.accessLevel === 'ADMIN').length / users.length) * 100) : 0, ''],
    ['Người dùng', 'Người dùng thông thường', users.filter((u: any) => u.accessLevel === 'USER').length, users.length > 0 ? Math.round((users.filter((u: any) => u.accessLevel === 'USER').length / users.length) * 100) : 0, ''],
    ['', '', '', '', ''],
    
    // Position Statistics
    ['THỐNG KÊ CHỨC VỤ', '', '', '', ''],
    ['Tổng số chức vụ', 'Tổng số chức vụ trong hệ thống', positions.length, 100, ''],
    ...positions.slice(0, 10).map((position: any) => [
      position.name || position.title || 'Chức vụ',
      `Chức vụ: ${position.name || position.title || 'N/A'}`,
      employees.filter((emp: any) => emp.position === (position.name || position.title)).length,
      employeeStats.total > 0 ? Math.round((employees.filter((emp: any) => emp.position === (position.name || position.title)).length / employeeStats.total) * 100) : 0,
      ''
    ]),
    ['', '', '', '', ''],
    
    // Summary
    ['TỔNG KẾT', '', '', '', ''],
    ['Tổng số thực thể', 'Tổng số bản ghi trong hệ thống', employeeStats.total + vehicleStatsCalc.total + departments.length + users.length + positions.length, 100, ''],
    ['Hiệu suất hệ thống', 'Tỷ lệ hoạt động chung', Math.round(((employeeStats.active + vehicleStatsCalc.approved) / (employeeStats.total + vehicleStatsCalc.total)) * 100), '', ''],
  ]
  
  return { headers, rows }
}

/**
 * Calculate employee statistics
 */
function calculateEmployeeStatistics(employees: any[]) {
  const total = employees.length
  const active = employees.filter(emp => emp.status === 'HOAT_DONG').length
  const tranhThu = employees.filter(emp => emp.status === 'TRANH_THU').length
  const phep = employees.filter(emp => emp.status === 'PHEP').length
  const lyDoKhac = employees.filter(emp => emp.status === 'LY_DO_KHAC').length
  
  const avgAge = employees.length > 0 ? 
    Math.round(employees.reduce((sum, emp) => {
      if (emp.birthDate) {
        const age = new Date().getFullYear() - new Date(emp.birthDate).getFullYear()
        return sum + age
      }
      return sum
    }, 0) / employees.filter(emp => emp.birthDate).length) : 0
  
  return { total, active, tranhThu, phep, lyDoKhac, avgAge }
}

/**
 * Calculate vehicle statistics
 */
function calculateVehicleStatistics(vehicles: any[]) {
  const total = vehicles.length
  const approved = vehicles.filter(v => v.status === 'approved').length
  const rejected = vehicles.filter(v => v.status === 'rejected').length
  const exited = vehicles.filter(v => v.status === 'exited').length
  const entered = vehicles.filter(v => v.status === 'entered').length
  
  const cars = vehicles.filter(v => v.vehicleType === 'car').length
  const motorbikes = vehicles.filter(v => v.vehicleType === 'motorbike').length
  const trucks = vehicles.filter(v => v.vehicleType === 'truck').length
  const buses = vehicles.filter(v => v.vehicleType === 'bus').length
  
  return { total, approved, rejected, exited, entered, cars, motorbikes, trucks, buses }
}

/**
 * Calculate department statistics
 */
function calculateDepartmentStatistics(employees: any[], departments: any[]) {
  return departments.map(dept => ({
    name: dept.name,
    employeeCount: employees.filter(emp => emp.department === dept.name).length
  })).sort((a, b) => b.employeeCount - a.employeeCount)
}
