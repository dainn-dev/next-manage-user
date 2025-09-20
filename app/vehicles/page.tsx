"use client"

import { useState, useEffect } from "react"
import type { Vehicle, Employee } from "@/lib/types"
import { dataService } from "@/lib/data-service"
import { VehicleTable } from "@/components/vehicles/vehicle-table"
import { VehicleForm } from "@/components/vehicles/vehicle-form"
import { BulkOperationsDialog } from "@/components/vehicles/bulk-operations-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Search, Download, Plus, RefreshCw, Trash2, Car, TrendingUp, CheckCircle, Settings } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export default function VehiclesPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | undefined>()
  const [selectedVehicles, setSelectedVehicles] = useState<string[]>([])
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [showBulkOperations, setShowBulkOperations] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | "approved" | "rejected" | "exited" | "entered">("all")
  const [typeFilter, setTypeFilter] = useState<"all" | "car" | "motorbike" | "truck" | "bus">("all")
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(0)
  const [pageSize, setPageSize] = useState(10)
  const [totalElements, setTotalElements] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [sortBy, setSortBy] = useState('createdAt')
  const [sortDir, setSortDir] = useState('desc')
  
  const { toast } = useToast()

  useEffect(() => {
    loadData()
  }, [])

  // Filter vehicles based on search and filter criteria
  const filteredVehicles = vehicles.filter((vehicle) => {
    const matchesSearch = !searchTerm || 
      vehicle.licensePlate.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vehicle.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vehicle.brand?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vehicle.model?.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesStatus = statusFilter === "all" || vehicle.status === statusFilter
    const matchesType = typeFilter === "all" || vehicle.vehicleType === typeFilter

    return matchesSearch && matchesStatus && matchesType
  })

  const loadData = async (page: number = currentPage, size: number = pageSize, sort: string = sortBy, direction: string = sortDir) => {
    // Prevent multiple simultaneous calls (but allow initial load)
    if (loading && vehicles.length > 0) return
    
    try {
      setLoading(true)
      setError(null)
      const [vehiclesResponse, employeesData] = await Promise.all([
        dataService.getVehicles(page, size, sort, direction),
        dataService.getEmployees()
      ])
      setVehicles(vehiclesResponse.vehicles)
      setTotalElements(vehiclesResponse.totalElements)
      setTotalPages(vehiclesResponse.totalPages)
      setCurrentPage(vehiclesResponse.currentPage)
      setEmployees(employeesData)
    } catch (err) {
      setError('Không thể tải dữ liệu')
      console.error('Error loading data:', err)
      toast({
        variant: "destructive",
        title: "Lỗi tải dữ liệu",
        description: "Không thể tải dữ liệu. Vui lòng thử lại sau.",
      })
    } finally {
      setLoading(false)
    }
  }

  // Pagination handlers
  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage)
    loadData(newPage, pageSize, sortBy, sortDir)
  }

  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize)
    setCurrentPage(0) // Reset to first page
    loadData(0, newPageSize, sortBy, sortDir)
  }

  const handleSortChange = (newSortBy: string, newSortDir: string) => {
    setSortBy(newSortBy)
    setSortDir(newSortDir)
    setCurrentPage(0) // Reset to first page
    loadData(0, pageSize, newSortBy, newSortDir)
  }

  const handleEdit = (vehicle: Vehicle) => {
    setSelectedVehicle(vehicle)
    setIsFormOpen(true)
  }

  const handleDelete = async (vehicleId: string) => {
    if (confirm("Bạn có chắc chắn muốn xóa xe này?")) {
      try {
        await dataService.deleteVehicle(vehicleId)
        await loadData() // Reload the data
        toast({
          variant: "success",
          title: "Xóa thành công",
          description: "Xe đã được xóa khỏi hệ thống.",
        })
      } catch (err) {
        setError('Không thể xóa xe')
        console.error('Error deleting vehicle:', err)
        toast({
          variant: "destructive",
          title: "Lỗi xóa xe",
          description: "Không thể xóa xe. Vui lòng thử lại sau.",
        })
      }
    }
  }

  const handleView = (vehicle: Vehicle) => {
    setSelectedVehicle(vehicle)
    setIsFormOpen(true)
  }

  const handleSave = async (vehicleData: Omit<Vehicle, "id" | "createdAt" | "updatedAt">) => {
    try {
      if (selectedVehicle) {
        await dataService.updateVehicle(selectedVehicle.id, vehicleData)
        toast({
          variant: "success",
          title: "Cập nhật thành công",
          description: "Thông tin xe đã được cập nhật thành công.",
        })
      } else {
        const newVehicle = await dataService.createVehicle(vehicleData)
        
        setVehicles(prev => [...prev, newVehicle])
        toast({
          variant: "success",
          title: "Tạo mới thành công",
          description: "Xe mới đã được thêm vào hệ thống.",
        })
      }
      await loadData() // Reload the data
      setIsFormOpen(false)
      setSelectedVehicle(undefined)
    } catch (err) {
      setError('Không thể lưu thông tin xe')
      console.error('Error saving vehicle:', err)
      
      // Check if it's a duplicate license plate error
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      if (errorMessage.includes('duplicate key') || errorMessage.includes('license_plate')) {
        toast({
          variant: "destructive",
          title: "Biển số xe đã tồn tại",
          description: "Biển số xe này đã được sử dụng. Vui lòng chọn biển số khác.",
        })
      } else {
        toast({
          variant: "destructive",
          title: "Lỗi lưu thông tin",
          description: "Không thể lưu thông tin xe. Vui lòng thử lại sau.",
        })
      }
    }
  }

  const handleAddNew = () => {
    setSelectedVehicle(undefined)
    setIsFormOpen(true)
  }


  const handleUpdateVehicle = (vehicleIds: string[]) => {
    if (vehicleIds.length !== 1) return
    
    // Only allow single vehicle update
    const vehicle = vehicles.find(v => v.id === vehicleIds[0])
    if (vehicle) {
      handleEdit(vehicle)
    }
  }

  const handleApprove = async (vehicle: Vehicle) => {
    try {
      const updatedVehicle = await dataService.updateVehicle(vehicle.id, {
        ...vehicle,
        status: "approved"
      })
      
      if (updatedVehicle) {
        setVehicles(prev => prev.map(v => v.id === vehicle.id ? updatedVehicle : v))
        toast({
          title: "Thành công",
          description: `Đã duyệt xe ${vehicle.licensePlate}`,
        })
      }
    } catch (err) {
      console.error('Error approving vehicle:', err)
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: "Không thể duyệt xe",
      })
    }
  }

  const handleReject = async (vehicle: Vehicle) => {
    try {
      const updatedVehicle = await dataService.updateVehicle(vehicle.id, {
        ...vehicle,
        status: "rejected"
      })
      
      if (updatedVehicle) {
        setVehicles(prev => prev.map(v => v.id === vehicle.id ? updatedVehicle : v))
        toast({
          title: "Thành công", 
          description: `Đã từ chối xe ${vehicle.licensePlate}`,
        })
      }
    } catch (err) {
      console.error('Error rejecting vehicle:', err)
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: "Không thể từ chối xe",
      })
    }
  }

  const handleBulkDelete = async () => {
    if (selectedVehicles.length === 0) return
    
    if (confirm(`Bạn có chắc chắn muốn xóa ${selectedVehicles.length} xe đã chọn?`)) {
      try {
        await Promise.all(selectedVehicles.map(id => dataService.deleteVehicle(id)))
        setSelectedVehicles([])
        await loadData()
        toast({
          title: "Thành công",
          description: `${selectedVehicles.length} xe đã được xóa thành công!`,
        })
      } catch (error) {
        console.error("Error bulk deleting vehicles:", error)
        toast({
          title: "Lỗi",
          description: "Không thể xóa các xe đã chọn",
          variant: "destructive",
        })
      }
    }
  }

  const handleExport = () => {
    // Export functionality to be implemented
    alert("Tính năng xuất dữ liệu sẽ được triển khai sau")
    toast({
      title: "Thông báo",
      description: "Tính năng xuất dữ liệu đang được phát triển",
    })
  }

  const getStatistics = () => {
    const total = vehicles.length
    const approved = vehicles.filter(v => v.status === "approved").length
    const rejected = vehicles.filter(v => v.status === "rejected").length
    const exited = vehicles.filter(v => v.status === "exited").length
    const entered = vehicles.filter(v => v.status === "entered").length
    
    const typeStats = vehicles.reduce((acc, v) => {
      acc[v.vehicleType] = (acc[v.vehicleType] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    return { total, approved, rejected, exited, entered, typeStats }
  }

  const getStatusBadge = (status: string) => {
    const variants = {
      active: "bg-accent/20 text-accent-foreground border-accent/30",
      inactive: "bg-muted text-muted-foreground border-border",
      pending: "bg-secondary/20 text-secondary-foreground border-secondary/30",
      approved: "bg-accent/20 text-accent-foreground border-accent/30",
    }
    return variants[status as keyof typeof variants] || "bg-muted text-muted-foreground border-border"
  }

  const getVehicleTypeLabel = (type: string) => {
    const labels = {
      car: "Ô tô",
      motorbike: "Xe máy",
      truck: "Xe tải",
      bus: "Xe bus"
    }
    return labels[type as keyof typeof labels] || type
  }

  const getRequestTypeLabel = (type: string) => {
    return type === "entry" ? "Vào" : "Ra"
  }

  if (loading) {
    return (
      <div className="p-8 bg-background min-h-screen">
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 bg-blue-100 rounded-lg flex items-center justify-center">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
            <p className="text-blue-600 font-medium">Đang tải dữ liệu xe...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8 bg-background min-h-screen">
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 bg-red-100 rounded-lg flex items-center justify-center">
              <span className="text-red-600 text-2xl">⚠️</span>
            </div>
            <div>
              <p className="text-red-600 font-medium">{error}</p>
              <button 
                onClick={() => loadData()}
                className="mt-2 text-sm text-blue-600 hover:text-blue-700 underline"
              >
                Thử lại
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const stats = getStatistics()

  return (
    <div className="p-8 bg-background min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Quản lý xe</h1>
          <p className="text-muted-foreground text-lg">Quản lý thông tin xe và yêu cầu ra vào của nhân viên</p>
        </div>
        <Button onClick={handleAddNew}>
          <Plus className="h-4 w-4 mr-2" />
          Thêm xe mới
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tổng số xe</CardTitle>
            <Car className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">
              {stats.approved} đã được duyệt
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Đã duyệt</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.approved}</div>
            <p className="text-xs text-muted-foreground">
              Xe được phép hoạt động
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Đã ra</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.exited}</div>
            <p className="text-xs text-muted-foreground">
              Xe đã rời khỏi khu vực
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tỷ lệ duyệt</CardTitle>
            <Settings className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.total > 0 ? Math.round((stats.approved / stats.total) * 100) : 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              Xe được phép hoạt động
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filter Bar */}
      <div className="bg-white border rounded-lg p-6 mb-6 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Search Section */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Search className="h-4 w-4" />
              Tìm kiếm
            </Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Nhập biển số, chủ xe, loại xe..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-10 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              />
            </div>
          </div>

          {/* Status Filter */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Trạng thái
            </Label>
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as any)}>
              <SelectTrigger className="h-10 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200">
                <SelectValue placeholder="Chọn trạng thái" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">🚗 Tất cả</SelectItem>
                <SelectItem value="approved">✅ Duyệt</SelectItem>
                <SelectItem value="rejected">❌ Không được phép</SelectItem>
                <SelectItem value="exited">🚪 Đã ra</SelectItem>
                <SelectItem value="entered">🏠 Đã vào</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Type Filter */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Car className="h-4 w-4" />
              Loại xe
            </Label>
            <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value as any)}>
              <SelectTrigger className="h-10 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200">
                <SelectValue placeholder="Chọn loại xe" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">🚗 Tất cả</SelectItem>
                <SelectItem value="car">🚗 Ô tô</SelectItem>
                <SelectItem value="motorbike">🏍️ Xe máy</SelectItem>
                <SelectItem value="truck">🚛 Xe tải</SelectItem>
                <SelectItem value="bus">🚌 Xe bus</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3 mt-6 pt-4 border-t border-gray-100">
          <Button variant="outline" size="sm" onClick={() => loadData()} className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            Làm mới dữ liệu
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport} className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            Xuất Excel
          </Button>
        </div>
      </div>

      {/* Action Bar */}
      {selectedVehicles.length > 0 && (
        <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg mb-6">
          <Badge variant="secondary">
            {selectedVehicles.length} đã chọn
          </Badge>
          <Button variant="destructive" size="sm" onClick={handleBulkDelete}>
            <Trash2 className="h-4 w-4 mr-2" />
            Xóa
          </Button>
        </div>
      )}
          <VehicleTable 
            vehicles={filteredVehicles} 
            onEdit={handleEdit} 
            onDelete={handleDelete} 
            onView={handleView} 
            onAddNew={handleAddNew} 
            onBulkUpdate={handleUpdateVehicle}
            onRefresh={() => loadData()}
            onApprove={handleApprove}
            onReject={handleReject}
            currentPage={currentPage}
            totalPages={totalPages}
            totalElements={totalElements}
            pageSize={pageSize}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
          />

      <VehicleForm
        vehicle={selectedVehicle}
        employees={employees}
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false)
          setSelectedVehicle(undefined)
        }}
        onSave={handleSave}
      />

      <BulkOperationsDialog
        isOpen={showBulkOperations}
        onClose={() => setShowBulkOperations(false)}
        selectedCount={0}
        onApply={(operation) => {
          // Bulk operation selected
        }}
      />
    </div>
  )
}