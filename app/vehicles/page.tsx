"use client"

import { useState, useEffect } from "react"
import type { Vehicle, EntryExitRequest, Employee } from "@/lib/types"
import { dataService } from "@/lib/data-service"
import { VehicleTable } from "@/components/vehicles/vehicle-table"
import { VehicleForm } from "@/components/vehicles/vehicle-form"
import { VehicleRequestsTable } from "@/components/vehicles/vehicle-requests-table"
import { VehicleRequestForm } from "@/components/vehicles/vehicle-request-form"
import { BulkOperationsDialog } from "@/components/vehicles/bulk-operations-dialog"
import { RequestsBulkOperationsDialog } from "@/components/vehicles/requests-bulk-operations-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"

export default function VehiclesPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [entryExitRequests, setEntryExitRequests] = useState<EntryExitRequest[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | undefined>()
  const [selectedRequest, setSelectedRequest] = useState<EntryExitRequest | undefined>()
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isRequestFormOpen, setIsRequestFormOpen] = useState(false)
  const [showBulkOperations, setShowBulkOperations] = useState(false)
  const [showRequestsBulkOperations, setShowRequestsBulkOperations] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
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

  const loadData = async (page: number = currentPage, size: number = pageSize, sort: string = sortBy, direction: string = sortDir) => {
    try {
      setLoading(true)
      setError(null)
      const [vehiclesResponse, requestsData, employeesData] = await Promise.all([
        dataService.getVehicles(page, size, sort, direction),
        dataService.getEntryExitRequests(),
        dataService.getEmployees()
      ])
      setVehicles(vehiclesResponse.vehicles)
      setTotalElements(vehiclesResponse.totalElements)
      setTotalPages(vehiclesResponse.totalPages)
      setCurrentPage(vehiclesResponse.currentPage)
      setEntryExitRequests(requestsData)
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
        const response = await dataService.createVehicleWithResponse(vehicleData)
        
        if (response.alreadyExists) {
          toast({
            variant: "warning",
            title: "Cảnh báo",
            description: response.message,
          })
        } else {
          toast({
            variant: "success",
            title: "Tạo mới thành công",
            description: "Xe mới đã được tạo thành công.",
          })
        }
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

  const handleEditRequest = (request: EntryExitRequest) => {
    setSelectedRequest(request)
    setIsRequestFormOpen(true)
  }

  const handleDeleteRequest = async (requestId: string) => {
    if (confirm("Bạn có chắc chắn muốn xóa yêu cầu này?")) {
      try {
        await dataService.deleteEntryExitRequest(requestId)
        await loadData() // Reload the data
      } catch (err) {
        setError('Không thể xóa yêu cầu')
        console.error('Error deleting request:', err)
      }
    }
  }

  const handleViewRequest = (request: EntryExitRequest) => {
    setSelectedRequest(request)
    setIsRequestFormOpen(true)
  }

  const handleSaveRequest = async (requestData: Omit<EntryExitRequest, "id" | "createdAt">) => {
    try {
      if (selectedRequest) {
        await dataService.updateEntryExitRequest(selectedRequest.id, requestData)
        toast({
          variant: "success",
          title: "Cập nhật thành công",
          description: "Yêu cầu ra vào đã được cập nhật thành công.",
        })
      } else {
        await dataService.createEntryExitRequest(requestData)
        toast({
          variant: "success",
          title: "Tạo mới thành công",
          description: "Yêu cầu ra vào mới đã được tạo thành công.",
        })
      }
      await loadData() // Reload the data
      setIsRequestFormOpen(false)
      setSelectedRequest(undefined)
    } catch (err) {
      setError('Không thể lưu yêu cầu')
      console.error('Error saving request:', err)
      toast({
        variant: "destructive",
        title: "Lỗi lưu yêu cầu",
        description: "Không thể lưu yêu cầu ra vào. Vui lòng thử lại sau.",
      })
    }
  }

  const handleAddNewRequest = () => {
    setSelectedRequest(undefined)
    setIsRequestFormOpen(true)
  }

  const handleUpdateVehicle = (vehicleIds: string[]) => {
    if (vehicleIds.length !== 1) return
    
    // Only allow single vehicle update
    const vehicle = vehicles.find(v => v.id === vehicleIds[0])
    if (vehicle) {
      handleEdit(vehicle)
    }
  }

  const handleApproveRequest = (id: string) => {
    dataService.updateEntryExitRequest(id, {
      status: "approved",
      approvedBy: "admin",
      approvedAt: new Date().toISOString(),
    })
    loadData()
  }

  const handleRejectRequest = (id: string) => {
    dataService.updateEntryExitRequest(id, {
      status: "rejected",
      approvedBy: "admin",
      approvedAt: new Date().toISOString(),
    })
    loadData()
  }

  const handleBulkApproveRequests = async (requestIds: string[]) => {
    if (confirm(`Bạn có chắc chắn muốn duyệt ${requestIds.length} yêu cầu đã chọn?`)) {
      try {
        const updatePromises = requestIds.map(id => 
          dataService.updateEntryExitRequest(id, {
            status: "approved",
            approvedBy: "admin",
            approvedAt: new Date().toISOString(),
          })
        )
        await Promise.all(updatePromises)
        await loadData()
        toast({
          variant: "success",
          title: "Duyệt thành công",
          description: `${requestIds.length} yêu cầu đã được duyệt.`,
        })
      } catch (err) {
        setError('Không thể duyệt yêu cầu')
        console.error('Error approving requests:', err)
        toast({
          variant: "destructive",
          title: "Lỗi duyệt yêu cầu",
          description: "Không thể duyệt yêu cầu. Vui lòng thử lại sau.",
        })
      }
    }
  }

  const handleBulkRejectRequests = async (requestIds: string[]) => {
    if (confirm(`Bạn có chắc chắn muốn từ chối ${requestIds.length} yêu cầu đã chọn?`)) {
      try {
        const updatePromises = requestIds.map(id => 
          dataService.updateEntryExitRequest(id, {
            status: "rejected",
            approvedBy: "admin",
            approvedAt: new Date().toISOString(),
          })
        )
        await Promise.all(updatePromises)
        await loadData()
        toast({
          variant: "success",
          title: "Từ chối thành công",
          description: `${requestIds.length} yêu cầu đã được từ chối.`,
        })
      } catch (err) {
        setError('Không thể từ chối yêu cầu')
        console.error('Error rejecting requests:', err)
        toast({
          variant: "destructive",
          title: "Lỗi từ chối yêu cầu",
          description: "Không thể từ chối yêu cầu. Vui lòng thử lại sau.",
        })
      }
    }
  }

  const getStatusBadge = (status: string) => {
    const variants = {
      active: "bg-accent/20 text-accent-foreground border-accent/30",
      inactive: "bg-muted text-muted-foreground border-border",
      pending: "bg-secondary/20 text-secondary-foreground border-secondary/30",
      approved: "bg-accent/20 text-accent-foreground border-accent/30",
      rejected: "bg-destructive/20 text-destructive-foreground border-destructive/30",
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
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-4">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-muted-foreground">Đang tải dữ liệu...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8 bg-background min-h-screen">
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-4 text-center">
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

  return (
    <div className="p-8 bg-background min-h-screen">
      <div className="flex items-center justify-between mb-8">
        <div>
        <h1 className="text-3xl font-bold text-foreground">Quản lý xe</h1>
          <p className="text-muted-foreground text-lg">Quản lý thông tin xe và yêu cầu ra vào của nhân viên</p>
        </div>
      </div>

      <Tabs defaultValue="vehicles" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="vehicles">Danh sách xe</TabsTrigger>
          <TabsTrigger value="requests">Yêu cầu ra vào</TabsTrigger>
        </TabsList>

        <TabsContent value="vehicles" className="space-y-6">
          <VehicleTable 
            vehicles={vehicles} 
            onEdit={handleEdit} 
            onDelete={handleDelete} 
            onView={handleView} 
            onAddNew={handleAddNew} 
            onBulkUpdate={handleUpdateVehicle}
            onRefresh={() => loadData()}
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
              console.log("Bulk operation:", operation)
            }}
          />
        </TabsContent>

        <TabsContent value="requests" className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold text-foreground">Yêu cầu ra vào</h2>
              <p className="text-sm text-muted-foreground">Tổng cộng: {entryExitRequests.length} yêu cầu</p>
            </div>
          </div>

          <VehicleRequestsTable
            requests={entryExitRequests}
            vehicles={vehicles}
            onEdit={handleEditRequest}
            onDelete={handleDeleteRequest}
            onView={handleViewRequest}
            onApprove={handleApproveRequest}
            onReject={handleRejectRequest}
            onBulkApprove={handleBulkApproveRequests}
            onBulkReject={handleBulkRejectRequests}
            onAddNew={handleAddNewRequest}
            onRefresh={loadData}
          />

          <VehicleRequestForm
            request={selectedRequest}
            employees={employees}
            vehicles={vehicles}
            isOpen={isRequestFormOpen}
            onClose={() => {
              setIsRequestFormOpen(false)
              setSelectedRequest(undefined)
            }}
            onSave={handleSaveRequest}
          />

          <RequestsBulkOperationsDialog
            isOpen={showRequestsBulkOperations}
            onClose={() => setShowRequestsBulkOperations(false)}
            selectedCount={0}
            onApply={(operation) => {
              console.log("Bulk operation:", operation)
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}