"use client"

import { useState } from "react"
import type { CustomField } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Search, Filter, MoreHorizontal, Edit, Trash2, Settings } from "lucide-react"

interface CustomFieldsTableProps {
  customFields: CustomField[]
  onEdit: (field: CustomField) => void
  onDelete: (fieldId: string) => void
  onRefresh?: () => void
}

export function CustomFieldsTable({ customFields, onEdit, onDelete, onRefresh }: CustomFieldsTableProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [valueFilter, setValueFilter] = useState("")

  const filteredFields = customFields.filter((field) => {
    const matchesSearch = field.name.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesValue = !valueFilter || field.category.toLowerCase().includes(valueFilter.toLowerCase())
    return matchesSearch && matchesValue
  })

  const getTypeBadge = (type: CustomField["type"]) => {
    const typeMap = {
      text: "Văn bản",
      number: "Số",
      date: "Ngày",
      select: "Danh sách kéo",
      checkbox: "Hộp kiểm",
      textarea: "Văn bản dài",
    }
    return <Badge variant="outline">{typeMap[type] || type}</Badge>
  }

  const getRequiredBadge = (required: boolean) => {
    return required ? <Badge variant="destructive">Bắt buộc</Badge> : <Badge variant="secondary">Không</Badge>
  }

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Trường tùy chỉnh</h2>
          <p className="text-sm text-muted-foreground">Tổng cộng: {customFields.length} trường</p>
        </div>
        <button className="bg-primary text-primary-foreground px-6 py-3 rounded-xl hover:bg-primary/90 transition-all duration-200 flex items-center gap-3 font-medium shadow-md hover:shadow-lg">
          <span className="text-lg">➕</span>
          Thêm trường mới
        </button>
      </div>

      {/* Search and Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-2 flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Tìm kiếm theo tên trường..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-full sm:w-64"
            />
          </div>
          <div className="relative">
            <Input
              placeholder="Lọc theo danh mục..."
              value={valueFilter}
              onChange={(e) => setValueFilter(e.target.value)}
              className="w-full sm:w-48"
            />
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Filter className="h-4 w-4 mr-2" />
            Bộ lọc
          </Button>
          <Button variant="outline" size="sm">
            <Search className="h-4 w-4 mr-2" />
            Tìm kiếm
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
            onClick={onRefresh}
          >
            <span className="mr-2">🔄</span>
            Làm mới
          </Button>
          <Button variant="outline" size="sm" className="border-border hover:bg-muted text-card-foreground bg-transparent">
            <span className="mr-2">📤</span>
            Xuất
          </Button>
          <Button variant="outline" size="sm" className="border-border hover:bg-muted text-card-foreground bg-transparent">
            <span className="mr-2">📥</span>
            Nhập
          </Button>
        </div>
      </div>

      {/* Data Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tên trường</TableHead>
              <TableHead>Loại dữ liệu</TableHead>
              <TableHead>Danh mục</TableHead>
              <TableHead>Thứ tự</TableHead>
              <TableHead>Bắt buộc</TableHead>
              <TableHead>Hoạt động</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredFields.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center">
                      <Settings className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <p className="text-muted-foreground">Không có dữ liệu</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredFields.map((field) => (
                <TableRow key={field.id} className="hover:bg-muted/50 transition-colors">
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                        <span className="text-blue-600 text-sm">📝</span>
                      </div>
                      {field.name}
                    </div>
                  </TableCell>
                  <TableCell>{getTypeBadge(field.type)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="bg-gray-100 text-gray-700">
                      {field.category}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm font-medium text-muted-foreground">#{field.order}</span>
                  </TableCell>
                  <TableCell>{getRequiredBadge(field.required)}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="hover:bg-muted">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onEdit(field)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Chỉnh sửa
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onDelete(field.id)} className="text-destructive">
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
          <Button variant="outline" size="sm" disabled className="hover:bg-muted">
            {"<<"}
          </Button>
          <Button variant="outline" size="sm" disabled className="hover:bg-muted">
            {"<"}
          </Button>
          <span className="text-sm font-medium text-muted-foreground">1-{Math.min(10, filteredFields.length)}</span>
          <Button variant="outline" size="sm" className="hover:bg-muted">
            {">"}
          </Button>
          <Button variant="outline" size="sm" className="hover:bg-muted">
            {">>"}
          </Button>
        </div>

        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span>Hiển thị 50 trường/trang</span>
          <span>•</span>
          <span>Trang 1/{Math.ceil(filteredFields.length / 50)}</span>
          <span>•</span>
          <span>Tổng: {filteredFields.length} trường</span>
        </div>
      </div>
    </div>
  )
}
