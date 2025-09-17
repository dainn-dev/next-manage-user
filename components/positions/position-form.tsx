"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import type { Position } from "@/lib/types"
import { dataService } from "@/lib/data-service"
import { useToast } from "@/hooks/use-toast"

interface PositionFormProps {
  isOpen: boolean
  onClose: () => void
  onSave: (position: Position) => Promise<void>
  position?: Position | null
  mode: "create" | "edit"
}

export function PositionForm({ isOpen, onClose, onSave, position, mode }: PositionFormProps) {
  const [formData, setFormData] = useState({
    positionName: "",
    parentPositionCode: "",
    description: "",
  })
  const [availablePositions, setAvailablePositions] = useState<Position[]>([])
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    if (isOpen) {
      // Load available parent positions
      loadAvailablePositions()

      if (mode === "edit" && position) {
        setFormData({
          positionName: position.name,
          parentPositionCode: position.parentId || "",
          description: position.description || "",
        })
      } else {
        setFormData({
          positionName: "",
          parentPositionCode: "",
          description: "",
        })
      }
    }
  }, [isOpen, mode, position])

  const loadAvailablePositions = async () => {
    try {
      const positions = await dataService.getPositions()
      setAvailablePositions(positions.filter(p => p.isActive))
    } catch (error) {
      console.error("Error loading available positions:", error)
    }
  }


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const parentPosition = formData.parentPositionCode 
        ? availablePositions.find(p => p.id === formData.parentPositionCode)
        : null

      const positionData: Position = {
        id: mode === "edit" ? position?.id || "" : "",
        name: formData.positionName,
        description: formData.description || "",
        parentId: formData.parentPositionCode || undefined,
        parentName: parentPosition?.name,
        isActive: true,
        displayOrder: 0,
        childrenCount: mode === "edit" ? position?.childrenCount || 0 : 0,
        createdAt: mode === "edit" ? position?.createdAt || "" : "",
        updatedAt: mode === "edit" ? position?.updatedAt || "" : "",
      }

      await onSave(positionData)

      onClose()
    } catch (error) {
      console.error("Error saving position:", error)
      toast({
        title: "Lỗi",
        description: "Có lỗi xảy ra khi lưu chức vụ",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }


  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Thêm chức vụ mới" : "Chỉnh sửa chức vụ"}
          </DialogTitle>
          <DialogDescription>
            {mode === "create" 
              ? "Nhập thông tin để tạo chức vụ mới trong hệ thống"
              : "Cập nhật thông tin chức vụ"
            }
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="positionName">Tên chức vụ *</Label>
            <Input
              id="positionName"
              value={formData.positionName}
              onChange={(e) => handleInputChange("positionName", e.target.value)}
              placeholder="VD: Tư lệnh, Phó Tư lệnh, Trưởng phòng..."
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="parentPosition">Chức vụ cấp cao</Label>
            <Select
              value={formData.parentPositionCode || undefined}
              onValueChange={(value) => handleInputChange("parentPositionCode", value === "NONE" ? "" : value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Chọn chức vụ cấp cao (tùy chọn)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NONE">Không có chức vụ cấp cao</SelectItem>
                {availablePositions.map((pos) => (
                  <SelectItem key={pos.id} value={pos.id}>
                    {pos.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Mô tả</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleInputChange("description", e.target.value)}
              placeholder="Mô tả chi tiết về chức vụ, nhiệm vụ và trách nhiệm..."
              rows={4}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Hủy
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Đang lưu..." : mode === "create" ? "Tạo mới" : "Cập nhật"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
