"use client"

import { useState, useEffect } from "react"
import type { EntryExitRequest, Employee, Vehicle } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowDown, ArrowUp, Calendar, Clock, User, Car } from "lucide-react"

interface VehicleRequestFormProps {
  request?: EntryExitRequest
  employees: Employee[]
  vehicles: Vehicle[]
  isOpen: boolean
  onClose: () => void
  onSave: (request: Omit<EntryExitRequest, "id" | "createdAt">) => void
}

export function VehicleRequestForm({ 
  request, 
  employees, 
  vehicles, 
  isOpen, 
  onClose, 
  onSave 
}: VehicleRequestFormProps) {
  const [formData, setFormData] = useState<Partial<EntryExitRequest>>({
    employeeId: request?.employeeId || "",
    employeeName: request?.employeeName || "",
    vehicleId: request?.vehicleId || "",
    licensePlate: request?.licensePlate || "",
    requestType: request?.requestType || "entry",
    requestTime: request?.requestTime || "",
    status: request?.status || "pending",
    notes: request?.notes || "",
  })

  const [availableVehicles, setAvailableVehicles] = useState<Vehicle[]>([])

  // Update form data when request prop changes
  useEffect(() => {
    if (request) {
      setFormData({
        employeeId: request.employeeId || "",
        employeeName: request.employeeName || "",
        vehicleId: request.vehicleId || "",
        licensePlate: request.licensePlate || "",
        requestType: request.requestType || "entry",
        requestTime: request.requestTime || "",
        status: request.status || "pending",
        notes: request.notes || "",
      })
    } else {
      // Reset form for new request - always set status to pending
      setFormData({
        employeeId: "",
        employeeName: "",
        vehicleId: "",
        licensePlate: "",
        requestType: "entry",
        requestTime: "",
        status: "pending", // Always pending for new requests
        notes: "",
      })
    }
  }, [request])

  useEffect(() => {
    if (formData.employeeId) {
      const employeeVehicles = vehicles.filter(v => v.employeeId === formData.employeeId)
      setAvailableVehicles(employeeVehicles)
      
      // Reset vehicle selection if current vehicle doesn't belong to selected employee
      if (formData.vehicleId && !employeeVehicles.find(v => v.id === formData.vehicleId)) {
        setFormData(prev => ({ ...prev, vehicleId: "", licensePlate: "" }))
      }
    } else {
      setAvailableVehicles([])
    }
  }, [formData.employeeId, vehicles])

  const handleInputChange = (field: keyof EntryExitRequest, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleEmployeeChange = (employeeId: string) => {
    const employee = employees.find(emp => emp.id === employeeId)
    setFormData((prev) => ({ 
      ...prev, 
      employeeId,
      employeeName: employee?.name || ""
    }))
  }

  const handleVehicleChange = (vehicleId: string) => {
    const vehicle = vehicles.find(v => v.id === vehicleId)
    setFormData((prev) => ({ 
      ...prev, 
      vehicleId,
      licensePlate: vehicle?.licensePlate || ""
    }))
  }

  const handleSubmit = () => {
    if (!formData.employeeId || !formData.vehicleId || !formData.requestTime) {
      alert("Vui lòng điền đầy đủ thông tin bắt buộc")
      return
    }

    onSave({
      employeeId: formData.employeeId!,
      employeeName: formData.employeeName!,
      vehicleId: formData.vehicleId!,
      licensePlate: formData.licensePlate!,
      requestType: formData.requestType!,
      requestTime: formData.requestTime!,
      status: request ? formData.status || "pending" : "pending", // Always pending for new requests
      notes: formData.notes,
      approvedBy: formData.approvedBy,
      approvedAt: formData.approvedAt,
    })
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

  const getVehicleTypeLabel = (type: string) => {
    const labels = {
      car: "Ô tô",
      motorbike: "Xe máy",
      truck: "Xe tải",
      bus: "Xe bus"
    }
    return labels[type as keyof typeof labels] || type
  }

  const getRequestTypeIcon = (type: string) => {
    return type === "entry" ? (
      <ArrowDown className="h-4 w-4 text-blue-600" />
    ) : (
      <ArrowUp className="h-4 w-4 text-purple-600" />
    )
  }

  const getRequestTypeLabel = (type: string) => {
    return type === "entry" ? "Vào" : "Ra"
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge className="bg-green-100 text-green-800">Đã duyệt</Badge>
      case "pending":
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Chờ duyệt</Badge>
      case "rejected":
        return <Badge variant="destructive" className="bg-red-100 text-red-800">Từ chối</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {request ? "Chỉnh sửa yêu cầu ra vào" : "Tạo yêu cầu ra vào mới"}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="basic" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="basic">Thông tin cơ bản</TabsTrigger>
            <TabsTrigger value="details">Chi tiết & Ghi chú</TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="employeeId">Nhân viên *</Label>
                <Select
                  value={formData.employeeId}
                  onValueChange={handleEmployeeChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn nhân viên" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((employee) => (
                      <SelectItem key={employee.id} value={employee.id}>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4" />
                          <span>{employee.name} - {employee.employeeId}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="vehicleId">Xe *</Label>
                <Select
                  value={formData.vehicleId}
                  onValueChange={handleVehicleChange}
                  disabled={!formData.employeeId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn xe" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableVehicles.map((vehicle) => (
                      <SelectItem key={vehicle.id} value={vehicle.id}>
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{getVehicleTypeIcon(vehicle.vehicleType)}</span>
                          <span>{vehicle.licensePlate} - {getVehicleTypeLabel(vehicle.vehicleType)}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="requestType">Loại yêu cầu *</Label>
                <Select
                  value={formData.requestType}
                  onValueChange={(value) => handleInputChange("requestType", value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="entry">
                      <div className="flex items-center gap-2">
                        <ArrowDown className="h-4 w-4 text-blue-600" />
                        <span>Vào</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="exit">
                      <div className="flex items-center gap-2">
                        <ArrowUp className="h-4 w-4 text-purple-600" />
                        <span>Ra</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Trạng thái</Label>
                <Select
                  value="pending"
                  disabled={true}
                >
                  <SelectTrigger className="bg-muted">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Chờ duyệt</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="requestTime">Thời gian yêu cầu *</Label>
                <Input
                  id="requestTime"
                  type="datetime-local"
                  value={formData.requestTime}
                  onChange={(e) => handleInputChange("requestTime", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Thời gian hiện tại</Label>
                <Button
                  variant="outline"
                  onClick={() => {
                    const now = new Date()
                    const localDateTime = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
                      .toISOString()
                      .slice(0, 16)
                    handleInputChange("requestTime", localDateTime)
                  }}
                  className="w-full"
                >
                  <Clock className="h-4 w-4 mr-2" />
                  Sử dụng thời gian hiện tại
                </Button>
              </div>
            </div>

            {/* Vehicle Information Display */}
            {formData.vehicleId && (
              <div className="p-4 border rounded-lg bg-muted/50">
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <Car className="h-4 w-4" />
                  Thông tin xe
                </h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Biển số:</span>
                    <span className="ml-2 font-medium">{formData.licensePlate}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Loại xe:</span>
                    <span className="ml-2 font-medium">
                      {vehicles.find(v => v.id === formData.vehicleId) && 
                        getVehicleTypeLabel(vehicles.find(v => v.id === formData.vehicleId)!.vehicleType)
                      }
                    </span>
                  </div>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="details" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="notes">Ghi chú</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => handleInputChange("notes", e.target.value)}
                rows={4}
                placeholder="Ghi chú thêm về yêu cầu này..."
              />
            </div>

            {request && (
              <div className="space-y-4">
                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium mb-2">Thông tin duyệt</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Trạng thái:</span>
                      <span className="ml-2">{getStatusBadge(formData.status || "pending")}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Duyệt bởi:</span>
                      <span className="ml-2 font-medium">{formData.approvedBy || "-"}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Thời gian duyệt:</span>
                      <span className="ml-2 font-medium">
                        {formData.approvedAt ? new Date(formData.approvedAt).toLocaleString("vi-VN") : "-"}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Thời gian tạo:</span>
                      <span className="ml-2 font-medium">
                        {request.createdAt ? new Date(request.createdAt).toLocaleString("vi-VN") : "-"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="p-4 border rounded-lg bg-blue-50">
              <h4 className="font-medium mb-2 text-blue-800">Lưu ý</h4>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• Yêu cầu sẽ được gửi để xem xét và phê duyệt</li>
                <li>• Thời gian yêu cầu sẽ được ghi nhận chính xác</li>
                <li>• Có thể thêm ghi chú để cung cấp thêm thông tin</li>
                <li>• Trạng thái sẽ được cập nhật sau khi được xem xét</li>
              </ul>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Hủy
          </Button>
          <Button onClick={handleSubmit}>
            {request ? "Cập nhật" : "Tạo yêu cầu"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
