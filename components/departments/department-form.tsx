"use client"

import { useState } from "react"
import type { Department } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"

interface DepartmentFormProps {
  department?: Department
  departments: Department[]
  isOpen: boolean
  onClose: () => void
  onSave: (department: Omit<Department, "id" | "createdAt" | "updatedAt">) => void
}

export function DepartmentForm({ department, departments, isOpen, onClose, onSave }: DepartmentFormProps) {
  const [formData, setFormData] = useState<Partial<Department>>({
    name: department?.name || "",
    description: department?.description || "",
    parentId: department?.parentId || null,
    managerId: department?.managerId || "",
    employeeCount: department?.employeeCount || 0,
  })

  const handleInputChange = (field: keyof Department, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = () => {
    if (!formData.name) {
      alert("Vui lòng nhập tên bộ phận")
      return
    }

    onSave({
      name: formData.name!,
      description: formData.description || "",
      parentId: formData.parentId,
      managerId: formData.managerId,
      employeeCount: formData.employeeCount || 0,
    })
  }

  // Filter out current department from parent options to prevent circular reference
  const availableParents = departments.filter((dept) => dept.id !== department?.id)

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{department ? "Chỉnh sửa bộ phận" : "Thêm mới bộ phận"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Tên bộ phận *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleInputChange("name", e.target.value)}
              placeholder="Nhập tên bộ phận"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Mô tả</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleInputChange("description", e.target.value)}
              placeholder="Nhập mô tả bộ phận"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="parentId">Bộ phận cha</Label>
            <Select
              value={formData.parentId || null}
              onValueChange={(value) => handleInputChange("parentId", value || null)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Chọn bộ phận cha (tùy chọn)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={null}>Không có bộ phận cha</SelectItem>
                {availableParents.map((dept) => (
                  <SelectItem key={dept.id} value={dept.id}>
                    {dept.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="managerId">Trưởng bộ phận</Label>
            <Input
              id="managerId"
              value={formData.managerId || ""}
              onChange={(e) => handleInputChange("managerId", e.target.value)}
              placeholder="ID trưởng bộ phận"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="employeeCount">Số lượng nhân viên</Label>
            <Input
              id="employeeCount"
              type="number"
              value={formData.employeeCount}
              onChange={(e) => handleInputChange("employeeCount", Number.parseInt(e.target.value) || 0)}
              placeholder="0"
              min="0"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Hủy
          </Button>
          <Button onClick={handleSubmit}>{department ? "Cập nhật" : "Tạo mới"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
