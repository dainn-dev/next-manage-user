"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import type { Vehicle } from "@/lib/types"
import { UserRole, canApprove, canManageVehicles } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Search, Filter, Download, Car as CarIcon, MoreHorizontal, Edit, Trash2, Eye, Check, X } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { AdvancedExportDialog } from "@/components/reports/advanced-export-dialog"
import { ImportDialog } from "@/components/reports/import-dialog"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { getImageUrl } from "@/lib/api/config"

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
  userRole?: UserRole
  isReadOnly?: boolean
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
  onPageSizeChange,
  userRole,
  isReadOnly = false
}: VehicleTableProps) {
  const router = useRouter()
  const userCanManage = canManageVehicles(userRole)
  const userCanApprove = canApprove(userRole)
  const isUserRole = userRole === UserRole.USER
  const effectiveReadOnly = isReadOnly || (!userCanManage && !userCanApprove)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedVehicles, setSelectedVehicles] = useState<string[]>([])
  const [typeFilter, setTypeFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [showAdvancedExport, setShowAdvancedExport] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [showImagePreview, setShowImagePreview] = useState(false)
  const [previewVehicle, setPreviewVehicle] = useState<Vehicle | null>(null)

  useEffect(() => {
    if (!userCanManage && selectedVehicles.length > 0) {
      setSelectedVehicles([])
    }
  }, [userCanManage, selectedVehicles])

  const handleSelectAll = (checked: boolean) => {
    if (!userCanManage) return
    if (checked) {
      setSelectedVehicles(filteredVehicles.map((vehicle) => vehicle.id))
    } else {
      setSelectedVehicles([])
    }
  }

  const handleSelectVehicle = (vehicleId: string, checked: boolean) => {
    if (!userCanManage) return
    if (checked) {
      setSelectedVehicles((prev) => [...prev, vehicleId])
    } else {
      setSelectedVehicles((prev) => prev.filter((id) => id !== vehicleId))
    }
  }

  const handleImagePreview = (vehicle: Vehicle) => {
    setPreviewVehicle(vehicle)
    setShowImagePreview(true)
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

      {(userCanManage || userCanApprove) && (
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowImport(true)}
            className="flex items-center gap-2"
          >
            <Download className="h-4 w-4 rotate-180" />
            Nhập xe
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAdvancedExport(true)}
            className="flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Xuất nâng cao
          </Button>
        </div>
      )}

      {/* Data Table */}
      <div className="border rounded-lg">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    disabled={!userCanManage}
                    checked={
                      userCanManage &&
                      selectedVehicles.length === filteredVehicles.length &&
                      filteredVehicles.length > 0
                    }
                    onCheckedChange={(checked) => handleSelectAll(!!checked)}
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
                        disabled={!userCanManage}
                        checked={userCanManage && selectedVehicles.includes(vehicle.id)}
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
                      {isUserRole ? (
                        vehicle.status === "rejected" ? (
                          <button
                            className="text-xs text-blue-600 hover:underline"
                            onClick={() => router.push(`/vehicles/requests`)}
                            type="button"
                          >
                            Yêu cầu
                          </button>
                        ) : (
                          <span className="text-xs text-muted-foreground">Chỉ xem</span>
                        )
                      ) : (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              className="h-8 w-8 p-0 hover:bg-accent transition-colors duration-150 rounded-md flex items-center justify-center"
                              type="button"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48" side="bottom">
                            {/* Approve/reject actions — only for ADMIN */}
                            {userCanApprove && vehicle.status === "approved" && onReject && (
                              <DropdownMenuItem
                                variant="destructive"
                                onClick={() => onReject(vehicle)}
                              >
                                <X className="h-4 w-4 mr-2" />
                                Không được phép
                              </DropdownMenuItem>
                            )}
                            {userCanApprove && (vehicle.status === "entered" || vehicle.status === "exited") && onReject && (
                              <DropdownMenuItem
                                variant="destructive"
                                onClick={() => onReject(vehicle)}
                              >
                                <X className="h-4 w-4 mr-2" />
                                Không được phép
                              </DropdownMenuItem>
                            )}
                            {userCanApprove && vehicle.status === "rejected" && onApprove && (
                              <DropdownMenuItem
                                onClick={() => onApprove(vehicle)}
                              >
                                <Check className="h-4 w-4 mr-2" />
                                Duyệt
                              </DropdownMenuItem>
                            )}

                            {/* Image Preview Action */}
                            {vehicle.imagePath && (
                              <DropdownMenuItem
                                onClick={() => handleImagePreview(vehicle)}
                              >
                                <Eye className="h-4 w-4 mr-2" />
                                Xem ảnh xe
                              </DropdownMenuItem>
                            )}

                            {/* Edit/Delete — only for ADMIN */}
                            {userCanManage && (
                              <DropdownMenuItem
                                onClick={() => onEdit(vehicle)}
                              >
                                <Edit className="h-4 w-4 mr-2" />
                                Chỉnh sửa
                              </DropdownMenuItem>
                            )}
                            {userCanManage && (
                              <DropdownMenuItem
                                variant="destructive"
                                onClick={() => onDelete(vehicle.id)}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Xóa
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
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
          entity="vehicle"
          onExported={() => onRefresh?.()}
        />
      )}

      {showImport && (
        <ImportDialog
          isOpen={showImport}
          onClose={() => setShowImport(false)}
          onImported={() => onRefresh?.()}
        />
      )}

      {/* Image Preview Dialog */}
      <Dialog open={showImagePreview} onOpenChange={setShowImagePreview}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">
              Ảnh xe - {previewVehicle?.licensePlate}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center space-y-4">
            {previewVehicle?.imagePath ? (
              <div className="relative w-full max-w-2xl">
                <img
                  src={getImageUrl(previewVehicle.imagePath) || ''}
                  alt={`Ảnh xe ${previewVehicle.licensePlate}`}
                  className="w-full h-auto rounded-lg shadow-lg"
                  onError={(e) => {
                    const img = e.target as HTMLImageElement;
                    img.src = '/placeholder.jpg';
                    img.alt = 'Không thể tải ảnh';
                  }}
                />
              </div>
            ) : (
              <div className="flex flex-col items-center space-y-2 text-muted-foreground">
                <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center">
                  <CarIcon className="h-8 w-8" />
                </div>
                <p>Không có ảnh xe</p>
              </div>
            )}
            
            {/* Vehicle Info */}
            {previewVehicle && (
              <div className="w-full max-w-2xl p-4 bg-muted/50 rounded-lg">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Biển số:</span>
                    <p className="text-muted-foreground">{previewVehicle.licensePlate}</p>
                  </div>
                  <div>
                    <span className="font-medium">Chủ xe:</span>
                    <p className="text-muted-foreground">{previewVehicle.employeeName}</p>
                  </div>
                  <div>
                    <span className="font-medium">Loại xe:</span>
                    <p className="text-muted-foreground">{getVehicleTypeLabel(previewVehicle.vehicleType)}</p>
                  </div>
                  <div>
                    <span className="font-medium">Trạng thái:</span>
                    <div className="mt-1">{getStatusBadge(previewVehicle.status)}</div>
                  </div>
                  {previewVehicle.brand && previewVehicle.model && (
                    <div className="col-span-2">
                      <span className="font-medium">Hãng/Model:</span>
                      <p className="text-muted-foreground">{previewVehicle.brand} {previewVehicle.model}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
