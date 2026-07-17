"use client"

import { useState, useEffect, useCallback } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import type { Vehicle, Employee } from "@/lib/types"
import { UserRole, canApprove, canManageVehicles, isSiteManager } from "@/lib/types"
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
import { Search, Plus, RefreshCw, Trash2, Car, TrendingUp, CheckCircle, Settings, Filter, FileSpreadsheet, RotateCcw } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { exportVehiclesToExcel } from "@/lib/utils/excel-export"
import { useAuth } from "@/lib/auth-context"
import { resolvePreferredSiteId } from "@/lib/site-selection"
import { AdminPage, AdminPageHeader } from "@/components/layout/admin-page"

export default function VehiclesPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
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
  const [filterVehicles, setFilterVehicles] = useState<Vehicle[] | null>(null)
  const [filterLoading, setFilterLoading] = useState(false)
  const [filterLoadError, setFilterLoadError] = useState(false)
  const [filterRetryKey, setFilterRetryKey] = useState(0)
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(0)
  const [pageSize, setPageSize] = useState(10)
  const [totalElements, setTotalElements] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [sortBy, setSortBy] = useState('createdAt')
  const [sortDir, setSortDir] = useState('desc')
  
  // Filter bar state
  const [isFilterBarOpen, setIsFilterBarOpen] = useState(false)
  
  const { toast } = useToast()
  const { user } = useAuth()
  const userCanManage = canManageVehicles(user?.role)
  const userCanApprove = canApprove(user?.role)
  const [siteFilterTick, setSiteFilterTick] = useState(0)

  useEffect(() => {
    const onSite = () => setSiteFilterTick((n) => n + 1)
    window.addEventListener("pv-site-selection", onSite)
    return () => window.removeEventListener("pv-site-selection", onSite)
  }, [])

  const notifyPermissionDenied = useCallback(() => {
    toast({
      variant: "destructive",
      title: "Không có quyền",
      description: "Tài khoản của bạn chỉ có quyền xem danh sách xe.",
    })
  }, [toast])

  useEffect(() => {
    loadData()
  }, [])

  // Handle URL parameters for vehicle editing
  useEffect(() => {
    const vehicleId = searchParams.get('id')
    if (vehicleId && vehicles.length > 0) {
      const vehicle = vehicles.find(v => v.id === vehicleId)
      if (vehicle) {
        console.log("Opening vehicle edit form for ID:", vehicleId)
        setSelectedVehicle(vehicle)
        setIsFormOpen(true)
        
        // Clean up URL parameter
        const newSearchParams = new URLSearchParams(searchParams.toString())
        newSearchParams.delete('id')
        const newUrl = newSearchParams.toString() 
          ? `${window.location.pathname}?${newSearchParams.toString()}`
          : window.location.pathname
        router.replace(newUrl)
      } else {
        console.log("Vehicle not found for ID:", vehicleId)
        toast({
          variant: "destructive",
          title: "Không tìm thấy xe",
          description: `Không tìm thấy xe với ID: ${vehicleId}`,
        })
        
        // Clean up URL parameter even if vehicle not found
        const newSearchParams = new URLSearchParams(searchParams.toString())
        newSearchParams.delete('id')
        const newUrl = newSearchParams.toString() 
          ? `${window.location.pathname}?${newSearchParams.toString()}`
          : window.location.pathname
        router.replace(newUrl)
      }
    }
  }, [searchParams, vehicles, router, toast])

  // Filter vehicles based on search and filter criteria
  const preferredSite = isSiteManager(user?.role)
    ? resolvePreferredSiteId(user?.siteIds)
    : null
  const normalizedSearch = searchTerm.trim().toLowerCase()
  const hasActiveFilters = Boolean(normalizedSearch || statusFilter !== "all" || typeFilter !== "all")
  const filterSource = hasActiveFilters && filterVehicles ? filterVehicles : vehicles
  const matchingVehicles = filterSource.filter((vehicle) => {
    void siteFilterTick
    const matchesSearch = !normalizedSearch ||
      vehicle.licensePlate.toLowerCase().includes(normalizedSearch) ||
      vehicle.employeeName?.toLowerCase().includes(normalizedSearch) ||
      vehicle.brand?.toLowerCase().includes(normalizedSearch) ||
      vehicle.model?.toLowerCase().includes(normalizedSearch)
    
    const matchesStatus = statusFilter === "all" || vehicle.status === statusFilter
    const matchesType = typeFilter === "all" || vehicle.vehicleType === typeFilter
    const matchesSite = !preferredSite || vehicle.currentSiteId === preferredSite

    return matchesSearch && matchesStatus && matchesType && matchesSite
  })
  const filteredTotalElements = hasActiveFilters && filterVehicles ? matchingVehicles.length : totalElements
  const filteredTotalPages = hasActiveFilters && filterVehicles ? Math.ceil(matchingVehicles.length / pageSize) : totalPages
  const filterDataReady = !hasActiveFilters || filterVehicles !== null
  const filteredVehicles = hasActiveFilters && filterVehicles
    ? matchingVehicles.slice(currentPage * pageSize, (currentPage + 1) * pageSize)
    : matchingVehicles

  useEffect(() => {
    setCurrentPage(0)
  }, [normalizedSearch, statusFilter, typeFilter])

  useEffect(() => {
    if (!hasActiveFilters) {
      setFilterVehicles(null)
      setFilterLoading(false)
      setFilterLoadError(false)
      return
    }
    if (filterVehicles) return

    let cancelled = false
    setFilterLoading(true)
    setFilterLoadError(false)
    dataService.getAllVehiclesList()
      .then((items) => {
        if (!cancelled) setFilterVehicles(items)
      })
      .catch((filterError) => {
        if (!cancelled) {
          setFilterLoadError(true)
          toast({
            variant: "destructive",
            title: "Không thể lọc toàn bộ danh sách",
            description: "Vui lòng thử lại sau.",
          })
          console.error("Failed to load vehicles for filtering:", filterError)
        }
      })
      .finally(() => {
        if (!cancelled) setFilterLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [filterVehicles, filterRetryKey, hasActiveFilters, toast])

  const clearFilters = () => {
    setSearchTerm("")
    setStatusFilter("all")
    setTypeFilter("all")
    setCurrentPage(0)
    void loadData(0, pageSize, sortBy, sortDir)
  }

  const loadData = async (page: number = currentPage, size: number = pageSize, sort: string = sortBy, direction: string = sortDir) => {
    // Prevent multiple simultaneous calls (but allow initial load)
    if (loading && vehicles.length > 0) return
    
    try {
      setLoading(true)
      setError(null)
      // Employee API is not part of the current product surface; keep picker empty.
      const vehiclesResponse = await dataService.getVehicles(page, size, sort, direction)
      setVehicles(vehiclesResponse.vehicles)
      setTotalElements(vehiclesResponse.totalElements)
      setTotalPages(vehiclesResponse.totalPages)
      setCurrentPage(vehiclesResponse.currentPage)
      setEmployees([])
      if (hasActiveFilters) setFilterVehicles(null)
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
    if (!hasActiveFilters || !filterVehicles) {
      loadData(newPage, pageSize, sortBy, sortDir)
    }
  }

  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize)
    setCurrentPage(0) // Reset to first page
    if (!hasActiveFilters || !filterVehicles) {
      loadData(0, newPageSize, sortBy, sortDir)
    }
  }

  const handleSortChange = (newSortBy: string, newSortDir: string) => {
    setSortBy(newSortBy)
    setSortDir(newSortDir)
    setCurrentPage(0) // Reset to first page
    loadData(0, pageSize, newSortBy, newSortDir)
  }

  const handleEdit = (vehicle: Vehicle) => {
    if (!userCanManage) {
      notifyPermissionDenied()
      return
    }
    setSelectedVehicle(vehicle)
    setIsFormOpen(true)
    
    // Update URL to include vehicle ID for sharing
    const newSearchParams = new URLSearchParams(searchParams.toString())
    newSearchParams.set('id', vehicle.id)
    const newUrl = `${window.location.pathname}?${newSearchParams.toString()}`
    router.push(newUrl)
  }

  const handleDelete = async (vehicleId: string) => {
    if (!userCanManage) {
      notifyPermissionDenied()
      return
    }
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
    if (!userCanManage) {
      notifyPermissionDenied()
      return
    }
    setSelectedVehicle(vehicle)
    setIsFormOpen(true)
    
    // Update URL to include vehicle ID for sharing
    const newSearchParams = new URLSearchParams(searchParams.toString())
    newSearchParams.set('id', vehicle.id)
    const newUrl = `${window.location.pathname}?${newSearchParams.toString()}`
    router.push(newUrl)
  }

  const handleSave = async (vehicleData: Omit<Vehicle, "id" | "createdAt" | "updatedAt">): Promise<Vehicle | void> => {
    if (!userCanManage) {
      notifyPermissionDenied()
      return
    }
    try {
      if (selectedVehicle) {
        const updatedVehicle = await dataService.updateVehicle(selectedVehicle.id, vehicleData)
        toast({
          variant: "success",
          title: "Cập nhật thành công",
          description: "Thông tin xe đã được cập nhật thành công.",
        })
        return updatedVehicle || undefined
      } else {
        const newVehicle = await dataService.createVehicle(vehicleData)
        
        setVehicles(prev => [...prev, newVehicle])
        toast({
          variant: "success",
          title: "Tạo mới thành công",
          description: "Xe mới đã được thêm vào hệ thống.",
        })
        return newVehicle
      }
    } catch (err) {
      setError('Không thể lưu thông tin xe')
      console.error('Error saving vehicle:', err)
      throw err
    }
  }

  const handleAfterSave = async () => {
    if (!userCanManage) {
      return
    }
    // Clean up after save
    await loadData() // Reload the data
    setIsFormOpen(false)
    setSelectedVehicle(undefined)
    
    // Clean up URL parameter after save
    const newSearchParams = new URLSearchParams(searchParams.toString())
    newSearchParams.delete('id')
    const newUrl = newSearchParams.toString() 
      ? `${window.location.pathname}?${newSearchParams.toString()}`
      : window.location.pathname
    router.replace(newUrl)
  }

  const handleAddNew = () => {
    if (!userCanManage) {
      notifyPermissionDenied()
      return
    }
    setSelectedVehicle(undefined)
    setIsFormOpen(true)
  }


  const handleUpdateVehicle = (vehicleIds: string[]) => {
    if (!userCanManage) {
      notifyPermissionDenied()
      return
    }
    if (vehicleIds.length !== 1) return
    
    // Only allow single vehicle update
    const vehicle = vehicles.find(v => v.id === vehicleIds[0])
    if (vehicle) {
      handleEdit(vehicle)
    }
  }

  const handleApprove = async (vehicle: Vehicle) => {
    if (!userCanApprove) {
      notifyPermissionDenied()
      return
    }
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
    if (!userCanApprove) {
      notifyPermissionDenied()
      return
    }
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
    if (!userCanManage) {
      notifyPermissionDenied()
      return
    }
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
    if (!userCanApprove) {
      notifyPermissionDenied()
      return
    }
    if (!filterDataReady) {
      toast({
        title: "Đang chuẩn bị dữ liệu",
        description: "Vui lòng chờ bộ lọc hoàn tất trước khi xuất Excel.",
      })
      return
    }
    try {
      const exportSource = hasActiveFilters && filterVehicles ? matchingVehicles : vehicles
      const filename = `danh_sach_xe_${new Date().toISOString().split('T')[0]}`
      const success = exportVehiclesToExcel(exportSource, filename)
      
       if (success) {
         toast({
           title: "Xuất file thành công",
           description: `Đã xuất ${exportSource.length} xe ra file CSV (có thể mở bằng Excel)`,
           variant: "default",
         })
       } else {
         throw new Error('Export failed')
       }
     } catch (error) {
       console.error('Export error:', error)
       toast({
         title: "Lỗi xuất file",
         description: "Có lỗi xảy ra khi xuất dữ liệu. Vui lòng thử lại.",
         variant: "destructive",
       })
     }
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
      <div className="admin-mobile-page min-h-dvh bg-background">
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
      <div className="admin-mobile-page min-h-dvh bg-background">
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
  const approvalRate = stats.total > 0 ? Math.round((stats.approved / stats.total) * 100) : 0
  const mobileStats = [
    {
      label: "Tổng xe",
      value: stats.total,
      description: `${stats.approved} đã duyệt`,
      icon: Car,
      tone: "text-muted-foreground",
      surface: "bg-muted/70",
    },
    {
      label: "Đã duyệt",
      value: stats.approved,
      description: "Hoạt động",
      icon: CheckCircle,
      tone: "text-green-600",
      surface: "bg-green-50",
    },
    {
      label: "Đã ra",
      value: stats.exited,
      description: "Rời khu vực",
      icon: TrendingUp,
      tone: "text-blue-600",
      surface: "bg-blue-50",
    },
    {
      label: "Tỷ lệ duyệt",
      value: `${approvalRate}%`,
      description: "Được phép",
      icon: Settings,
      tone: "text-purple-600",
      surface: "bg-purple-50",
    },
  ]

  return (
    <AdminPage className="min-h-dvh">
      <AdminPageHeader
        eyebrow="Phương tiện"
        title="Quản lý xe"
        description="Quản lý thông tin xe và yêu cầu ra vào của nhân viên"
        actions={
        <Button
          onClick={handleAddNew}
          className="w-full shadow-sm transition-all duration-200 hover:shadow-md sm:w-auto"
          disabled={!userCanManage}
        >
          <Plus className="h-4 w-4 mr-2" />
          Thêm xe mới
        </Button>
        }
      />

      {/* Statistics Cards */}
      <div className="mb-5 grid grid-cols-2 gap-2 md:hidden">
        {mobileStats.map((item) => {
          const Icon = item.icon
          return (
            <Card key={item.label} className="overflow-hidden rounded-xl border-border/75 bg-card/90 py-0 shadow-[var(--shadow-card)]">
              <CardContent className="relative min-h-[5.25rem] p-2.5 sm:p-2.5">
                <span className={`absolute right-2.5 top-2.5 grid size-7 place-items-center rounded-lg ${item.surface}`}>
                  <Icon className={`h-3.5 w-3.5 ${item.tone}`} />
                </span>
                <p className="pr-8 text-xs font-semibold leading-4 text-foreground">{item.label}</p>
                <p className={`mt-2 font-[family:var(--font-display)] text-[1.65rem] font-bold leading-none tracking-[-0.04em] ${item.tone}`}>
                  {item.value}
                </p>
                <p className="mt-0.5 truncate text-xs leading-4 text-muted-foreground">{item.description}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="mb-6 hidden gap-4 md:grid md:grid-cols-4">
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
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.approved}</div>
            <p className="text-xs text-muted-foreground">
              Xe được phép hoạt động
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Đã ra</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.exited}</div>
            <p className="text-xs text-muted-foreground">
              Xe đã rời khỏi khu vực
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tỷ lệ duyệt</CardTitle>
            <Settings className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {approvalRate}%
            </div>
            <p className="text-xs text-muted-foreground">
              Xe được phép hoạt động
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Action Bar */}
      {selectedVehicles.length > 0 && userCanManage && (
        <div className="flex items-center gap-4 p-4 bg-blue-50 border border-blue-200 rounded-lg mb-6 shadow-sm">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></div>
            <Badge variant="secondary" className="bg-blue-100 text-blue-800 border-blue-300">
              {selectedVehicles.length} xe đã chọn
            </Badge>
          </div>
          <Button 
            variant="destructive" 
            size="sm" 
            onClick={handleBulkDelete}
            className="shadow-sm hover:shadow-md transition-all duration-200"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Xóa đã chọn
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
            totalPages={filteredTotalPages}
            totalElements={filteredTotalElements}
            pageSize={pageSize}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
            userRole={user?.role}
            hasActiveFilters={hasActiveFilters}
            isFiltering={filterLoading}
            filterLoadError={filterLoadError}
            onRetryFilter={() => setFilterRetryKey((key) => key + 1)}
            toolbarActions={
              <>
                <Button
                  variant={isFilterBarOpen || hasActiveFilters ? "default" : "outline"}
                  size="sm"
                  onClick={() => setIsFilterBarOpen(!isFilterBarOpen)}
                  className="h-11 w-full p-0 md:size-11 lg:w-auto lg:px-3"
                  aria-label={isFilterBarOpen ? "Đóng bộ lọc" : hasActiveFilters ? "Mở bộ lọc, đang áp dụng" : "Mở bộ lọc"}
                  aria-expanded={isFilterBarOpen}
                  aria-controls="vehicle-filter-panel"
                  title={isFilterBarOpen ? "Đóng bộ lọc" : hasActiveFilters ? "Mở bộ lọc (đang áp dụng)" : "Mở bộ lọc"}
                >
                  <Filter className="h-4 w-4" />
                  <span className="sr-only lg:not-sr-only">{isFilterBarOpen ? "Đóng bộ lọc" : "Mở bộ lọc"}</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => loadData()}
                  className="h-11 w-full p-0 md:size-11 lg:w-auto lg:px-3"
                  aria-label="Làm mới dữ liệu"
                  title="Làm mới dữ liệu"
                >
                  <RefreshCw className="h-4 w-4" />
                  <span className="sr-only lg:not-sr-only">Làm mới dữ liệu</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExport}
                  disabled={!userCanApprove || !filterDataReady || filterLoading || filterLoadError}
                  className="h-11 w-full p-0 md:size-11 lg:w-auto lg:px-3"
                  aria-label="Xuất Excel"
                  title="Xuất Excel"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  <span className="sr-only lg:not-sr-only">Xuất Excel</span>
                </Button>
              </>
            }
            filterPanel={isFilterBarOpen ? (
              <div id="vehicle-filter-panel" className="rounded-xl border bg-card p-3 shadow-sm sm:p-5">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">Bộ lọc</h3>
                    <p className="mt-1 text-xs text-muted-foreground">Lọc theo biển số, trạng thái và loại xe.</p>
                  </div>
                  {hasActiveFilters && (
                    <Button variant="ghost" size="sm" className="min-h-11 shrink-0" onClick={clearFilters}>
                      <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                      Xóa lọc
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
                  <div className="col-span-2 space-y-1.5 sm:col-span-1">
                    <Label htmlFor="vehicle-search-filter" className="flex items-center gap-2 text-xs font-semibold text-foreground">
                      <Search className="h-4 w-4 text-blue-600" />
                      Tìm kiếm
                    </Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                      <Input
                        id="vehicle-search-filter"
                        placeholder="Nhập biển số, chủ xe, loại xe..."
                        value={searchTerm}
                        onChange={(event) => setSearchTerm(event.target.value)}
                        className="h-11 rounded-lg border-border pl-10 shadow-sm"
                      />
                    </div>
                  </div>
                  <div className="min-w-0 space-y-1.5">
                    <Label htmlFor="vehicle-status-filter" className="flex items-center gap-2 text-xs font-semibold text-foreground">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      Trạng thái
                    </Label>
                    <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as any)}>
                      <SelectTrigger id="vehicle-status-filter" className="h-11 w-full rounded-lg border-border shadow-sm">
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
                  <div className="min-w-0 space-y-1.5">
                    <Label htmlFor="vehicle-type-filter" className="flex items-center gap-2 text-xs font-semibold text-foreground">
                      <Car className="h-4 w-4 text-purple-600" />
                      Loại xe
                    </Label>
                    <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value as any)}>
                      <SelectTrigger id="vehicle-type-filter" className="h-11 w-full rounded-lg border-border shadow-sm">
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
              </div>
            ) : null}
          />

      {userCanManage && (
        <VehicleForm
          vehicle={selectedVehicle}
          employees={employees}
          isOpen={isFormOpen}
          onClose={() => {
            setIsFormOpen(false)
            setSelectedVehicle(undefined)
            
            // Clean up URL parameter when closing form
            const newSearchParams = new URLSearchParams(searchParams.toString())
            newSearchParams.delete('id')
            const newUrl = newSearchParams.toString() 
              ? `${window.location.pathname}?${newSearchParams.toString()}`
              : window.location.pathname
            router.replace(newUrl)
          }}
          onSave={handleSave}
          onAfterSave={handleAfterSave}
        />
      )}

      <BulkOperationsDialog
        isOpen={showBulkOperations}
        onClose={() => setShowBulkOperations(false)}
        selectedCount={0}
        onApply={(operation) => {
          // Bulk operation selected
        }}
      />
    </AdminPage>
  )
}
