"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Search, Filter, Download, Plus, RefreshCw } from "lucide-react"
import { FileText } from "lucide-react"

export default function PositionsPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [positionName, setPositionName] = useState("")

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Vị trí</h1>
      </div>

      {/* Search and Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-2 flex-1">
          <div className="relative">
            <Input
              placeholder="Số chức vụ"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full sm:w-48"
            />
          </div>
          <div className="relative">
            <Input
              placeholder="Tên chức vụ"
              value={positionName}
              onChange={(e) => setPositionName(e.target.value)}
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
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Làm mới
        </Button>
        <Button variant="outline" size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Thêm mới
        </Button>
        <Button variant="destructive" size="sm">
          Xóa
        </Button>
        <Button variant="outline" size="sm">
          <Download className="h-4 w-4 mr-2" />
          Xuất
        </Button>
        <Button variant="outline" size="sm">
          Nhập
        </Button>
        <span className="text-sm text-muted-foreground">Hơn nữa</span>
      </div>

      {/* Data Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Số chức vụ</TableHead>
              <TableHead>Tên chức vụ</TableHead>
              <TableHead>Số chức vụ cấp cao</TableHead>
              <TableHead>Chức vụ cấp cao</TableHead>
              <TableHead>Hoạt động</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
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
          <span className="text-sm">0</span>
          <Button variant="outline" size="sm" disabled>
            {">"}
          </Button>
          <Button variant="outline" size="sm" disabled>
            {">>"}
          </Button>
        </div>

        <div className="flex items-center gap-2 text-sm">
          <span>50 hàng trên mỗi trang</span>
          <span>Nhảy tới</span>
          <Input className="w-16 h-8" defaultValue="1" />
          <span>/0 trang</span>
          <span>Tổng số hồ sơ 0</span>
        </div>
      </div>
    </div>
  )
}
