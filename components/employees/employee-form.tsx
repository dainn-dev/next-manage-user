"use client"

import { useState, useEffect, useCallback } from "react"
import { useToast } from "@/hooks/use-toast"
import type { Employee, Department, Position } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { positionApi, type PositionApiResponse } from "@/lib/api/position-api"
import { X } from "lucide-react"

interface EmployeeFormProps {
  employee?: Employee
  departments: Department[]
  isOpen: boolean
  onClose: () => void
  onSave: (employee: Omit<Employee, "id" | "createdAt" | "updatedAt">) => Promise<Employee>
}

export function EmployeeForm({ employee, departments, isOpen, onClose, onSave }: EmployeeFormProps) {
  const { toast } = useToast()
  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null)
  const [sqQncnOptions, setSqQncnOptions] = useState<PositionApiResponse[]>([])
  const [filteredPositions, setFilteredPositions] = useState<PositionApiResponse[]>([])
  const [loadingFilteredPositions, setLoadingFilteredPositions] = useState(false)
  const [formData, setFormData] = useState<Partial<Employee>>({
    employeeId: employee?.employeeId || "",
    name: employee?.name || "",
    email: employee?.email || "",
    phone: employee?.phone || "",
    department: employee?.department || "",
    position: employee?.position || "",
    positionId: employee?.positionId || "",
    rank: employee?.rank || "",
    militaryCivilian: employee?.militaryCivilian || "",
    hireDate: employee?.hireDate || "",
    birthDate: employee?.birthDate || "",
    gender: employee?.gender || "male",
    address: employee?.address || "",
    emergencyContact: employee?.emergencyContact || "",
    emergencyPhone: employee?.emergencyPhone || "",
    status: employee?.status || "HOAT_DONG",
    accessLevel: employee?.accessLevel || "general",
    permissions: employee?.permissions || ["read"],
    avatar: employee?.avatar || "",
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


  const loadFilteredPositions = useCallback(async (sqQncnSelection: string) => {
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
  }, [sqQncnOptions])



  // Sync form data when employee prop changes
  useEffect(() => {
    // Employee prop changed
    if (employee) {
      console.log("Employee data received:", employee);
      console.log("Employee avatar:", employee.avatar);
      
      // Setting form data for existing employee
      setFormData({
        employeeId: employee.employeeId || "",
        name: employee.name || "",
        email: employee.email || "",
        phone: employee.phone || "",
        department: employee.department || "",
        position: employee.position || "",
        positionId: employee.positionId || "",
        rank: employee.rank || "",
        militaryCivilian: employee.militaryCivilian || "",
        hireDate: employee.hireDate || "",
        birthDate: employee.birthDate || "",
        gender: employee.gender || "male",
        address: employee.address || "",
        emergencyContact: employee.emergencyContact || "",
        emergencyPhone: employee.emergencyPhone || "",
        status: employee.status || "HOAT_DONG",
        accessLevel: employee.accessLevel || "general",
        permissions: employee.permissions || ["read"],
        avatar: employee.avatar || "",
      });
      
      // Note: Filtered positions will be loaded by useEffect when sqQncnOptions are ready
      
      // Set image preview for existing employee
      if (employee.avatar) {
        const fullImageUrl = getFullImageUrl(employee.avatar);
        console.log("Setting image preview with URL:", fullImageUrl);
        setImagePreview(fullImageUrl);
      } else {
        console.log("No avatar found for employee, setting imagePreview to null");
        setImagePreview(null);
      }
      setSelectedImageFile(null);
    } else {
      // Reset form when creating new employee
      // Resetting form data for new employee
      setFormData({
        employeeId: "",
        name: "",
        email: "",
        phone: "",
        department: "",
        position: "",
        positionId: "",
        rank: "",
        militaryCivilian: "",
        hireDate: "",
        birthDate: "",
        gender: "male",
        address: "",
        emergencyContact: "",
        emergencyPhone: "",
        status: "HOAT_DONG",
        accessLevel: "general",
        permissions: ["read"],
        avatar: "",
      });
      setSelectedPosition(null);
      setSelectedImageFile(null);
      setImagePreview(null);
    }
  }, [employee]);

  // Load filtered positions when sqQncnOptions are loaded and we have an employee with militaryCivilian
  useEffect(() => {
    if (employee && employee.militaryCivilian && sqQncnOptions.length > 0) {
      loadFilteredPositions(employee.militaryCivilian)
    }
  }, [sqQncnOptions, employee, loadFilteredPositions]);

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
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async () => {
    if (!formData.employeeId || !formData.name || !formData.position || !formData.department) {
      alert("Vui lòng điền đầy đủ thông tin bắt buộc (ID Quân nhân, Họ và Tên, Chức vụ, Cơ quan đơn vị)")
      return
    }


    try {
      // Debug: Log the data being sent
      const employeeData = {
        employeeId: formData.employeeId!,
        name: formData.name!,
        email: formData.email || "",
        phone: formData.phone || "",
        department: formData.department!,
        position: formData.position!,
        positionId: formData.positionId || "",
        rank: formData.rank || "",
        militaryCivilian: formData.militaryCivilian || "",
        hireDate: formData.hireDate || new Date().toISOString().split("T")[0],
        birthDate: formData.birthDate,
        gender: formData.gender,
        address: formData.address,
        emergencyContact: formData.emergencyContact,
        emergencyPhone: formData.emergencyPhone,
        status: formData.status || "HOAT_DONG",
        accessLevel: formData.accessLevel || "general",
        permissions: formData.permissions || ["read"],
      };
      
      console.log("🚀 Sending employee data to backend:", employeeData);
      console.log("🚀 Department being sent:", employeeData.department);
      
      // Save employee data first
      const savedEmployee = await onSave(employeeData);

      // Upload image if selected
      if (selectedImageFile && savedEmployee) {
        try {
          await uploadEmployeeImage(savedEmployee.id, selectedImageFile);
        } catch (imageError) {
          console.error("Error uploading image:", imageError);
          toast({
            title: "Cảnh báo",
            description: "Nhân viên đã được lưu nhưng có lỗi khi tải lên ảnh",
            variant: "destructive",
          });
        }
      }
      
      onClose()
    } catch (error) {
      console.error("Error saving employee:", error);
      toast({
        title: "Lỗi",
        description: "Có lỗi xảy ra khi lưu thông tin nhân viên",
        variant: "destructive",
      });
    }
  }

  const uploadEmployeeImage = async (employeeId: string, imageFile: File) => {
    try {
      console.log("Starting image upload for employee:", employeeId);
      console.log("Image file details:", {
        name: imageFile.name,
        size: imageFile.size,
        type: imageFile.type
      });
      
      const { employeeApi } = await import("@/lib/api/employee-api");
      const result = await employeeApi.uploadEmployeeImage(employeeId, imageFile);
      
      console.log("Image upload successful:", result);
      return result;
    } catch (error) {
      console.error("Detailed error uploading image:", error);
      console.error("Error type:", typeof error);
      console.error("Error message:", error instanceof Error ? error.message : String(error));
      
      // Re-throw with more specific error message
      throw new Error(`Không thể tải lên ảnh: ${error instanceof Error ? error.message : 'Lỗi không xác định'}`);
    }
  }

  const clearSelectedImage = () => {
    setSelectedImageFile(null);
    setImagePreview(null);
    // Clear the file input
    const fileInput = document.getElementById('image') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  }

  const getFullImageUrl = (imagePath: string) => {
    console.log("getFullImageUrl called with:", imagePath);
    if (!imagePath) {
      console.log("No image path provided, returning empty string");
      return '';
    }
    if (imagePath.startsWith('http')) {
      console.log("Image path is already a full URL, returning as-is");
      return imagePath;
    }
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
    const fullUrl = `${backendUrl}${imagePath}`;
    console.log("Constructed full URL:", fullUrl);
    return fullUrl;
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

            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Họ và Tên *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleInputChange("name", e.target.value)}
                  placeholder="Nhập họ và tên đầy đủ"
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
                <Select value={formData.department} onValueChange={(value) => {
                  console.log("🔍 Department selection triggered with value:", value);
                  console.log("🔍 Available departments:", departments.map(d => d.name));
                  
                  const selectedDept = departments.find(dept => dept.name === value);
                  console.log("🔍 Found selected department:", selectedDept);
                  
                  if (selectedDept) {
                    handleInputChange("department", value);
                    console.log("✅ Selected department:", selectedDept.name);
                  } else {
                    console.error("❌ Department not found:", value);
                    toast({
                      title: "Lỗi",
                      description: "Không tìm thấy đơn vị được chọn. Vui lòng thử lại.",
                      variant: "destructive",
                    });
                  }
                }}>
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
                <Label htmlFor="status">Trạng thái</Label>
                <Select value={formData.status} onValueChange={(value) => handleInputChange("status", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn trạng thái" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="HOAT_DONG">Hoạt động</SelectItem>
                    <SelectItem value="TRANH_THU">Tranh thủ</SelectItem>
                    <SelectItem value="PHEP">Phép</SelectItem>
                    <SelectItem value="LY_DO_KHAC">Lý do Khác</SelectItem>
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
                  handleInputChange("positionId", "");
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
                    if (value === "no-positions") return
                    const position = filteredPositions.find(p => p.id === value)
                    if (position) {
                      const convertedPosition = positionApi.convertToPosition(position)
                      setSelectedPosition(convertedPosition)
                      handleInputChange("position", position.name)
                      handleInputChange("positionId", position.id)
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
                {!imagePreview && !formData.avatar && (
                  <div className="mt-2 p-4 border-2 border-dashed border-gray-300 rounded-lg text-center">
                    <p className="text-gray-500 text-sm">Chưa có ảnh đại diện</p>
                    <p className="text-xs text-gray-400 mt-1">Chọn ảnh từ máy tính của bạn</p>
                  </div>
                )}
                {(imagePreview || formData.avatar) && (
                  <div className="mt-2 space-y-2">
                    <Label className="text-sm text-gray-600">Xem trước ảnh:</Label>
                    <div className="relative inline-block">
                      <img 
                        src={imagePreview || getFullImageUrl(formData.avatar || '')} 
                        alt="Preview" 
                        className="w-32 h-32 object-cover rounded-lg border shadow-sm"
                      />
                      {selectedImageFile && (
                        <div className="absolute -top-2 -right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full">
                          Mới
                        </div>
                      )}
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="absolute -top-2 -left-2 w-6 h-6 p-0 rounded-full"
                        onClick={clearSelectedImage}
                        title="Xóa ảnh đã chọn"
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                    <p className="text-xs text-gray-500">
                      {selectedImageFile 
                        ? `Ảnh mới: ${selectedImageFile.name}` 
                        : (formData.avatar || employee?.avatar)
                          ? "Ảnh hiện tại từ hệ thống" 
                          : "Không có ảnh"
                      }
                    </p>
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
