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
}

export function CustomFieldsTable({ customFields, onEdit, onDelete }: CustomFieldsTableProps) {
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
    <div className="space-y-4">
      {/* Search and Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-2 flex-1">
          <div className="relative">
            <Input
              placeholder="Tên hiển thị"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full sm:w-48"
            />
          </div>
          <div className="relative">
            <Input
              placeholder="Giá trị thuộc tính"
              value={valueFilter}
              onChange={(e) => setValueFilter(e.target.value)}
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
            <Filter className="h-4 w-4 mr-2" />
            Làm mới
          </Button>
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            Làm mới
          </Button>
          <Button variant="outline" size="sm">
            Thêm mới
          </Button>
          <Button variant="destructive" size="sm">
            Xóa
          </Button>
        </div>
      </div>

      {/* Data Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tên hiển thị</TableHead>
              <TableHead>Giá trị thuộc tính</TableHead>
              <TableHead>Kiểu dữ liệu vào</TableHead>
              <TableHead>Hàng</TableHead>
              <TableHead>Cột</TableHead>
              <TableHead>Hiển thị trong Danh sách</TableHead>
              <TableHead>Hoạt động</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredFields.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
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
                <TableRow key={field.id}>
                  <TableCell className="font-medium">{field.name}</TableCell>
                  <TableCell>{getTypeBadge(field.type)}</TableCell>
                  <TableCell>{field.category}</TableCell>
                  <TableCell>{field.order}</TableCell>
                  <TableCell>1</TableCell>
                  <TableCell>{getRequiredBadge(field.required)}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
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
          <Button variant="outline" size="sm" disabled>
            {"<<"}
          </Button>
          <Button variant="outline" size="sm" disabled>
            {"<"}
          </Button>
          <span className="text-sm">1-{Math.min(10, filteredFields.length)}</span>
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
          <span>/{Math.ceil(filteredFields.length / 50)} trang</span>
          <span>Tổng số hồ sơ {filteredFields.length}</span>
        </div>
      </div>
    </div>
  )
}
