"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { X } from "lucide-react"

interface BulkOperationsDialogProps {
  isOpen: boolean
  onClose: () => void
  onApply: (operation: BulkOperation) => void
  selectedCount: number
}

interface BulkOperation {
  type: "department" | "position" | "status"
  value: string
}

export function BulkOperationsDialog({ isOpen, onClose, onApply, selectedCount }: BulkOperationsDialogProps) {
  const [operationType, setOperationType] = useState<"department" | "position" | "status">("department")
  const [operationValue, setOperationValue] = useState("")

  const handleApply = () => {
    if (operationValue) {
      onApply({
        type: operationType,
        value: operationValue,
      })
      onClose()
    }
  }

  const getOperationOptions = () => {
    switch (operationType) {
      case "department":
        return [
          { value: "department-name", label: "Department Name" },
          { value: "tieu-doan-9", label: "Tiểu Đoàn 9" },
          { value: "khach", label: "Khách" },
          { value: "tieu-doan-7", label: "Tiểu Đoàn 7" },
          { value: "ban-tham-muu", label: "Ban Tham Mưu" },
        ]
      case "position":
        return [
          { value: "manager", label: "Quản lý" },
          { value: "employee", label: "Nhân viên" },
          { value: "supervisor", label: "Giám sát" },
        ]
      case "status":
        return [
          { value: "active", label: "Hoạt động" },
          { value: "inactive", label: "Không hoạt động" },
          { value: "terminated", label: "Đã nghỉ việc" },
        ]
      default:
        return []
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader className="flex flex-row items-center justify-between">
          <DialogTitle>Điều chỉnh hàng loạt</DialogTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>

        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">Áp dụng cho {selectedCount} nhân viên được chọn</div>

          <div className="space-y-2">
            <Label>Loại thao tác</Label>
            <Select
              value={operationType}
              onValueChange={(value: "department" | "position" | "status") => {
                setOperationType(value)
                setOperationValue("")
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="department">Điều chỉnh phòng ban</SelectItem>
                <SelectItem value="position">Đổi chức vụ</SelectItem>
                <SelectItem value="status">Thay đổi trạng thái</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Giá trị mới</Label>
            <Select value={operationValue} onValueChange={setOperationValue}>
              <SelectTrigger>
                <SelectValue placeholder="Chọn giá trị..." />
              </SelectTrigger>
              <SelectContent>
                {getOperationOptions().map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Hủy
          </Button>
          <Button onClick={handleApply} className="bg-green-600 hover:bg-green-700" disabled={!operationValue}>
            Áp dụng
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
