"use client"

import { useState } from "react"
import type { EntryExitRequest, Vehicle } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowDown, ArrowUp } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Search, Filter, Download, MoreHorizontal, Edit, Trash2, Eye, CheckCircle, XCircle, Clock, Image } from "lucide-react"
import { EntryExitExportDialog } from "@/components/vehicles/entry-exit-export-dialog"
import { EntryExitImportDialog } from "@/components/vehicles/entry-exit-import-dialog"
import { RequestImagesDialog } from "@/components/vehicles/request-images-dialog"

interface VehicleRequestsTableProps {
  requests: EntryExitRequest[]
  vehicles: Vehicle[]
  onEdit: (request: EntryExitRequest) => void
  onDelete: (requestId: string) => void
  onView: (request: EntryExitRequest) => void
  onApprove: (requestId: string) => void
  onReject: (requestId: string) => void
  onBulkApprove?: (requestIds: string[]) => void
  onBulkReject?: (requestIds: string[]) => void
  onAddNew: () => void
  onRefresh?: () => void
}

export function VehicleRequestsTable({ 
  requests, 
  vehicles, 
  onEdit, 
  onDelete, 
  onView, 
  onApprove, 
  onReject, 
  onBulkApprove,
  onBulkReject,
  onAddNew,
  onRefresh 
}: VehicleRequestsTableProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedRequests, setSelectedRequests] = useState<string[]>([])
  const [statusFilter, setStatusFilter] = useState("")
  const [typeFilter, setTypeFilter] = useState("")
  const [showExport, setShowExport] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [showImagesDialog, setShowImagesDialog] = useState(false)
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null)

  const filteredRequests = requests.filter((request) => {
    const matchesSearch =
      request.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.licensePlate.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.notes?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = !statusFilter || request.status === statusFilter
    const matchesType = !typeFilter || request.requestType === typeFilter

    return matchesSearch && matchesStatus && matchesType
  })

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedRequests(filteredRequests.map((request) => request.id))
    } else {
      setSelectedRequests([])
    }
  }

  const handleSelectRequest = (requestId: string, checked: boolean) => {
    if (checked) {
      setSelectedRequests((prev) => [...prev, requestId])
    } else {
      setSelectedRequests((prev) => prev.filter((id) => id !== requestId))
    }
  }

  const getStatusBadge = (status: EntryExitRequest["status"]) => {
    switch (status) {
      case "approved":
        return (
          <Badge variant="default" className="bg-green-100 text-green-800">
            <CheckCircle className="h-3 w-3 mr-1" />
            Đã duyệt
          </Badge>
        )
      case "pending":
        return (
          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
            <Clock className="h-3 w-3 mr-1" />
            Chờ duyệt
          </Badge>
        )
      case "rejected":
        return (
          <Badge variant="destructive" className="bg-red-100 text-red-800">
            <XCircle className="h-3 w-3 mr-1" />
            Từ chối
          </Badge>
        )
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const getRequestTypeIcon = (type: EntryExitRequest["requestType"]) => {
    return type === "entry" ? (
      <ArrowDown className="h-4 w-4 text-blue-600" />
    ) : (
      <ArrowUp className="h-4 w-4 text-purple-600" />
    )
  }

  const getRequestTypeLabel = (type: EntryExitRequest["requestType"]) => {
    return type === "entry" ? "Vào" : "Ra"
  }

  const getVehicleType = (licensePlate: string) => {
    const vehicle = vehicles.find(v => v.licensePlate === licensePlate)
    return vehicle?.vehicleType || ""
  }

  const getVehicleTypeIcon = (type: string) => {
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

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString("vi-VN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    })
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("vi-VN")
  }

  const handleViewImages = (requestId: string) => {
    setSelectedRequestId(requestId)
    setShowImagesDialog(true)
  }

  return (
    <div className="space-y-4">
      {/* Search and Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-2 flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Tìm kiếm theo tên, biển số..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-full sm:w-64"
            />
          </div>
          <div className="relative">
            <Select value={statusFilter || "all"} onValueChange={(value) => setStatusFilter(value === "all" ? "" : value)}>
              <SelectTrigger className="w-full sm:w-36">
                <SelectValue placeholder="Trạng thái" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                <SelectItem value="pending">Chờ xử lý</SelectItem>
                <SelectItem value="approved">Đã duyệt</SelectItem>
                <SelectItem value="rejected">Đã từ chối</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="relative">
            <Select value={typeFilter || "all"} onValueChange={(value) => setTypeFilter(value === "all" ? "" : value)}>
              <SelectTrigger className="w-full sm:w-36">
                <SelectValue placeholder="Loại yêu cầu" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                <SelectItem value="entry">Vào</SelectItem>
                <SelectItem value="exit">Ra</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Filter className="h-4 w-4 mr-2" />
            Bộ lọc
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
            <ArrowDown className="h-4 w-4 mr-2" />
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
            className="bg-accent text-accent-foreground hover:bg-accent/90"
            disabled={selectedRequests.length === 0}
            onClick={() => {
              if (selectedRequests.length > 0 && onBulkApprove) {
                onBulkApprove(selectedRequests)
                setSelectedRequests([])
              }
            }}
          >
            Duyệt hàng loạt ({selectedRequests.length})
          </Button>
          <Button
            variant="destructive"
            size="sm"
            disabled={selectedRequests.length === 0}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={() => {
              if (selectedRequests.length > 0 && onBulkReject) {
                onBulkReject(selectedRequests)
                setSelectedRequests([])
              }
            }}
          >
            Từ chối
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowExport(true)}
            className="border-border hover:bg-muted text-card-foreground"
          >
            <Download className="h-4 w-4 mr-2" />
            Xuất Excel
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowImport(true)}
            className="border-border hover:bg-muted text-card-foreground"
          >
            <Download className="h-4 w-4 mr-2" />
            Nhập Excel
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
                  checked={selectedRequests.length === filteredRequests.length && filteredRequests.length > 0}
                  onCheckedChange={handleSelectAll}
                />
              </TableHead>
              <TableHead>Nhân viên</TableHead>
              <TableHead>Xe</TableHead>
              <TableHead>Loại yêu cầu</TableHead>
              <TableHead>Thời gian yêu cầu</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead>Duyệt bởi</TableHead>
              <TableHead>Hoạt động</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRequests.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center">
                      <ArrowDown className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <p className="text-muted-foreground">Không có dữ liệu</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredRequests.map((request) => (
                <TableRow key={request.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedRequests.includes(request.id)}
                      onCheckedChange={(checked) => handleSelectRequest(request.id, checked as boolean)}
                    />
                  </TableCell>
                  <TableCell className="font-medium">
                    <div className="flex flex-col">
                      <span>{request.employeeName}</span>
                      <span className="text-xs text-muted-foreground">ID: {request.employeeId}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{getVehicleTypeIcon(getVehicleType(request.licensePlate))}</span>
                      <div className="flex flex-col">
                        <span className="font-medium">{request.licensePlate}</span>
                        <span className="text-xs text-muted-foreground">
                          {getVehicleType(getVehicleType(request.licensePlate))}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getRequestTypeIcon(request.requestType)}
                      <span className="font-medium">{getRequestTypeLabel(request.requestType)}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-sm">{formatDate(request.requestTime)}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(request.requestTime).toLocaleTimeString("vi-VN", {
                          hour: "2-digit",
                          minute: "2-digit"
                        })}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>{getStatusBadge(request.status)}</TableCell>
                  <TableCell>
                    {request.approvedBy ? (
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{request.approvedBy}</span>
                        {request.approvedAt && (
                          <span className="text-xs text-muted-foreground">
                            {formatDate(request.approvedAt)}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onView(request)}>
                          <Eye className="h-4 w-4 mr-2" />
                          Xem
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleViewImages(request.id)}>
                          <Image className="h-4 w-4 mr-2" />
                          Xem hình ảnh
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onEdit(request)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Chỉnh sửa
                        </DropdownMenuItem>
                        {request.status === "pending" && (
                          <>
                            <DropdownMenuItem 
                              onClick={() => onApprove(request.id)}
                              className="text-green-600"
                            >
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Duyệt
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => onReject(request.id)}
                              className="text-red-600"
                            >
                              <XCircle className="h-4 w-4 mr-2" />
                              Từ chối
                            </DropdownMenuItem>
                          </>
                        )}
                        <DropdownMenuItem onClick={() => onDelete(request.id)} className="text-destructive">
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
          <span className="text-sm">1-{Math.min(50, filteredRequests.length)}</span>
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
          <span>/{Math.ceil(filteredRequests.length / 50)} trang</span>
          <span>Tổng số yêu cầu {filteredRequests.length}</span>
        </div>
      </div>

      {showExport && (
        <EntryExitExportDialog
          isOpen={showExport}
          onClose={() => setShowExport(false)}
        />
      )}

      {showImport && (
        <EntryExitImportDialog
          isOpen={showImport}
          onClose={() => setShowImport(false)}
          onImportComplete={() => {
            onRefresh?.()
          }}
        />
      )}

      {showImagesDialog && (
        <RequestImagesDialog
          isOpen={showImagesDialog}
          onClose={() => {
            setShowImagesDialog(false)
            setSelectedRequestId(null)
          }}
          requestId={selectedRequestId}
        />
      )}
    </div>
  )
}
