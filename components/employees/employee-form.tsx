"use client"

import { useState } from "react"
import type { Employee, Department } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface EmployeeFormProps {
  employee?: Employee
  departments: Department[]
  isOpen: boolean
  onClose: () => void
  onSave: (employee: Omit<Employee, "id" | "createdAt" | "updatedAt">) => void
}

export function EmployeeForm({ employee, departments, isOpen, onClose, onSave }: EmployeeFormProps) {
  const [formData, setFormData] = useState<Partial<Employee>>({
    employeeId: employee?.employeeId || "",
    name: employee?.name || "",
    firstName: employee?.firstName || "",
    lastName: employee?.lastName || "",
    email: employee?.email || "",
    phone: employee?.phone || "",
    department: employee?.department || "",
    position: employee?.position || "",
    hireDate: employee?.hireDate || "",
    birthDate: employee?.birthDate || "",
    gender: employee?.gender || "male",
    address: employee?.address || "",
    emergencyContact: employee?.emergencyContact || "",
    emergencyPhone: employee?.emergencyPhone || "",
    status: employee?.status || "active",
    accessLevel: employee?.accessLevel || "general",
    permissions: employee?.permissions || ["read"],
    cardNumber: employee?.cardNumber || "",
  })

  const [accessSettings, setAccessSettings] = useState({
    superUser: false,
    deviceAccess: true,
    autoIncrement: true,
    passwordLength: 9,
    supportFingerprint: false,
    autoGenerateId: true,
  })

  const handleInputChange = (field: keyof Employee, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = () => {
    if (!formData.employeeId || !formData.name || !formData.department) {
      alert("Vui lòng điền đầy đủ thông tin bắt buộc")
      return
    }

    onSave({
      employeeId: formData.employeeId!,
      name: formData.name!,
      firstName: formData.firstName || "",
      lastName: formData.lastName || "",
      email: formData.email || "",
      phone: formData.phone || "",
      department: formData.department!,
      position: formData.position || "",
      hireDate: formData.hireDate || new Date().toISOString().split("T")[0],
      birthDate: formData.birthDate,
      gender: formData.gender,
      address: formData.address,
      emergencyContact: formData.emergencyContact,
      emergencyPhone: formData.emergencyPhone,
      status: formData.status || "active",
      accessLevel: formData.accessLevel || "general",
      permissions: formData.permissions || ["read"],
      cardNumber: formData.cardNumber,
    })
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{employee ? "Chỉnh sửa nhân viên" : "Thêm mới nhân viên"}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="basic" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="basic">Thông tin cơ bản</TabsTrigger>
            <TabsTrigger value="access">Kiểm soát truy cập</TabsTrigger>
            <TabsTrigger value="details">Chi tiết nhân sự</TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="employeeId">ID nhân sự *</Label>
                <Input
                  id="employeeId"
                  value={formData.employeeId}
                  onChange={(e) => handleInputChange("employeeId", e.target.value)}
                  placeholder="249"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Tên *</Label>
                <Input id="name" value={formData.name} onChange={(e) => handleInputChange("name", e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">Họ</Label>
                <Input
                  id="firstName"
                  value={formData.firstName}
                  onChange={(e) => handleInputChange("firstName", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Số điện thoại</Label>
                <Input id="phone" value={formData.phone} onChange={(e) => handleInputChange("phone", e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="gender">Giới tính</Label>
                <Select value={formData.gender} onValueChange={(value) => handleInputChange("gender", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn giới tính" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Nam</SelectItem>
                    <SelectItem value="female">Nữ</SelectItem>
                    <SelectItem value="other">Khác</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="department">Phòng ban *</Label>
                <Select value={formData.department} onValueChange={(value) => handleInputChange("department", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Department Name" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((dept) => (
                      <SelectItem key={dept.id} value={dept.name}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="birthDate">Sinh nhật</Label>
                <Input
                  id="birthDate"
                  type="date"
                  value={formData.birthDate}
                  onChange={(e) => handleInputChange("birthDate", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hireDate">Ngày thuê</Label>
                <Input
                  id="hireDate"
                  type="date"
                  value={formData.hireDate}
                  onChange={(e) => handleInputChange("hireDate", e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange("email", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="position">Tên chức vụ</Label>
              <Select value={formData.position} onValueChange={(value) => handleInputChange("position", value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Nhân viên">Nhân viên</SelectItem>
                  <SelectItem value="Trưởng phòng">Trưởng phòng</SelectItem>
                  <SelectItem value="Phó phòng">Phó phòng</SelectItem>
                  <SelectItem value="Giám đốc">Giám đốc</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cardNumber">Số thẻ</Label>
              <Input
                id="cardNumber"
                value={formData.cardNumber}
                onChange={(e) => handleInputChange("cardNumber", e.target.value)}
              />
            </div>
          </TabsContent>

          <TabsContent value="access" className="space-y-4">
            <div className="space-y-4">
              <div className="space-y-3">
                <Label>Siêu người dùng</Label>
                <RadioGroup
                  value={accessSettings.superUser ? "yes" : "no"}
                  onValueChange={(value) => setAccessSettings((prev) => ({ ...prev, superUser: value === "yes" }))}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="no" id="super-no" />
                    <Label htmlFor="super-no">Không</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="yes" id="super-yes" />
                    <Label htmlFor="super-yes">Có</Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="space-y-3">
                <Label>Vai trò vận hành thiết bị</Label>
                <RadioGroup
                  value={accessSettings.deviceAccess ? "normal" : "admin"}
                  onValueChange={(value) =>
                    setAccessSettings((prev) => ({ ...prev, deviceAccess: value === "normal" }))
                  }
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="normal" id="device-normal" />
                    <Label htmlFor="device-normal">Người dùng thông thường</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="admin" id="device-admin" />
                    <Label htmlFor="device-admin">Quản trị viên</Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="space-y-3">
                <Label>Truy cập bị tắt</Label>
                <div className="flex items-center space-x-2">
                  <Checkbox id="access-disabled" />
                  <Label htmlFor="access-disabled">Tắt thời gian hợp lệ</Label>
                </div>
              </div>

              <div className="space-y-3">
                <Label>Đặt thời gian hợp lệ</Label>
                <div className="flex items-center space-x-2">
                  <Checkbox id="valid-time" />
                  <Label htmlFor="valid-time">Đặt thời gian hợp lệ</Label>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="details" className="space-y-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="address">Địa chỉ</Label>
                <Textarea
                  id="address"
                  value={formData.address}
                  onChange={(e) => handleInputChange("address", e.target.value)}
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="emergencyContact">Liên hệ khẩn cấp</Label>
                  <Input
                    id="emergencyContact"
                    value={formData.emergencyContact}
                    onChange={(e) => handleInputChange("emergencyContact", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="emergencyPhone">SĐT khẩn cấp</Label>
                  <Input
                    id="emergencyPhone"
                    value={formData.emergencyPhone}
                    onChange={(e) => handleInputChange("emergencyPhone", e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Trạng thái</Label>
                <Select value={formData.status} onValueChange={(value) => handleInputChange("status", value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Hoạt động</SelectItem>
                    <SelectItem value="inactive">Không hoạt động</SelectItem>
                    <SelectItem value="terminated">Đã nghỉ việc</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Hủy
          </Button>
          <Button onClick={handleSubmit}>{employee ? "Cập nhật" : "Lưu và thêm mới"}</Button>
          <Button variant="outline">OK</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
