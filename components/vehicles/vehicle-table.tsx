"use client"

import { useState } from "react"
import type { Vehicle } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Search, Filter, Download, Car as CarIcon, MoreHorizontal, Edit, Trash2, Eye, Check, X } from "lucide-react"
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
  onApprove?: (vehicle: Vehicle) => void
  onReject?: (vehicle: Vehicle) => void
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
  onApprove,
  onReject,
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
      case "approved":
        return (
          <Badge variant="default" className="bg-green-100 text-green-800">
            Duyệt
          </Badge>
        )
      case "rejected":
        return <Badge variant="destructive" className="bg-red-100 text-red-800">Không được phép</Badge>
      case "exited":
        return <Badge variant="outline" className="bg-blue-100 text-blue-800">Đã ra</Badge>
      case "entered":
        return <Badge variant="secondary" className="bg-purple-100 text-purple-800">Đã vào</Badge>
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



      {/* Data Table */}
      <div className="border rounded-lg">
        <div className="overflow-x-auto">
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
                <TableHead className="w-32">Hoạt động</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredVehicles.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
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
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="relative">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const menu = document.getElementById(`menu-${vehicle.id}`)
                              if (menu) {
                                menu.classList.toggle('hidden')
                              }
                            }}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                          <div
                            id={`menu-${vehicle.id}`}
                            className="absolute right-0 top-8 hidden z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
                          >
                            {/* Conditional approve/reject actions based on status */}
                            {vehicle.status === "approved" && onReject && (
                              <div
                                className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground text-red-600"
                                onClick={() => {
                                  onReject(vehicle)
                                  document.getElementById(`menu-${vehicle.id}`)?.classList.add('hidden')
                                }}
                              >
                                <X className="h-4 w-4 mr-2" />
                                Không được phép
                              </div>
                            )}
                            {vehicle.status === "rejected" && onApprove && (
                              <div
                                className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground text-green-600"
                                onClick={() => {
                                  onApprove(vehicle)
                                  document.getElementById(`menu-${vehicle.id}`)?.classList.add('hidden')
                                }}
                              >
                                <Check className="h-4 w-4 mr-2" />
                                Duyệt
                              </div>
                            )}

                            {/* Always show edit action */}
                            <div
                              className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                              onClick={() => {
                                onEdit(vehicle)
                                document.getElementById(`menu-${vehicle.id}`)?.classList.add('hidden')
                              }}
                            >
                              <Edit className="h-4 w-4 mr-2" />
                              Chỉnh sửa
                            </div>
                            
                            {/* Always show delete action */}
                            <div
                              className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground text-red-600"
                              onClick={() => {
                                onDelete(vehicle.id)
                                document.getElementById(`menu-${vehicle.id}`)?.classList.add('hidden')
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
