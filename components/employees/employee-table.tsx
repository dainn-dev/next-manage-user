"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import type { Employee, Vehicle } from "@/lib/types"
import { vehicleApi } from "@/lib/api/vehicle-api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Search, Filter, Download, Edit, Trash2, UserPlus, MoreHorizontal, Eye, Users, Car, Bike, Truck, Bus } from "lucide-react"
import { AdvancedExportDialog } from "@/components/reports/advanced-export-dialog"
import { ImportDialog } from "@/components/reports/import-dialog"
import { BulkOperationsDialog } from "@/components/employees/bulk-operations-dialog"
import { useToast } from "@/hooks/use-toast"

interface EmployeeTableProps {
  employees: Employee[]
  onEdit: (employee: Employee) => void
  onDelete: (employeeId: string) => void
  onAdd: () => void
  selectedEmployees?: string[]
  onSelectionChange?: (selectedIds: string[]) => void
}

export function EmployeeTable({ 
  employees, 
  onEdit, 
  onDelete, 
  onAdd, 
  selectedEmployees = [], 
  onSelectionChange 
}: EmployeeTableProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [searchTerm, setSearchTerm] = useState("")
  const [localSelectedEmployees, setLocalSelectedEmployees] = useState<string[]>([])
  const [departmentFilter, setDepartmentFilter] = useState("")
  const [nameFilter, setNameFilter] = useState("")
  const [showAdvancedExport, setShowAdvancedExport] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [showBulkOperations, setShowBulkOperations] = useState(false)
  const [employeeVehicles, setEmployeeVehicles] = useState<Record<string, Vehicle[]>>({})
  const [loadingVehicles, setLoadingVehicles] = useState<Record<string, boolean>>({})

  const filteredEmployees = employees.filter((employee) => {
    const matchesSearch =
      employee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employee.employeeId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employee.department.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesDepartment = !departmentFilter || employee.department.includes(departmentFilter)
    const matchesName = !nameFilter || employee.name.toLowerCase().includes(nameFilter.toLowerCase())

    return matchesSearch && matchesDepartment && matchesName
  })

  const currentSelectedEmployees = onSelectionChange ? selectedEmployees : localSelectedEmployees

  const handleSelectAll = (checked: boolean) => {
    const newSelection = checked ? filteredEmployees.map((emp) => emp.id) : []
    if (onSelectionChange) {
      onSelectionChange(newSelection)
    } else {
      setLocalSelectedEmployees(newSelection)
    }
  }

  const handleSelectEmployee = (employeeId: string, checked: boolean) => {
    const newSelection = checked 
      ? [...currentSelectedEmployees, employeeId]
      : currentSelectedEmployees.filter((id) => id !== employeeId)
    
    if (onSelectionChange) {
      onSelectionChange(newSelection)
    } else {
      setLocalSelectedEmployees(newSelection)
    }
  }

  const getStatusBadge = (status: Employee["status"]) => {
    switch (status) {
      case "HOAT_DONG":
        return (
          <Badge variant="default" className="bg-green-100 text-green-800">
            Hoạt động
          </Badge>
        )
      case "TRANH_THU":
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
          Tranh thủ
        </Badge>
      case "PHEP":
        return <Badge variant="outline" className="bg-blue-100 text-blue-800">
          Phép
        </Badge>
      case "LY_DO_KHAC":
        return <Badge variant="destructive">Lý do Khác</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const getVehicleTypeDisplay = (vehicleType?: Employee["vehicleType"]) => {
    if (!vehicleType) return "N/A"
    
    switch (vehicleType) {
      case "car":
        return "Ô tô"
      case "motorbike":
        return "Xe máy"
      case "truck":
        return "Xe tải"
      case "bus":
        return "Xe buýt"
      default:
        return vehicleType
    }
  }

  const getVehicleIcon = (vehicleType?: Employee["vehicleType"]) => {
    switch (vehicleType) {
      case "car":
        return <Car className="h-4 w-4" />
      case "motorbike":
        return <Bike className="h-4 w-4" />
      case "truck":
        return <Truck className="h-4 w-4" />
      case "bus":
        return <Bus className="h-4 w-4" />
      default:
        return <Car className="h-4 w-4" />
    }
  }

  const getVehiclesForEmployee = async (employeeId: string): Promise<Vehicle[]> => {
    if (employeeVehicles[employeeId]) {
      return employeeVehicles[employeeId]
    }

    if (loadingVehicles[employeeId]) {
      return []
    }

    setLoadingVehicles(prev => ({ ...prev, [employeeId]: true }))
    
    try {
      const vehicles = await vehicleApi.getVehiclesByEmployee(employeeId)
      setEmployeeVehicles(prev => ({ ...prev, [employeeId]: vehicles }))
      return vehicles
    } catch (error) {
      console.error('Error fetching vehicles for employee:', error)
      setEmployeeVehicles(prev => ({ ...prev, [employeeId]: [] }))
      return []
    } finally {
      setLoadingVehicles(prev => ({ ...prev, [employeeId]: false }))
    }
  }

  const handleVehicleClick = async (employee: Employee) => {
    const employeeId = employee.id
    
    // Get vehicles for this employee (will fetch if not already loaded)
    const vehicles = await getVehiclesForEmployee(employeeId)
    
    if (vehicles.length > 0) {
      // Navigate to vehicle page with the first vehicle's ID
      const vehicleId = vehicles[0].id
      router.push(`/vehicles?id=${vehicleId}`)
    } else {
      // If no vehicles, show a toast message
      toast({
        variant: "destructive",
        title: "Không có xe",
        description: `${employee.name} chưa có xe nào được đăng ký.`,
      })
    }
  }

  return (
    <div className="space-y-4">

      {/* Data Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={currentSelectedEmployees.length === filteredEmployees.length && filteredEmployees.length > 0}
                  onCheckedChange={handleSelectAll}
                />
              </TableHead>
              <TableHead>ID Quân nhân</TableHead>
              <TableHead>Họ và Tên</TableHead>
              <TableHead>Cơ quan. đơn vị</TableHead>
              <TableHead>Cấp bậc</TableHead>
              <TableHead>Chức vụ</TableHead>
              <TableHead>SQ/QNCN</TableHead>
              <TableHead>Phương tiện</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead className="w-32">Hoạt động</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredEmployees.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-8">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center">
                      <Users className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <p className="text-muted-foreground">Không có dữ liệu</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredEmployees.map((employee) => (
                <TableRow key={employee.id}>
                  <TableCell>
                    <Checkbox
                      checked={currentSelectedEmployees.includes(employee.id)}
                      onCheckedChange={(checked) => handleSelectEmployee(employee.id, checked as boolean)}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{employee.employeeId}</TableCell>
                  <TableCell>{employee.name}</TableCell>
                  <TableCell>{employee.department}</TableCell>
                  <TableCell>{employee.rank || "-"}</TableCell>
                  <TableCell>{employee.position || "-"}</TableCell>
                  <TableCell>{employee.militaryCivilian || "-"}</TableCell>
                  <TableCell>
                    {employee.vehicleType ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 hover:bg-blue-50 hover:text-blue-600 transition-colors duration-150"
                        onClick={() => handleVehicleClick(employee)}
                        disabled={loadingVehicles[employee.id]}
                        title={`Xem thông tin ${getVehicleTypeDisplay(employee.vehicleType)} của ${employee.name}`}
                      >
                        {loadingVehicles[employee.id] ? (
                          <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                          getVehicleIcon(employee.vehicleType)
                        )}
                      </Button>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>{getStatusBadge(employee.status)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div 
                        className="relative group"
                        onMouseEnter={() => {
                          const menu = document.getElementById(`menu-${employee.id}`)
                          if (menu) {
                            menu.classList.remove('hidden')
                            
                            // Smart positioning: check if we're near the end of the table
                            const tableBody = menu.closest('tbody')
                            const allRows = tableBody?.querySelectorAll('tr')
                            const currentRow = menu.closest('tr')
                            const currentIndex = currentRow ? Array.from(allRows || []).indexOf(currentRow) : -1
                            const totalRows = allRows?.length || 0
                            
                            // Show menu above if we're in the last 3 rows of the table
                            const isNearEnd = currentIndex >= totalRows - 3
                            
                            if (isNearEnd) {
                              menu.style.top = 'auto'
                              menu.style.bottom = '100%'
                              menu.style.marginBottom = '4px'
                            } else {
                              menu.style.top = '100%'
                              menu.style.bottom = 'auto'
                              menu.style.marginBottom = '0'
                            }
                          }
                        }}
                        onMouseLeave={() => {
                          // Add small delay before hiding
                          setTimeout(() => {
                            const menu = document.getElementById(`menu-${employee.id}`)
                            if (menu && !menu.matches(':hover')) {
                              menu.classList.add('hidden')
                            }
                          }, 200)
                        }}
                      >
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="h-8 w-8 p-0 group-hover:bg-accent transition-colors duration-150"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                        <div 
                          id={`menu-${employee.id}`}
                          className="absolute right-0 top-8 hidden z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md transition-all duration-150"
                          style={{
                            // Initial positioning - will be adjusted dynamically
                            top: '100%',
                            bottom: 'auto'
                          }}
                          onMouseEnter={() => {
                            // Keep menu open when hovering over it
                            const menu = document.getElementById(`menu-${employee.id}`)
                            if (menu) {
                              menu.classList.remove('hidden')
                            }
                          }}
                          onMouseLeave={() => {
                            // Hide menu when leaving
                            const menu = document.getElementById(`menu-${employee.id}`)
                            if (menu) {
                              menu.classList.add('hidden')
                            }
                          }}
                        >
                          <div 
                            className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                            onClick={() => {
                              onEdit(employee)
                              document.getElementById(`menu-${employee.id}`)?.classList.add('hidden')
                            }}
                          >
                            <Edit className="h-4 w-4 mr-2" />
                            Chỉnh sửa
                          </div>
                          <div 
                            className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground text-red-600"
                            onClick={() => {
                              onDelete(employee.id)
                              document.getElementById(`menu-${employee.id}`)?.classList.add('hidden')
                            }}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Xóa
                          </div>
                        </div>
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled>
            {"<<"}
          </Button>
          <Button variant="outline" size="sm" disabled>
            {"<"}
          </Button>
          <span className="text-sm">1-{Math.min(50, filteredEmployees.length)}</span>
          <Button variant="outline" size="sm">
            {">"}
          </Button>
          <Button variant="outline" size="sm">
            {">>"}
          </Button>
        </div>

        <div className="flex items-center gap-2 text-sm">
          <span>50 hàng trên mỗi trang</span>
          <span>Nhảy tới</span>
          <Input className="w-16 h-8" defaultValue="1" />
          <span>/{Math.ceil(filteredEmployees.length / 50)} trang</span>
          <span>Tổng số hồ sơ {filteredEmployees.length}</span>
        </div>
      </div>

      {showAdvancedExport && (
        <AdvancedExportDialog
          isOpen={showAdvancedExport}
          onClose={() => setShowAdvancedExport(false)}
          onExport={(options) => {
            // Export options selected
          }}
        />
      )}

      {showImport && (
        <ImportDialog
          isOpen={showImport}
          onClose={() => setShowImport(false)}
          onImport={(options) => {
            // Import options selected
          }}
        />
      )}

      {/* Bulk Operations Dialog */}
      {showBulkOperations && (
        <BulkOperationsDialog
          isOpen={showBulkOperations}
          onClose={() => setShowBulkOperations(false)}
          selectedEmployeeIds={currentSelectedEmployees}
          onSuccess={() => {
            if (onSelectionChange) {
              onSelectionChange([])
            } else {
              setLocalSelectedEmployees([])
            }
            // Refresh the employee list
            window.location.reload()
          }}
        />
      )}
    </div>
  )
}
