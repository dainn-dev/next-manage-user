"use client"

import { useState } from "react"
import type { DocumentLibrary } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Search, Filter, MoreHorizontal, Edit, Trash2, Download, FileText } from "lucide-react"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"

interface DocumentTableProps {
  documents: DocumentLibrary[]
  onEdit: (document: DocumentLibrary) => void
  onDelete: (documentId: string) => void
  onDownload: (document: DocumentLibrary) => void
}

export function DocumentTable({ documents, onEdit, onDelete, onDownload }: DocumentTableProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")

  const filteredDocuments = documents.filter((document) => {
    const matchesSearch = document.name.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = categoryFilter === "all" || document.type.includes(categoryFilter)
    return matchesSearch && matchesCategory
  })

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return "0 B"
    const sizes = ["B", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + " " + sizes[i]
  }

  const getPermissionBadge = (permissions: string[]) => {
    if (permissions.includes("write")) {
      return (
        <Badge variant="default" className="bg-green-100 text-green-800">
          Ghi
        </Badge>
      )
    }
    return <Badge variant="secondary">Chỉ đọc</Badge>
  }

  return (
    <div className="space-y-4">
      {/* Search and Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-2 flex-1">
          <div className="relative">
            <Input
              placeholder="Tên danh sách cá nhân"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full sm:w-64"
            />
          </div>
          <div className="relative">
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Loại danh sách cá nhân" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                <SelectItem value="document">Tài liệu</SelectItem>
                <SelectItem value="folder">Thư mục</SelectItem>
              </SelectContent>
            </Select>
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

      {/* Split View */}
      <div className="flex gap-4">
        {/* Left Panel - Document List */}
        <div className="w-1/2 border rounded-lg">
          <div className="p-4 border-b">
            <h3 className="font-medium">Danh sách thư viện</h3>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tên danh sách cá nhân</TableHead>
                <TableHead>Loại danh sách cá nhân</TableHead>
                <TableHead>Mô tả</TableHead>
                <TableHead>pers_person_id</TableHead>
                <TableHead>Hoạt động</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDocuments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center">
                        <FileText className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <p className="text-muted-foreground">Không có dữ liệu</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredDocuments.map((document) => (
                  <TableRow key={document.id}>
                    <TableCell className="font-medium">{document.name}</TableCell>
                    <TableCell>{document.type === "document" ? "Cho phép Thu" : "Thu viện danh"}</TableCell>
                    <TableCell>{formatFileSize(document.size)}</TableCell>
                    <TableCell>{getPermissionBadge(document.permissions)}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => onDownload(document)}>
                            <Download className="h-4 w-4 mr-2" />
                            Tải xuống
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onEdit(document)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Chỉnh sửa
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onDelete(document.id)} className="text-destructive">
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

        {/* Right Panel - Employee List */}
        <div className="w-1/2 border rounded-lg">
          <div className="p-4 border-b">
            <h3 className="font-medium">Nhân sự</h3>
          </div>
          <div className="p-4">
            <div className="flex gap-2 mb-4">
              <Input placeholder="ID nhân sự" className="w-32" />
              <Input placeholder="Tên" className="flex-1" />
              <Button variant="outline" size="sm">
                <Search className="h-4 w-4 mr-2" />
                Tìm kiếm
              </Button>
              <Button variant="outline" size="sm">
                <Filter className="h-4 w-4 mr-2" />
                Làm mới
              </Button>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID nhân sự</TableHead>
                  <TableHead>Tên</TableHead>
                  <TableHead>Họ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell>248</TableCell>
                  <TableCell>Nguyễn Duy Linh</TableCell>
                  <TableCell>Nguyễn</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>247</TableCell>
                  <TableCell>Đoàn Đình Độ</TableCell>
                  <TableCell>Đoàn</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>246</TableCell>
                  <TableCell>Võ Hữu Trường</TableCell>
                  <TableCell>Võ</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>245</TableCell>
                  <TableCell>Phạm Thị Thảo</TableCell>
                  <TableCell>Phạm</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>244</TableCell>
                  <TableCell>Chu Thị Hợp</TableCell>
                  <TableCell>Chu</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>243</TableCell>
                  <TableCell>Phạm Thị Đàn</TableCell>
                  <TableCell>Phạm</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>242</TableCell>
                  <TableCell>Nguyễn Thị Ngọ</TableCell>
                  <TableCell>Nguyễn</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>241</TableCell>
                  <TableCell>Nguyễn Thiên Đ</TableCell>
                  <TableCell>Nguyễn</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
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
          <span className="text-sm">1-2</span>
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
          <span>/1 trang</span>
          <span>Tổng số hồ sơ 2</span>
        </div>
      </div>
    </div>
  )
}
