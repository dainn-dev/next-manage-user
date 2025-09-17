"use client"

import { useState } from "react"
import type { Department, Employee } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Search, Filter, Download, MoreHorizontal, Edit, Trash2, Plus, Building2, Users, Eye, ArrowLeft } from "lucide-react"
import { Badge } from "@/components/ui/badge"

interface DepartmentTableProps {
  departments: Department[]
  employees: Employee[]
  selectedDepartmentForView: Department | null
  showEmployeeList: boolean
  onEdit: (department: Department) => void
  onDelete: (departmentId: string) => void
  onAddNew: () => void
  onViewEmployees?: (department: Department) => void
  onBackToDepartments: () => void
}

export function DepartmentTable({ 
  departments, 
  employees, 
  selectedDepartmentForView, 
  showEmployeeList, 
  onEdit, 
  onDelete, 
  onAddNew, 
  onViewEmployees,
  onBackToDepartments 
}: DepartmentTableProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [numberFilter, setNumberFilter] = useState("")

  const filteredDepartments = departments.filter((department) => {
    const matchesSearch = department.name.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesNumber = !numberFilter || department.id.includes(numberFilter)
    return matchesSearch && matchesNumber
  })

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("vi-VN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
  }

  const getStatusBadge = (status: Employee["status"]) => {
    switch (status) {
      case "active":
        return <Badge variant="default" className="bg-green-100 text-green-800">Hoạt động</Badge>
      case "inactive":
        return <Badge variant="secondary">Không hoạt động</Badge>
      case "terminated":
        return <Badge variant="destructive">Đã nghỉ việc</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const departmentEmployees = selectedDepartmentForView 
    ? employees.filter(emp => emp.department === selectedDepartmentForView.name)
    : []

  return (
    <div className="space-y-4">
      {/* Department Tree View */}
      <div className="flex gap-4">
        {/* Left Panel - Department Tree */}
        <div className="w-1/3 border rounded-lg p-4">
          <div className="space-y-2">
            

            {filteredDepartments.map((department) => (
              <div 
                key={department.id} 
                className="group flex items-center justify-between p-3 hover:bg-blue-50 rounded-lg cursor-pointer border border-transparent hover:border-blue-200 transition-all duration-200"
                onClick={() => onViewEmployees && onViewEmployees(department)}
                title={`Xem danh sách ${department.employeeCount} quân nhân trong ${department.name}`}
              >
                <div className="flex items-center gap-3">
                  <Building2 className="h-4 w-4 text-blue-600" />
                  <div>
                    <div className="text-sm font-medium text-gray-900">{department.name}</div>
                    <div className="text-xs text-gray-500">{department.description || "Không có mô tả"}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 bg-blue-100 px-2 py-1 rounded-full">
                    <Users className="h-3 w-3 text-blue-600" />
                    <span className="text-xs font-medium text-blue-700">{department.employeeCount}</span>
                  </div>                  
                  <Eye className="h-4 w-4 text-gray-400" />
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 hover:bg-blue-100 hover:text-blue-600"
                      onClick={(e) => {
                        e.stopPropagation()
                        onEdit(department)
                      }}
                      title="Chỉnh sửa đơn vị"
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 hover:bg-red-100 hover:text-red-600"
                      onClick={(e) => {
                        e.stopPropagation()
                        if (confirm(`Bạn có chắc chắn muốn xóa đơn vị "${department.name}"?`)) {
                          onDelete(department.id)
                        }
                      }}
                      title="Xóa đơn vị"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Panel - Department Details or Employee List */}
        <div className="flex-1 border rounded-lg">
          {showEmployeeList && selectedDepartmentForView ? (
            // Employee List View
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div>
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <Users className="h-5 w-5 text-blue-600" />
                      Quân nhân - {selectedDepartmentForView.name}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {departmentEmployees.length} quân nhân trong bộ phận
                    </p>
                  </div>
                </div>
              </div>
              
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Tên</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Chức vụ</TableHead>
                    <TableHead>Cấp bậc</TableHead>
                    <TableHead>SQ/QNCN</TableHead>
                    <TableHead>Trạng thái</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {departmentEmployees.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8">
                        <div className="flex flex-col items-center gap-2">
                          <Users className="h-12 w-12 text-muted-foreground" />
                          <p className="text-muted-foreground">Không có quân nhân trong bộ phận này</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    departmentEmployees.map((employee) => (
                      <TableRow key={employee.id} className="hover:bg-muted/50">
                        <TableCell className="font-medium">{employee.employeeId}</TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{employee.name}</div>
                            <div className="text-xs text-muted-foreground">{employee.firstName} {employee.lastName}</div>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{employee.email}</TableCell>
                        <TableCell>{employee.position}</TableCell>
                        <TableCell>{employee.rank || "-"}</TableCell>
                        <TableCell>{employee.militaryCivilian || "-"}</TableCell>
                        <TableCell>{getStatusBadge(employee.status)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          ) : (
            // Department Details View
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Số bộ phận</TableHead>
                  <TableHead>Tên bộ phận</TableHead>
                  <TableHead>Số bộ phận phụ huynh</TableHead>
                  <TableHead>Tên bộ phận phụ huynh</TableHead>
                  <TableHead>Tạo ngày</TableHead>
                  <TableHead>Hoạt động</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDepartments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center">
                          <Building2 className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <p className="text-muted-foreground">Không có dữ liệu</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredDepartments.map((department) => (
                    <TableRow key={department.id}>
                      <TableCell className="font-medium">
                        <Button variant="link" className="p-0 h-auto font-medium text-primary">
                          {department.id}
                        </Button>
                      </TableCell>
                      <TableCell>
                        <Button variant="link" className="p-0 h-auto font-medium text-primary">
                          {department.name}
                        </Button>
                      </TableCell>
                      <TableCell>{department.parentId || "-"}</TableCell>
                      <TableCell>{department.parentId ? "Parent Department" : "-"}</TableCell>
                      <TableCell>{formatDate(department.createdAt)}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => onEdit(department)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Chỉnh sửa
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onDelete(department.id)} className="text-destructive">
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
          )}
        </div>
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
          <span className="text-sm">1-{Math.min(14, filteredDepartments.length)}</span>
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
          <span>/{Math.ceil(filteredDepartments.length / 50)} trang</span>
          <span>Tổng số hồ sơ {filteredDepartments.length}</span>
        </div>
      </div>
    </div>
  )
}