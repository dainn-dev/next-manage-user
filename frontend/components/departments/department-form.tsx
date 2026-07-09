"use client"

import { useState, useEffect } from "react"
import type { Department } from "@/lib/types"
import { useToast } from "@/hooks/use-toast"
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
  onSave: (department: Omit<Department, "id" | "createdAt" | "updatedAt">) => Promise<void>
}

export function DepartmentForm({ department, departments, isOpen, onClose, onSave }: DepartmentFormProps) {
  const [formData, setFormData] = useState<Partial<Department>>({
    name: "",
    description: "",
  })
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    if (isOpen) {
      if (department) {
        setFormData({
          name: department.name || "",
          description: department.description || "",
        })
      } else {
        setFormData({
          name: "",
          description: "",
        })
      }
    }
  }, [isOpen, department])

  const handleInputChange = (field: keyof Department, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async () => {
    if (!formData.name?.trim()) {
      toast({
        title: "Lỗi",
        description: "Tên đơn vị là bắt buộc",
        variant: "destructive",
      })
      return
    }

    setLoading(true)
    try {
      await onSave({
        name: formData.name.trim(),
        description: formData.description?.trim() || "",
      })
    } catch (error) {
      console.error('Error in form submission:', error)
      toast({
        title: "Lỗi",
        description: "Có lỗi xảy ra khi lưu đơn vị",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
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
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Hủy
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "Đang lưu..." : (department ? "Cập nhật" : "Tạo mới")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}