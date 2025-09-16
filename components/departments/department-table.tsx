"use client"

import { useState } from "react"
import type { Department } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Search, Filter, Download, MoreHorizontal, Edit, Trash2, Plus, Building2 } from "lucide-react"

interface DepartmentTableProps {
  departments: Department[]
  onEdit: (department: Department) => void
  onDelete: (departmentId: string) => void
  onAddNew: () => void
}

export function DepartmentTable({ departments, onEdit, onDelete, onAddNew }: DepartmentTableProps) {
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

  return (
    <div className="space-y-4">
      {/* Search and Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-2 flex-1">
          <div className="relative">
            <Input
              placeholder="Tên bộ phận"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full sm:w-48"
            />
          </div>
          <div className="relative">
            <Input
              placeholder="Số bộ phận"
              value={numberFilter}
              onChange={(e) => setNumberFilter(e.target.value)}
              className="w-full sm:w-48"
            />
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Search className="h-4 w-4 mr-2" />
            Tìm kiếm
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Xuất
          </Button>
          <Button variant="outline" size="sm">
            <Filter className="h-4 w-4 mr-2" />
            Làm mới
          </Button>
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onAddNew}>
            <Plus className="h-4 w-4 mr-2" />
            Làm mới
          </Button>
          <Button variant="outline" size="sm" onClick={onAddNew}>
            Thêm mới
          </Button>
          <Button variant="destructive" size="sm">
            Xóa
          </Button>
          <Button variant="outline" size="sm">
            Xuất
          </Button>
        </div>
      </div>

      {/* Department Tree View */}
      <div className="flex gap-4">
        {/* Left Panel - Department Tree */}
        <div className="w-1/3 border rounded-lg p-4">
          <div className="space-y-2">
            {filteredDepartments.map((department) => (
              <div key={department.id} className="flex items-center gap-2 p-2 hover:bg-muted rounded cursor-pointer">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{department.name}</span>
                <span className="text-xs text-muted-foreground">({department.employeeCount})</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right Panel - Department Details Table */}
        <div className="flex-1 border rounded-lg">
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
