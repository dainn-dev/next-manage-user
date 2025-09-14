"use client"

import { useState } from "react"
import type { Vehicle } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Search, Filter, Download, Car as CarIcon } from "lucide-react"
import { AdvancedExportDialog } from "@/components/reports/advanced-export-dialog"
import { ImportDialog } from "@/components/reports/import-dialog"

interface VehicleTableProps {
  vehicles: Vehicle[]
  onEdit: (vehicle: Vehicle) => void
  onDelete: (vehicleId: string) => void
  onView: (vehicle: Vehicle) => void
  onAddNew: () => void
  onBulkUpdate?: (vehicleIds: string[]) => void
  onRefresh?: () => void
  // Pagination props
  currentPage: number
  totalPages: number
  totalElements: number
  pageSize: number
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
}

export function VehicleTable({ 
  vehicles, 
  onEdit, 
  onDelete, 
  onView, 
  onAddNew, 
  onBulkUpdate, 
  onRefresh,
  currentPage,
  totalPages,
  totalElements,
  pageSize,
  onPageChange,
  onPageSizeChange
}: VehicleTableProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedVehicles, setSelectedVehicles] = useState<string[]>([])
  const [typeFilter, setTypeFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [showAdvancedExport, setShowAdvancedExport] = useState(false)
  const [showImport, setShowImport] = useState(false)

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedVehicles(filteredVehicles.map((vehicle) => vehicle.id))
    } else {
      setSelectedVehicles([])
    }
  }

  const handleSelectVehicle = (vehicleId: string, checked: boolean) => {
    if (checked) {
      setSelectedVehicles((prev) => [...prev, vehicleId])
    } else {
      setSelectedVehicles((prev) => prev.filter((id) => id !== vehicleId))
    }
  }

  // Client-side filtering for current page
  const filteredVehicles = vehicles.filter((vehicle) => {
    const matchesSearch = !searchTerm || 
      vehicle.licensePlate.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vehicle.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vehicle.brand?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vehicle.model?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesType = !typeFilter || vehicle.vehicleType === typeFilter
    const matchesStatus = !statusFilter || vehicle.status === statusFilter

    return matchesSearch && matchesType && matchesStatus
  })

  const getStatusBadge = (status: Vehicle["status"]) => {
    switch (status) {
      case "active":
        return (
          <Badge variant="default" className="bg-green-100 text-green-800">
            Hoạt động
          </Badge>
        )
      case "inactive":
        return <Badge variant="secondary">Không hoạt động</Badge>
      case "maintenance":
        return <Badge variant="outline" className="bg-yellow-100 text-yellow-800">Bảo trì</Badge>
      case "retired":
        return <Badge variant="destructive">Đã nghỉ hưu</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const getVehicleTypeLabel = (type: Vehicle["vehicleType"]) => {
    const labels = {
      car: "Ô tô",
      motorbike: "Xe máy",
      truck: "Xe tải",
      bus: "Xe bus"
    }
    return labels[type] || type
  }

  const getVehicleIcon = (type: Vehicle["vehicleType"]) => {
    switch (type) {
      case "car":
        return "🚗"
      case "motorbike":
        return "🏍️"
      case "truck":
        return "🚛"
      case "bus":
        return "🚌"
      default:
        return "🚗"
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
              placeholder="Biển số xe"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-full sm:w-48"
            />
          </div>
          <div className="relative">
            <Input
              placeholder="Chủ xe"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full sm:w-48"
            />
          </div>
          <div className="relative">
            <Select value={statusFilter || "all"} onValueChange={(value) => setStatusFilter(value === "all" ? "" : value)}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Trạng thái" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                <SelectItem value="active">Hoạt động</SelectItem>
                <SelectItem value="inactive">Không hoạt động</SelectItem>
                <SelectItem value="maintenance">Bảo trì</SelectItem>
                <SelectItem value="retired">Nghỉ hưu</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex gap-2">
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
            onClick={onRefresh}
          >
            <CarIcon className="h-4 w-4 mr-2" />
            Làm mới
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="border-border hover:bg-muted text-card-foreground bg-transparent"
            onClick={onAddNew}
          >
            Thêm mới
          </Button>
          <Button
            size="sm"
            className="bg-blue-600 text-white hover:bg-blue-700"
            disabled={selectedVehicles.length !== 1}
            onClick={() => onBulkUpdate?.(selectedVehicles)}
          >
            Cập nhật
          </Button>
          <Button
            variant="destructive"
            size="sm"
            disabled={selectedVehicles.length === 0}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={() => {
              if (selectedVehicles.length > 0) {
                if (confirm(`Bạn có chắc chắn muốn xóa ${selectedVehicles.length} xe đã chọn?`)) {
                  selectedVehicles.forEach(vehicleId => onDelete(vehicleId))
                  setSelectedVehicles([])
                }
              }
            }}
          >
            Xóa
          </Button>
        </div>
      </div>

      {/* Data Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={selectedVehicles.length === filteredVehicles.length && filteredVehicles.length > 0}
                  onCheckedChange={handleSelectAll}
                />
              </TableHead>
              <TableHead>Biển số</TableHead>
              <TableHead>Chủ xe</TableHead>
              <TableHead>Loại xe</TableHead>
              <TableHead>Hãng/Model</TableHead>
              <TableHead>Năm sản xuất</TableHead>
              <TableHead>Trạng thái</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredVehicles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center">
                      <CarIcon className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <p className="text-muted-foreground">
                      {vehicles.length === 0 ? "Không có dữ liệu" : "Không tìm thấy kết quả phù hợp"}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredVehicles.map((vehicle) => (
                <TableRow key={vehicle.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedVehicles.includes(vehicle.id)}
                      onCheckedChange={(checked) => handleSelectVehicle(vehicle.id, checked as boolean)}
                    />
                  </TableCell>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{getVehicleIcon(vehicle.vehicleType)}</span>
                      {vehicle.licensePlate}
                    </div>
                  </TableCell>
                  <TableCell>{vehicle.employeeName}</TableCell>
                  <TableCell>{getVehicleTypeLabel(vehicle.vehicleType)}</TableCell>
                  <TableCell>
                    {vehicle.brand && vehicle.model ? `${vehicle.brand} ${vehicle.model}` : "-"}
                  </TableCell>
                  <TableCell>{vehicle.year || "-"}</TableCell>
                  <TableCell>{getStatusBadge(vehicle.status)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            disabled={currentPage === 0}
            onClick={() => onPageChange(0)}
          >
            {"<<"}
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            disabled={currentPage === 0}
            onClick={() => onPageChange(currentPage - 1)}
          >
            {"<"}
          </Button>
          <span className="text-sm">
            {currentPage * pageSize + 1}-{Math.min((currentPage + 1) * pageSize, totalElements)} / {totalElements}
          </span>
          <Button 
            variant="outline" 
            size="sm"
            disabled={currentPage >= totalPages - 1}
            onClick={() => onPageChange(currentPage + 1)}
          >
            {">"}
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            disabled={currentPage >= totalPages - 1}
            onClick={() => onPageChange(totalPages - 1)}
          >
            {">>"}
          </Button>
        </div>

        <div className="flex items-center gap-2 text-sm">
          <span>{pageSize} hàng trên mỗi trang</span>
          <select 
            value={pageSize} 
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="px-2 py-1 border rounded text-sm"
          >
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
          <span>Trang {currentPage + 1} / {totalPages}</span>
          <span>Tổng số xe {totalElements}</span>
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
    </div>
  )
}
