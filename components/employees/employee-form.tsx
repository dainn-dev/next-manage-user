"use client"

import { useState, useEffect } from "react"
import type { Employee, Department, Position } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { dataService } from "@/lib/data-service"
import { ChevronDown } from "lucide-react"

interface EmployeeFormProps {
  employee?: Employee
  departments: Department[]
  isOpen: boolean
  onClose: () => void
  onSave: (employee: Omit<Employee, "id" | "createdAt" | "updatedAt">) => Promise<Employee>
}

export function EmployeeForm({ employee, departments, isOpen, onClose, onSave }: EmployeeFormProps) {
  const [positions, setPositions] = useState<Position[]>([])
  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null)
  const [showPositionDropdown, setShowPositionDropdown] = useState(false)
  const [formData, setFormData] = useState<Partial<Employee & { location?: string }>>({
    employeeId: employee?.employeeId || "",
    name: employee?.name || "",
    firstName: employee?.firstName || "",
    lastName: employee?.lastName || "",
    email: employee?.email || "",
    phone: employee?.phone || "",
    department: employee?.department || "",
    position: employee?.position || "",
    rank: employee?.rank || "",
    jobTitle: employee?.jobTitle || "",
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
    location: "",
  })

  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Load positions when component mounts
  useEffect(() => {
    if (isOpen) {
      loadPositions()
    }
  }, [isOpen])

  const loadPositions = async () => {
    try {
      const positionData = await dataService.getPositions()
      setPositions(positionData)
    } catch (error) {
      console.error("Error loading positions:", error)
    }
  }

  // Create hierarchical position structure
  const buildPositionHierarchy = () => {
    const hierarchy: any[] = []
    const positionMap = new Map()
    
    // Create map of all positions
    positions.forEach(pos => {
      positionMap.set(pos.id, { ...pos, children: [] })
    })
    
    // Build hierarchy
    positions.forEach(pos => {
      if (pos.parentId) {
        const parent = positionMap.get(pos.parentId)
        if (parent) {
          parent.children.push(positionMap.get(pos.id))
        }
      } else {
        hierarchy.push(positionMap.get(pos.id))
      }
    })
    
    return hierarchy
  }

  const getPositionPath = (position: Position): string => {
    const path: string[] = []
    let current = position
    
    // Build path from current position to root
    while (current) {
      path.unshift(current.name)
      if (current.parentId) {
        current = positions.find(p => p.id === current.parentId) as Position
      } else {
        break
      }
    }
    
    return path.join(" > ")
  }

  const renderPositionOption = (position: Position, level = 0, parentPath = "") => {
    // Create indentation for hierarchy
    const indent = "  ".repeat(level)
    
    // Different styling based on level
    const getLevelStyling = () => {
      switch (level) {
        case 0:
          return "font-bold text-gray-900"
        case 1:
          return "font-semibold text-gray-800"
        case 2:
          return "font-medium text-gray-700"
        default:
          return "text-gray-600"
      }
    }
    
    const getIcon = () => {
      switch (level) {
        case 0:
          return "📋"
        case 1:
          return position.name === "Sĩ quan" ? "🎖️" : "🛡️"
        case 2:
          return "▪️"
        default:
          return "◦"
      }
    }
    
    return (
      <SelectItem 
        key={position.id} 
        value={position.id} 
        className={`${getLevelStyling()} hover:bg-blue-50 transition-colors`}
      >
        {getIcon()} {indent}{position.name}
        {position.levelDisplayName && level > 1 && (
          <span className="text-xs text-gray-500 ml-2">({position.levelDisplayName})</span>
        )}
      </SelectItem>
    )
  }

  const renderPositionHierarchy = (positions: any[], level = 0, parentPath = ""): any[] => {
    const items: any[] = []
    
    // Sort positions by display order
    const sortedPositions = [...positions].sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0))
    
    sortedPositions.forEach(pos => {
      const currentPath = parentPath ? `${parentPath} > ${pos.name}` : pos.name
      items.push(renderPositionOption(pos, level, parentPath))
      
      if (pos.children && pos.children.length > 0) {
        items.push(...renderPositionHierarchy(pos.children, level + 1, currentPath))
      }
    })
    return items
  }

  // Filter positions based on militaryCivilian selection
  const getFilteredPositions = () => {
    if (!formData.militaryCivilian) {
      return buildPositionHierarchy()
    }
    
    const hierarchy = buildPositionHierarchy()
    const chucVuRoot = hierarchy.find(p => p.name === "Chức vụ")
    
    if (!chucVuRoot || !chucVuRoot.children) {
      return hierarchy
    }
    
    if (formData.militaryCivilian === "SQ") {
      // Show only Sĩ quan branch
      const siQuanBranch = chucVuRoot.children.find((c: any) => c.name === "Sĩ quan")
      return siQuanBranch ? [siQuanBranch] : []
    } else if (formData.militaryCivilian === "QNCN") {
      // Show only QNCN branch  
      const qncnBranch = chucVuRoot.children.find((c: any) => c.name === "QNCN")
      return qncnBranch ? [qncnBranch] : []
    }
    
    return chucVuRoot.children
  }

  // Sync form data when employee prop changes
  useEffect(() => {
    console.log('EmployeeForm: employee prop changed', employee?.id, employee?.name);
    if (employee) {
      console.log('EmployeeForm: Setting form data for employee', employee.employeeId, employee.name);
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
        jobTitle: employee.jobTitle || "",
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
        location: employee.location || "",
      });
      
      // Set selected position if editing employee
      if (employee.jobTitle) {
        const position = positions.find(p => p.name === employee.jobTitle)
        setSelectedPosition(position || null)
      }
      
      setSelectedImageFile(null);
      setImagePreview(null);
    } else {
      // Reset form when creating new employee
      console.log('EmployeeForm: Resetting form data for new employee');
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
        jobTitle: "",
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
        location: "",
      });
      setSelectedPosition(null);
      setSelectedImageFile(null);
      setImagePreview(null);
    }
  }, [employee]);

  const handleInputChange = (field: keyof (Employee & { location?: string }), value: any) => {
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
    if (!formData.employeeId || !formData.firstName || !formData.lastName || !formData.jobTitle || !formData.department) {
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
        jobTitle: formData.jobTitle || "",
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
                  handleInputChange("jobTitle", "");
                  handleInputChange("position", "");
                  setSelectedPosition(null);
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="SQ/QNCN" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SQ">Sĩ quan</SelectItem>
                    <SelectItem value="QNCN">QNCN</SelectItem>
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
                    {formData.militaryCivilian === "SQ" && (
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
                    {formData.militaryCivilian === "QNCN" && (
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

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="jobTitle">Chức vụ *</Label>
                <Select 
                  value={selectedPosition?.id || ""} 
                  onValueChange={(value) => {
                    if (value === "no-selection") return
                    
                    const position = positions.find(p => p.id === value)
                    setSelectedPosition(position || null)
                    handleInputChange("jobTitle", position?.name || "")
                    handleInputChange("position", position?.name || "")
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn chức vụ" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {formData.militaryCivilian ? (
                      <>
                        {formData.militaryCivilian === "SQ" && (
                          <div className="px-2 py-1 text-xs font-semibold text-red-600 bg-red-50 border-b">
                            Chức vụ Sĩ quan
                          </div>
                        )}
                        {formData.militaryCivilian === "QNCN" && (
                          <div className="px-2 py-1 text-xs font-semibold text-blue-600 bg-blue-50 border-b">
                            Chức vụ QNCN
                          </div>
                        )}
                        {renderPositionHierarchy(getFilteredPositions())}
                      </>
                    ) : (
                      <>
                        <div className="px-2 py-1 text-xs font-medium text-gray-500 bg-gray-50 border-b">
                          Vui lòng chọn SQ/QNCN trước
                        </div>
                        <SelectItem value="no-selection" disabled>
                          Chọn SQ hoặc QNCN để xem chức vụ
                        </SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="location">Vị trí</Label>
                <Input
                  id="location"
                  value={formData.location}
                  onChange={(e) => handleInputChange("location", e.target.value)}
                  placeholder="Nhập vị trí làm việc"
                />
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
