"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import type { Position } from "@/lib/types"
import { PositionLevel } from "@/lib/types"
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
    positionCode: "",
    positionName: "",
    parentPositionCode: "",
    description: "",
    level: 2, // Default to JUNIOR
    minSalary: undefined as number | undefined,
    maxSalary: undefined as number | undefined,
    displayOrder: 0,
    isActive: true,
    employeeCount: 0,
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
          positionCode: position.id,
          positionName: position.name,
          parentPositionCode: position.parentId || "",
          description: position.description || "",
          level: getLevelNumber(position.level),
          minSalary: position.minSalary,
          maxSalary: position.maxSalary,
          displayOrder: position.displayOrder,
          isActive: position.isActive,
          employeeCount: position.childrenCount || 0,
        })
      } else {
        setFormData({
          positionCode: "",
          positionName: "",
          parentPositionCode: "",
          description: "",
          level: 2, // Default to JUNIOR
          minSalary: undefined,
          maxSalary: undefined,
          displayOrder: 0,
          isActive: true,
          employeeCount: 0,
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

  const getLevelNumber = (level: string): number => {
    const levelMap = {
      'INTERN': 1,
      'JUNIOR': 2,
      'SENIOR': 3,
      'LEAD': 4,
      'MANAGER': 5,
      'DIRECTOR': 6,
      'EXECUTIVE': 7,
    }
    return levelMap[level as keyof typeof levelMap] || 2
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
        level: getLevelFromNumber(formData.level),
        levelDisplayName: getLevelDisplayName(formData.level),
        minSalary: formData.minSalary || undefined,
        maxSalary: formData.maxSalary || undefined,
        isActive: formData.isActive,
        displayOrder: formData.displayOrder || 0,
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

  const getLevelFromNumber = (levelNum: number): PositionLevel => {
    const levelMap = {
      1: PositionLevel.INTERN,
      2: PositionLevel.JUNIOR,
      3: PositionLevel.SENIOR,
      4: PositionLevel.LEAD,
      5: PositionLevel.MANAGER,
      6: PositionLevel.DIRECTOR,
      7: PositionLevel.EXECUTIVE,
    }
    return levelMap[levelNum as keyof typeof levelMap] || PositionLevel.JUNIOR
  }

  const getLevelDisplayName = (levelNum: number): string => {
    const displayNames = {
      1: 'Thực tập sinh',
      2: 'Nhân viên',
      3: 'Nhân viên cao cấp',
      4: 'Trưởng nhóm',
      5: 'Quản lý',
      6: 'Giám đốc',
      7: 'Điều hành',
    }
    return displayNames[levelNum as keyof typeof displayNames] || 'Nhân viên'
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
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="positionCode">Mã chức vụ *</Label>
              <Input
                id="positionCode"
                value={formData.positionCode}
                onChange={(e) => handleInputChange("positionCode", e.target.value)}
                placeholder="VD: CV001"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="positionName">Tên chức vụ *</Label>
              <Input
                id="positionName"
                value={formData.positionName}
                onChange={(e) => handleInputChange("positionName", e.target.value)}
                placeholder="VD: Tư lệnh"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="parentPosition">Chức vụ cấp cao</Label>
              <Select
                value={formData.parentPositionCode || undefined}
                onValueChange={(value) => handleInputChange("parentPositionCode", value === "NONE" ? "" : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Chọn chức vụ cấp cao" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">Không có</SelectItem>
                  {availablePositions.map((pos) => (
                    <SelectItem key={pos.id} value={pos.id}>
                      {pos.name} - {pos.levelDisplayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="level">Cấp độ</Label>
              <Input
                id="level"
                type="number"
                min="1"
                max="10"
                value={formData.level}
                onChange={(e) => handleInputChange("level", parseInt(e.target.value) || 1)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Mô tả</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleInputChange("description", e.target.value)}
              placeholder="Mô tả chi tiết về chức vụ..."
              rows={3}
            />
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="isActive"
              checked={formData.isActive}
              onCheckedChange={(checked: boolean) => handleInputChange("isActive", checked)}
            />
            <Label htmlFor="isActive">Chức vụ đang hoạt động</Label>
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
