"use client"

import { useState, useEffect } from "react"
import type { Employee, Department, Position } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { positionApi, type PositionApiResponse } from "@/lib/api/position-api"

interface EmployeeFormProps {
  employee?: Employee
  departments: Department[]
  isOpen: boolean
  onClose: () => void
  onSave: (employee: Omit<Employee, "id" | "createdAt" | "updatedAt">) => Promise<Employee>
}

export function EmployeeForm({ employee, departments, isOpen, onClose, onSave }: EmployeeFormProps) {
  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null)
  const [sqQncnOptions, setSqQncnOptions] = useState<PositionApiResponse[]>([])
  const [filteredPositions, setFilteredPositions] = useState<PositionApiResponse[]>([])
  const [loadingFilteredPositions, setLoadingFilteredPositions] = useState(false)
  const [formData, setFormData] = useState<Partial<Employee>>({
    employeeId: employee?.employeeId || "",
    name: employee?.name || "",
    firstName: employee?.firstName || "",
    lastName: employee?.lastName || "",
    email: employee?.email || "",
    phone: employee?.phone || "",
    department: employee?.department || "",
    position: employee?.position || "",
    rank: employee?.rank || "",
    militaryCivilian: employee?.militaryCivilian || "",
    hireDate: employee?.hireDate || "",
    birthDate: employee?.birthDate || "",
    gender: employee?.gender || "male",
    address: employee?.address || "",
    emergencyContact: employee?.emergencyContact || "",
    emergencyPhone: employee?.emergencyPhone || "",
    status: employee?.status || "active",
    accessLevel: employee?.accessLevel || "general",
    permissions: employee?.permissions || ["read"],
  })

  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Load SQ/QNCN options when component mounts
  useEffect(() => {
    if (isOpen) {
      loadSqQncnOptions()
    }
  }, [isOpen])

  const loadSqQncnOptions = async () => {
    try {
      // Load position menu hierarchy and filter for root positions with null parent
      const menuData = await positionApi.getPositionMenuHierarchy()
      // Filter for positions that are root level (parentId is null) which should be SQ/QNCN options
      const rootPositions = menuData.filter(pos => !pos.parentId)
      setSqQncnOptions(rootPositions)
    } catch (error) {
      console.error("Error loading SQ/QNCN options:", error)
    }
  }


  const loadFilteredPositions = async (sqQncnSelection: string) => {
    if (!sqQncnSelection) {
      setFilteredPositions([])
      return
    }

    setLoadingFilteredPositions(true)
    try {
      // Find the selected SQ/QNCN option to get its ID
      const selectedOption = sqQncnOptions.find(option => option.name === sqQncnSelection)
      if (selectedOption) {
        // Call the specific API endpoint for filtered positions
        const response = await positionApi.getPositionsWithFilters(
          undefined, // level
          selectedOption.id, // parentId
          0, // page
          100, // size
          true // leafOnly
        )
        setFilteredPositions(response.content)
      } else {
        setFilteredPositions([])
      }
    } catch (error) {
      console.error("Error loading filtered positions:", error)
      setFilteredPositions([])
    } finally {
      setLoadingFilteredPositions(false)
    }
  }



  // Sync form data when employee prop changes
  useEffect(() => {
    // Employee prop changed
    if (employee) {
      // Setting form data for existing employee
      setFormData({
        employeeId: employee.employeeId || "",
        name: employee.name || "",
        firstName: employee.firstName || "",
        lastName: employee.lastName || "",
        email: employee.email || "",
        phone: employee.phone || "",
        department: employee.department || "",
        position: employee.position || "",
        rank: employee.rank || "",
        militaryCivilian: employee.militaryCivilian || "",
        hireDate: employee.hireDate || "",
        birthDate: employee.birthDate || "",
        gender: employee.gender || "male",
        address: employee.address || "",
        emergencyContact: employee.emergencyContact || "",
        emergencyPhone: employee.emergencyPhone || "",
        status: employee.status || "active",
        accessLevel: employee.accessLevel || "general",
        permissions: employee.permissions || ["read"],
      });
      
      // Load filtered positions for the militaryCivilian value if editing employee
      if (employee.militaryCivilian) {
        loadFilteredPositions(employee.militaryCivilian)
      }
      
      setSelectedImageFile(null);
      setImagePreview(null);
    } else {
      // Reset form when creating new employee
      // Resetting form data for new employee
      setFormData({
        employeeId: "",
        name: "",
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        department: "",
        position: "",
        rank: "",
        militaryCivilian: "",
        hireDate: "",
        birthDate: "",
        gender: "male",
        address: "",
        emergencyContact: "",
        emergencyPhone: "",
        status: "active",
        accessLevel: "general",
        permissions: ["read"],
      });
      setSelectedPosition(null);
      setSelectedImageFile(null);
      setImagePreview(null);
    }
  }, [employee]);

  // Set selected position when filtered positions are loaded and we have an employee with position
  useEffect(() => {
    if (employee && employee.position && filteredPositions.length > 0) {
      // Try exact match first
      let position = filteredPositions.find(p => p.name === employee.position)
      
      // If no exact match, try case-insensitive match
      if (!position) {
        position = filteredPositions.find(p => 
          p.name.toLowerCase() === employee.position.toLowerCase()
        )
      }
      
      // If still no match, try partial match
      if (!position) {
        position = filteredPositions.find(p => 
          p.name.toLowerCase().includes(employee.position.toLowerCase()) ||
          employee.position.toLowerCase().includes(p.name.toLowerCase())
        )
      }
      
      if (position) {
        const convertedPosition = positionApi.convertToPosition(position)
        setSelectedPosition(convertedPosition)
        console.log('Position synced:', position.name, 'for employee:', employee.position)
      } else {
        console.log('Position not found in filtered positions:', employee.position, 'Available:', filteredPositions.map(p => p.name))
      }
    }
  }, [filteredPositions, employee]);

  const handleInputChange = (field: keyof Employee, value: any) => {
    setFormData((prev) => {
      const newData = { ...prev, [field]: value }
      
      // Auto-generate full name from firstName + lastName
      if (field === 'firstName' || field === 'lastName') {
        const firstName = field === 'firstName' ? value : prev.firstName || ''
        const lastName = field === 'lastName' ? value : prev.lastName || ''
        newData.name = `${firstName} ${lastName}`.trim()
      }
      
      return newData
    })
  }

  const handleSubmit = async () => {
    if (!formData.employeeId || !formData.firstName || !formData.lastName || !formData.position || !formData.department) {
      alert("Vui lòng điền đầy đủ thông tin bắt buộc (ID Quân nhân, Họ, Tên, Chức vụ, Cơ quan đơn vị)")
      return
    }

    try {
      // Save employee data first
      const savedEmployee = await onSave({
        employeeId: formData.employeeId!,
        name: formData.name!,
        firstName: formData.firstName!,
        lastName: formData.lastName!,
        email: formData.email || "",
        phone: formData.phone || "",
        department: formData.department!,
        position: formData.position!,
        rank: formData.rank || "",
        militaryCivilian: formData.militaryCivilian || "",
        hireDate: formData.hireDate || new Date().toISOString().split("T")[0],
        birthDate: formData.birthDate,
        gender: formData.gender,
        address: formData.address,
        emergencyContact: formData.emergencyContact,
        emergencyPhone: formData.emergencyPhone,
        status: formData.status || "active",
        accessLevel: formData.accessLevel || "general",
        permissions: formData.permissions || ["read"],
      });

      // Upload image if selected
      if (selectedImageFile && savedEmployee) {
        await uploadEmployeeImage(savedEmployee.id, selectedImageFile);
      }
      
      onClose()
    } catch (error) {
      console.error("Error saving employee:", error);
      alert("Có lỗi xảy ra khi lưu thông tin nhân viên");
    }
  }

  const uploadEmployeeImage = async (employeeId: string, imageFile: File) => {
    try {
      const { employeeApi } = await import("@/lib/api/employee-api");
      return await employeeApi.uploadEmployeeImage(employeeId, imageFile);
    } catch (error) {
      console.error("Error uploading image:", error);
      throw new Error("Failed to upload image");
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{employee ? "Chỉnh sửa nhân viên" : "Thêm thông tin quân nhân"}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="basic" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="basic">Thông tin cơ bản</TabsTrigger>
            <TabsTrigger value="details">Chi tiết Quân nhân</TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <Label htmlFor="employeeId">ID Quân nhân *</Label>
                <Input
                  id="employeeId"
                  value={formData.employeeId}
                  onChange={(e) => handleInputChange("employeeId", e.target.value)}
                  placeholder="249"
                  disabled={!!employee} // Disable when editing existing employee
                  className={employee ? "bg-gray-100 cursor-not-allowed" : ""}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">Họ *</Label>
                <Input
                  id="firstName"
                  value={formData.firstName}
                  onChange={(e) => handleInputChange("firstName", e.target.value)}
                  placeholder="Họ"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Tên *</Label>
                <Input 
                  id="lastName" 
                  value={formData.lastName} 
                  onChange={(e) => handleInputChange("lastName", e.target.value)} 
                  placeholder="Tên"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Số điện thoại</Label>
                <Input 
                  id="phone" 
                  value={formData.phone} 
                  onChange={(e) => handleInputChange("phone", e.target.value)} 
                  placeholder="Số điện thoại"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input 
                  id="email" 
                  value={formData.email} 
                  onChange={(e) => handleInputChange("email", e.target.value)} 
                  placeholder="Email"
                />
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
                <Label htmlFor="department">Cơ quan, đơn vị *</Label>
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
                <Label htmlFor="hireDate">Ngày nhập ngũ</Label>
                <Input
                  id="hireDate"
                  type="date"
                  value={formData.hireDate}
                  onChange={(e) => handleInputChange("hireDate", e.target.value)}
                />
              </div>
            </div>


            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="militaryCivilian">SQ/QNCN</Label>
                <Select value={formData.militaryCivilian} onValueChange={(value) => {
                  handleInputChange("militaryCivilian", value);
                  // Reset rank and position when changing SQ/QNCN
                  handleInputChange("rank", "");
                  handleInputChange("position", "");
                  setSelectedPosition(null);
                  // Load filtered positions based on SQ/QNCN selection
                  loadFilteredPositions(value);
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="SQ/QNCN" />
                  </SelectTrigger>
                  <SelectContent>
                    {sqQncnOptions.map((option) => (
                      <SelectItem key={option.id} value={option.name}>
                        {option.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="rank">Cấp bậc</Label>
                <Select value={formData.rank} onValueChange={(value) => handleInputChange("rank", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn cấp bậc" />
                  </SelectTrigger>
                  <SelectContent>
                    {formData.militaryCivilian && (formData.militaryCivilian.includes("Sĩ quan") || formData.militaryCivilian === "SQ") && (
                      <>
                        <SelectItem value="Thiếu Uý">Thiếu Uý</SelectItem>
                        <SelectItem value="Trung Uý">Trung Uý</SelectItem>
                        <SelectItem value="Thượng Uý">Thượng Uý</SelectItem>
                        <SelectItem value="Đại Uý">Đại Uý</SelectItem>
                        <SelectItem value="Thiếu Tá">Thiếu Tá</SelectItem>
                        <SelectItem value="Trung Tá">Trung Tá</SelectItem>
                        <SelectItem value="Thượng Tá">Thượng Tá</SelectItem>
                        <SelectItem value="Đại Tá">Đại Tá</SelectItem>
                      </>
                    )}
                    {formData.militaryCivilian && (formData.militaryCivilian.includes("QNCN") || formData.militaryCivilian === "QNCN") && (
                      <>
                        <SelectItem value="Thiếu Uý">Thiếu Uý</SelectItem>
                        <SelectItem value="Trung Uý">Trung Uý</SelectItem>
                        <SelectItem value="Thượng Uý">Thượng Uý</SelectItem>
                        <SelectItem value="Đại Uý">Đại Uý</SelectItem>
                        <SelectItem value="Thiếu Tá">Thiếu Tá</SelectItem>
                        <SelectItem value="Trung Tá">Trung Tá</SelectItem>
                        <SelectItem value="Thượng Tá">Thượng Tá</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <Label htmlFor="jobTitle">Chức vụ *</Label>
                <Select 
                  value={selectedPosition?.id || undefined} 
                  onValueChange={(value) => {
                    const position = filteredPositions.find(p => p.id === value)
                    if (position) {
                      const convertedPosition = positionApi.convertToPosition(position)
                      setSelectedPosition(convertedPosition)
                      handleInputChange("position", position.name)
                    }
                  }}
                  disabled={!formData.militaryCivilian || loadingFilteredPositions}
                >
                  <SelectTrigger>
                    <SelectValue 
                      placeholder={
                        !formData.militaryCivilian 
                          ? "Vui lòng chọn SQ/QNCN trước"
                          : loadingFilteredPositions 
                            ? "Đang tải chức vụ..." 
                            : "Chọn chức vụ"
                      } 
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredPositions.length === 0 && formData.militaryCivilian && !loadingFilteredPositions && (
                      <SelectItem value="no-positions" disabled>
                        Không có chức vụ phù hợp
                      </SelectItem>
                    )}
                    {filteredPositions.map((position) => (
                      <SelectItem key={position.id} value={position.id}>
                        {position.parentName ? `${position.name} - ${position.parentName}` : position.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

          </TabsContent>

          <TabsContent value="details" className="space-y-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="image">Ảnh đại diện</Label>
                <Input
                  id="image"
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      // Store the file for upload and create preview
                      setSelectedImageFile(file);
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        const base64 = event.target?.result as string;
                        setImagePreview(base64);
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                />
                {(imagePreview || formData.avatar) && (
                  <div className="mt-2">
                    <img 
                      src={imagePreview || formData.avatar} 
                      alt="Preview" 
                      className="w-24 h-24 object-cover rounded-lg border"
                    />
                  </div>
                )}
              </div>

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
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Hủy
          </Button>
          <Button onClick={handleSubmit}>{employee ? "Cập nhật" : "Lưu và thêm mới"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
