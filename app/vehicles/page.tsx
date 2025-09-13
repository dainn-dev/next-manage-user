"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { dataService } from "@/lib/data-service"
import type { Vehicle, EntryExitRequest, Employee } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"

export default function VehiclesPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [entryExitRequests, setEntryExitRequests] = useState<EntryExitRequest[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [isVehicleDialogOpen, setIsVehicleDialogOpen] = useState(false)
  const [isRequestDialogOpen, setIsRequestDialogOpen] = useState(false)
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null)
  const [editingRequest, setEditingRequest] = useState<EntryExitRequest | null>(null)

  const [vehicleForm, setVehicleForm] = useState({
    employeeId: "",
    licensePlate: "",
    vehicleType: "car" as "car" | "motorbike",
    brand: "",
    model: "",
    color: "",
    registrationDate: "",
    status: "active" as "active" | "inactive",
  })

  const [requestForm, setRequestForm] = useState({
    employeeId: "",
    vehicleId: "",
    requestType: "entry" as "entry" | "exit",
    requestTime: "",
    notes: "",
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = () => {
    setVehicles(dataService.getVehicles())
    setEntryExitRequests(dataService.getEntryExitRequests())
    setEmployees(dataService.getEmployees())
  }

  const resetVehicleForm = () => {
    setVehicleForm({
      employeeId: "",
      licensePlate: "",
      vehicleType: "car",
      brand: "",
      model: "",
      color: "",
      registrationDate: "",
      status: "active",
    })
    setEditingVehicle(null)
  }

  const resetRequestForm = () => {
    setRequestForm({
      employeeId: "",
      vehicleId: "",
      requestType: "entry",
      requestTime: "",
      notes: "",
    })
    setEditingRequest(null)
  }

  const handleVehicleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const employee = employees.find((emp) => emp.id === vehicleForm.employeeId)
    if (!employee) return

    const vehicleData = {
      ...vehicleForm,
      employeeName: employee.name,
    }

    if (editingVehicle) {
      dataService.updateVehicle(editingVehicle.id, vehicleData)
    } else {
      dataService.createVehicle(vehicleData)
    }

    loadData()
    setIsVehicleDialogOpen(false)
    resetVehicleForm()
  }

  const handleRequestSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const employee = employees.find((emp) => emp.id === requestForm.employeeId)
    const vehicle = vehicles.find((v) => v.id === requestForm.vehicleId)
    if (!employee || !vehicle) return

    const requestData = {
      ...requestForm,
      employeeName: employee.name,
      licensePlate: vehicle.licensePlate,
      status: "pending" as const,
    }

    if (editingRequest) {
      dataService.updateEntryExitRequest(editingRequest.id, requestData)
    } else {
      dataService.createEntryExitRequest(requestData)
    }

    loadData()
    setIsRequestDialogOpen(false)
    resetRequestForm()
  }

  const handleEditVehicle = (vehicle: Vehicle) => {
    setEditingVehicle(vehicle)
    setVehicleForm({
      employeeId: vehicle.employeeId,
      licensePlate: vehicle.licensePlate,
      vehicleType: vehicle.vehicleType,
      brand: vehicle.brand || "",
      model: vehicle.model || "",
      color: vehicle.color || "",
      registrationDate: vehicle.registrationDate,
      status: vehicle.status,
    })
    setIsVehicleDialogOpen(true)
  }

  const handleDeleteVehicle = (id: string) => {
    if (confirm("Bạn có chắc chắn muốn xóa xe này?")) {
      dataService.deleteVehicle(id)
      loadData()
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
    return type === "car" ? "Ô tô" : "Xe máy"
  }

  const getRequestTypeLabel = (type: string) => {
    return type === "entry" ? "Vào" : "Ra"
  }

  return (
    <div className="p-6 space-y-6">
      <div className="border-b border-border pb-6">
        <h1 className="text-3xl font-bold text-foreground">Quản lý xe</h1>
        <p className="text-muted-foreground mt-2">Quản lý thông tin xe và yêu cầu ra vào của nhân viên</p>
      </div>

      <Tabs defaultValue="vehicles" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="vehicles">Danh sách xe</TabsTrigger>
          <TabsTrigger value="requests">Yêu cầu ra vào</TabsTrigger>
        </TabsList>

        <TabsContent value="vehicles" className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold text-foreground">Danh sách xe</h2>
              <p className="text-sm text-muted-foreground">Tổng cộng: {vehicles.length} xe</p>
            </div>
            <Dialog open={isVehicleDialogOpen} onOpenChange={setIsVehicleDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={resetVehicleForm} className="btn-primary">
                  Thêm xe mới
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>{editingVehicle ? "Chỉnh sửa xe" : "Thêm xe mới"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleVehicleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="employeeId">Nhân viên</Label>
                    <Select
                      value={vehicleForm.employeeId}
                      onValueChange={(value) => setVehicleForm({ ...vehicleForm, employeeId: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Chọn nhân viên" />
                      </SelectTrigger>
                      <SelectContent>
                        {employees.map((employee) => (
                          <SelectItem key={employee.id} value={employee.id}>
                            {employee.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="licensePlate">Biển số xe</Label>
                    <Input
                      id="licensePlate"
                      value={vehicleForm.licensePlate}
                      onChange={(e) => setVehicleForm({ ...vehicleForm, licensePlate: e.target.value })}
                      placeholder="30A-12345"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="vehicleType">Loại xe</Label>
                    <Select
                      value={vehicleForm.vehicleType}
                      onValueChange={(value: "car" | "motorbike") =>
                        setVehicleForm({ ...vehicleForm, vehicleType: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="car">Ô tô</SelectItem>
                        <SelectItem value="motorbike">Xe máy</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="brand">Hãng xe</Label>
                      <Input
                        id="brand"
                        value={vehicleForm.brand}
                        onChange={(e) => setVehicleForm({ ...vehicleForm, brand: e.target.value })}
                        placeholder="Toyota, Honda..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="model">Mẫu xe</Label>
                      <Input
                        id="model"
                        value={vehicleForm.model}
                        onChange={(e) => setVehicleForm({ ...vehicleForm, model: e.target.value })}
                        placeholder="Camry, Wave..."
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="color">Màu sắc</Label>
                      <Input
                        id="color"
                        value={vehicleForm.color}
                        onChange={(e) => setVehicleForm({ ...vehicleForm, color: e.target.value })}
                        placeholder="Trắng, Đỏ..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="registrationDate">Ngày đăng ký</Label>
                      <Input
                        id="registrationDate"
                        type="date"
                        value={vehicleForm.registrationDate}
                        onChange={(e) => setVehicleForm({ ...vehicleForm, registrationDate: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="status">Trạng thái</Label>
                    <Select
                      value={vehicleForm.status}
                      onValueChange={(value: "active" | "inactive") =>
                        setVehicleForm({ ...vehicleForm, status: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Hoạt động</SelectItem>
                        <SelectItem value="inactive">Không hoạt động</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex gap-3 pt-4">
                    <Button type="submit" className="flex-1 btn-primary">
                      {editingVehicle ? "Cập nhật" : "Thêm mới"}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setIsVehicleDialogOpen(false)}>
                      Hủy
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid gap-4">
            {vehicles.map((vehicle) => (
              <Card key={vehicle.id} className="card-modern-hover">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start">
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center text-lg">
                          {vehicle.vehicleType === "car" ? "🚗" : "🏍️"}
                        </div>
                        <div>
                          <h3 className="font-semibold text-lg text-foreground">{vehicle.licensePlate}</h3>
                          <Badge variant={vehicle.status === "active" ? "default" : "secondary"}>
                            {vehicle.status === "active" ? "Hoạt động" : "Không hoạt động"}
                          </Badge>
                        </div>
                      </div>
                      <div className="space-y-1 text-sm text-muted-foreground">
                        <p>
                          <span className="font-medium">Chủ xe:</span> {vehicle.employeeName}
                        </p>
                        <p>
                          <span className="font-medium">Loại xe:</span> {getVehicleTypeLabel(vehicle.vehicleType)}
                        </p>
                        {vehicle.brand && vehicle.model && (
                          <p>
                            <span className="font-medium">Xe:</span> {vehicle.brand} {vehicle.model}
                          </p>
                        )}
                        {vehicle.color && (
                          <p>
                            <span className="font-medium">Màu:</span> {vehicle.color}
                          </p>
                        )}
                        <p>
                          <span className="font-medium">Đăng ký:</span>{" "}
                          {new Date(vehicle.registrationDate).toLocaleDateString("vi-VN")}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleEditVehicle(vehicle)}>
                        Sửa
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteVehicle(vehicle.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        Xóa
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="requests" className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold text-foreground">Yêu cầu ra vào</h2>
              <p className="text-sm text-muted-foreground">Tổng cộng: {entryExitRequests.length} yêu cầu</p>
            </div>
            <Dialog open={isRequestDialogOpen} onOpenChange={setIsRequestDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={resetRequestForm} className="btn-primary">
                  Tạo yêu cầu mới
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Tạo yêu cầu ra vào</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleRequestSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="employeeId">Nhân viên</Label>
                    <Select
                      value={requestForm.employeeId}
                      onValueChange={(value) => setRequestForm({ ...requestForm, employeeId: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Chọn nhân viên" />
                      </SelectTrigger>
                      <SelectContent>
                        {employees.map((employee) => (
                          <SelectItem key={employee.id} value={employee.id}>
                            {employee.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="vehicleId">Xe</Label>
                    <Select
                      value={requestForm.vehicleId}
                      onValueChange={(value) => setRequestForm({ ...requestForm, vehicleId: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Chọn xe" />
                      </SelectTrigger>
                      <SelectContent>
                        {vehicles
                          .filter((v) => v.employeeId === requestForm.employeeId)
                          .map((vehicle) => (
                            <SelectItem key={vehicle.id} value={vehicle.id}>
                              {vehicle.licensePlate} - {getVehicleTypeLabel(vehicle.vehicleType)}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="requestType">Loại yêu cầu</Label>
                    <Select
                      value={requestForm.requestType}
                      onValueChange={(value: "entry" | "exit") =>
                        setRequestForm({ ...requestForm, requestType: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="entry">Vào</SelectItem>
                        <SelectItem value="exit">Ra</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="requestTime">Thời gian yêu cầu</Label>
                    <Input
                      id="requestTime"
                      type="datetime-local"
                      value={requestForm.requestTime}
                      onChange={(e) => setRequestForm({ ...requestForm, requestTime: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="notes">Ghi chú</Label>
                    <Textarea
                      id="notes"
                      value={requestForm.notes}
                      onChange={(e) => setRequestForm({ ...requestForm, notes: e.target.value })}
                      placeholder="Ghi chú thêm..."
                    />
                  </div>
                  <div className="flex gap-3 pt-4">
                    <Button type="submit" className="flex-1 btn-primary">
                      Tạo yêu cầu
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setIsRequestDialogOpen(false)}>
                      Hủy
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid gap-4">
            {entryExitRequests.map((request) => (
              <Card key={request.id} className="card-modern-hover">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start">
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center text-lg">
                          {request.requestType === "entry" ? "🔽" : "🔼"}
                        </div>
                        <div>
                          <h3 className="font-semibold text-lg text-foreground">{request.employeeName}</h3>
                          <Badge
                            variant={
                              request.status === "pending"
                                ? "secondary"
                                : request.status === "approved"
                                  ? "default"
                                  : "destructive"
                            }
                          >
                            {request.status === "pending"
                              ? "Chờ duyệt"
                              : request.status === "approved"
                                ? "Đã duyệt"
                                : "Từ chối"}
                          </Badge>
                        </div>
                      </div>
                      <div className="space-y-1 text-sm text-muted-foreground">
                        <p>
                          <span className="font-medium">Loại:</span> {getRequestTypeLabel(request.requestType)}
                        </p>
                        <p>
                          <span className="font-medium">Xe:</span> {request.licensePlate}
                        </p>
                        <p>
                          <span className="font-medium">Thời gian:</span>{" "}
                          {new Date(request.requestTime).toLocaleString("vi-VN")}
                        </p>
                        {request.notes && (
                          <p>
                            <span className="font-medium">Ghi chú:</span> {request.notes}
                          </p>
                        )}
                        {request.approvedBy && (
                          <p>
                            <span className="font-medium">Duyệt bởi:</span> {request.approvedBy} •{" "}
                            {new Date(request.approvedAt!).toLocaleString("vi-VN")}
                          </p>
                        )}
                      </div>
                    </div>
                    {request.status === "pending" && (
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleApproveRequest(request.id)}
                          className="text-accent hover:text-accent"
                        >
                          Duyệt
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRejectRequest(request.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          Từ chối
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
