"use client"

import { useState, useEffect } from "react"
import type { Vehicle, Employee } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"

interface VehicleFormProps {
  vehicle?: Vehicle
  employees: Employee[]
  isOpen: boolean
  onClose: () => void
  onSave: (vehicle: Omit<Vehicle, "id" | "createdAt" | "updatedAt">) => void
}

export function VehicleForm({ vehicle, employees, isOpen, onClose, onSave }: VehicleFormProps) {
  const [formData, setFormData] = useState<Partial<Vehicle>>({
    employeeId: vehicle?.employeeId || "",
    employeeName: vehicle?.employeeName || "",
    licensePlate: vehicle?.licensePlate || "",
    vehicleType: vehicle?.vehicleType || "car",
    brand: vehicle?.brand || "",
    model: vehicle?.model || "",
    color: vehicle?.color || "",
    year: vehicle?.year || undefined,
    registrationDate: vehicle?.registrationDate || "",
    status: vehicle?.status || "active",
    notes: vehicle?.notes || "",
  })

  // Update form data when vehicle prop changes
  useEffect(() => {
    if (vehicle) {
      setFormData({
        employeeId: vehicle.employeeId || "",
        employeeName: vehicle.employeeName || "",
        licensePlate: vehicle.licensePlate || "",
        vehicleType: vehicle.vehicleType || "car",
        brand: vehicle.brand || "",
        model: vehicle.model || "",
        color: vehicle.color || "",
        year: vehicle.year || undefined,
        registrationDate: vehicle.registrationDate || "",
        status: vehicle.status || "active",
        notes: vehicle.notes || "",
      })
    } else {
      // Reset form for new vehicle
      setFormData({
        employeeId: "",
        employeeName: "",
        licensePlate: "",
        vehicleType: "car",
        brand: "",
        model: "",
        color: "",
        year: undefined,
        registrationDate: "",
        status: "active",
        notes: "",
      })
    }
  }, [vehicle])

  // Blur license plate input when dialog opens
  useEffect(() => {
    if (isOpen) {
      // Small delay to ensure the input is rendered
      const timer = setTimeout(() => {
        const licensePlateInput = document.getElementById('licensePlate') as HTMLInputElement
        if (licensePlateInput) {
          licensePlateInput.blur()
        }
      }, 100)
      
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  const handleInputChange = (field: keyof Vehicle, value: any) => {
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

  const handleSubmit = () => {
    if (!formData.employeeId || !formData.licensePlate) {
      alert("Vui lòng điền đầy đủ thông tin bắt buộc")
      return
    }

    onSave({
      employeeId: formData.employeeId!,
      employeeName: formData.employeeName!,
      licensePlate: formData.licensePlate!,
      vehicleType: formData.vehicleType!,
      brand: formData.brand,
      model: formData.model,
      color: formData.color,
      year: formData.year,
      registrationDate: formData.registrationDate || new Date().toISOString().split('T')[0],
      status: formData.status || "active",
      notes: formData.notes,
    })
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="text-2xl">🚗</span>
            {vehicle ? "Chỉnh sửa xe" : "Thêm mới xe"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <span>📋</span>
              Thông tin cơ bản
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="licensePlate">Biển số xe *</Label>
                <Input
                  id="licensePlate"
                  value={formData.licensePlate}
                  onChange={(e) => handleInputChange("licensePlate", e.target.value)}
                  placeholder="30A-12345"
                  className="font-mono"
                  autoFocus={false}
                  tabIndex={-1}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="employeeId">Chủ xe *</Label>
                <Select
                  value={formData.employeeId}
                  onValueChange={handleEmployeeChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn chủ xe" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((employee) => (
                      <SelectItem key={employee.id} value={employee.id}>
                        {employee.name} - {employee.employeeId}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="vehicleType">Loại xe *</Label>
                <Select
                  value={formData.vehicleType}
                  onValueChange={(value) => handleInputChange("vehicleType", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn loại xe" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="car">🚗 Ô tô</SelectItem>
                    <SelectItem value="motorbike">🏍️ Xe máy</SelectItem>
                    <SelectItem value="truck">🚛 Xe tải</SelectItem>
                    <SelectItem value="bus">🚌 Xe bus</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Vehicle Details */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <span>🚙</span>
              Thông tin xe
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="brand">Hãng xe</Label>
                <Input
                  id="brand"
                  value={formData.brand}
                  onChange={(e) => handleInputChange("brand", e.target.value)}
                  placeholder="Toyota, Honda..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="model">Model</Label>
                <Input
                  id="model"
                  value={formData.model}
                  onChange={(e) => handleInputChange("model", e.target.value)}
                  placeholder="Camry, Civic..."
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="color">Màu sắc</Label>
                <Input
                  id="color"
                  value={formData.color}
                  onChange={(e) => handleInputChange("color", e.target.value)}
                  placeholder="Trắng, Đỏ..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="year">Năm sản xuất</Label>
                <Input
                  id="year"
                  type="number"
                  value={formData.year || ""}
                  onChange={(e) => handleInputChange("year", e.target.value ? parseInt(e.target.value) : undefined)}
                  placeholder="2020"
                  min="1900"
                  max={new Date().getFullYear() + 1}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Ghi chú</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => handleInputChange("notes", e.target.value)}
                rows={3}
                placeholder="Ghi chú thêm về xe..."
              />
            </div>
          </div>
        </div>

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={onClose}>
            Hủy
          </Button>
          <Button onClick={handleSubmit} className="bg-blue-600 hover:bg-blue-700">
            <span className="mr-2">💾</span>
            {vehicle ? "Cập nhật" : "Thêm mới"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}