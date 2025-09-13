"use client"

import { useState } from "react"
import type { Employee } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Users } from "lucide-react" // Import Users component
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Search, Filter, Download, MoreHorizontal, Edit, Trash2, Eye, UserPlus } from "lucide-react"
import { AdvancedExportDialog } from "@/components/reports/advanced-export-dialog"
import { ImportDialog } from "@/components/reports/import-dialog"
import { BulkOperationsDialog } from "@/components/employees/bulk-operations-dialog"

interface EmployeeTableProps {
  employees: Employee[]
  onEdit: (employee: Employee) => void
  onDelete: (employeeId: string) => void
  onView: (employee: Employee) => void
}

export function EmployeeTable({ employees, onEdit, onDelete, onView }: EmployeeTableProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([])
  const [departmentFilter, setDepartmentFilter] = useState("")
  const [nameFilter, setNameFilter] = useState("")
  const [showAdvancedExport, setShowAdvancedExport] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [showBulkOperations, setShowBulkOperations] = useState(false)

  const filteredEmployees = employees.filter((employee) => {
    const matchesSearch =
      employee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employee.employeeId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employee.department.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesDepartment = !departmentFilter || employee.department.includes(departmentFilter)
    const matchesName = !nameFilter || employee.name.toLowerCase().includes(nameFilter.toLowerCase())

    return matchesSearch && matchesDepartment && matchesName
  })

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedEmployees(filteredEmployees.map((emp) => emp.id))
    } else {
      setSelectedEmployees([])
    }
  }

  const handleSelectEmployee = (employeeId: string, checked: boolean) => {
    if (checked) {
      setSelectedEmployees((prev) => [...prev, employeeId])
    } else {
      setSelectedEmployees((prev) => prev.filter((id) => id !== employeeId))
    }
  }

  const getStatusBadge = (status: Employee["status"]) => {
    switch (status) {
      case "active":
        return (
          <Badge variant="default" className="bg-green-100 text-green-800">
            Hoạt động
          </Badge>
        )
      case "inactive":
        return <Badge variant="secondary">Không hoạt động</Badge>
      case "terminated":
        return <Badge variant="destructive">Đã nghỉ việc</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  return (
    <div className="space-y-4">
      {/* Search and Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-2 flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Tên phòng ban"
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="pl-10 w-full sm:w-48"
            />
          </div>
          <div className="relative">
            <Input
              placeholder="ID nhân sự"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full sm:w-48"
            />
          </div>
          <div className="relative">
            <Input
              placeholder="Tên"
              value={nameFilter}
              onChange={(e) => setNameFilter(e.target.value)}
              className="w-full sm:w-48"
            />
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Filter className="h-4 w-4 mr-2" />
            Hơn nữa
          </Button>
          <Button variant="outline" size="sm">
            <Search className="h-4 w-4 mr-2" />
            Tìm kiếm
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowAdvancedExport(true)}>
            <Download className="h-4 w-4 mr-2" />
            Xuất
          </Button>
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="border-border hover:bg-muted text-card-foreground bg-transparent"
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Làm mới
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="border-border hover:bg-muted text-card-foreground bg-transparent"
          >
            Thêm mới
          </Button>
          <Button
            size="sm"
            className="bg-accent text-accent-foreground hover:bg-accent/90"
            onClick={() => setShowBulkOperations(true)}
            disabled={selectedEmployees.length === 0}
          >
            Điều chỉnh nhân sự ({selectedEmployees.length})
          </Button>
          <Button
            variant="destructive"
            size="sm"
            disabled={selectedEmployees.length === 0}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Xóa
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAdvancedExport(true)}
            className="border-border hover:bg-muted text-card-foreground"
          >
            Xuất
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowImport(true)}
            className="border-border hover:bg-muted text-card-foreground"
          >
            Nhập
          </Button>
          <span className="text-sm text-muted-foreground">Hơn nữa</span>
        </div>
      </div>

      {/* Data Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={selectedEmployees.length === filteredEmployees.length && filteredEmployees.length > 0}
                  onCheckedChange={handleSelectAll}
                />
              </TableHead>
              <TableHead>ID nhân sự</TableHead>
              <TableHead>Tên</TableHead>
              <TableHead>Họ</TableHead>
              <TableHead>Tên phòng ban</TableHead>
              <TableHead>Số thẻ</TableHead>
              <TableHead>Chế độ xác minh</TableHead>
              <TableHead>Hoạt động</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredEmployees.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
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
                      checked={selectedEmployees.includes(employee.id)}
                      onCheckedChange={(checked) => handleSelectEmployee(employee.id, checked as boolean)}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{employee.employeeId}</TableCell>
                  <TableCell>{employee.name}</TableCell>
                  <TableCell>{employee.firstName || "-"}</TableCell>
                  <TableCell>{employee.department}</TableCell>
                  <TableCell>{employee.cardNumber || "-"}</TableCell>
                  <TableCell>{getStatusBadge(employee.status)}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onView(employee)}>
                          <Eye className="h-4 w-4 mr-2" />
                          Xem
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onEdit(employee)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Chỉnh sửa
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onDelete(employee.id)} className="text-destructive">
                          <Trash2 className="h-4 w-4 mr-2" />
                          Xóa
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
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
            console.log("Export options:", options)
          }}
        />
      )}

      {showImport && (
        <ImportDialog
          isOpen={showImport}
          onClose={() => setShowImport(false)}
          onImport={(options) => {
            console.log("Import options:", options)
          }}
        />
      )}

      {/* Bulk Operations Dialog */}
      {showBulkOperations && (
        <BulkOperationsDialog
          isOpen={showBulkOperations}
          onClose={() => setShowBulkOperations(false)}
          selectedCount={selectedEmployees.length}
          onApply={(operation) => {
            console.log("Bulk operation:", operation, "for employees:", selectedEmployees)
          }}
        />
      )}
    </div>
  )
}
