"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"

interface BulkOperationsDialogProps {
  isOpen: boolean
  onClose: () => void
  selectedCount: number
  onApply: (operation: BulkOperation) => void
}

interface BulkOperation {
  type: "status" | "department" | "access" | "export" | "delete"
  status?: "active" | "inactive" | "maintenance" | "retired"
  department?: string
  accessLevel?: "general" | "restricted" | "admin"
  notes?: string
  confirmDelete?: boolean
}

export function BulkOperationsDialog({ isOpen, onClose, selectedCount, onApply }: BulkOperationsDialogProps) {
  const [operationType, setOperationType] = useState<BulkOperation["type"]>("status")
  const [operationData, setOperationData] = useState<Partial<BulkOperation>>({})
  const [confirmDelete, setConfirmDelete] = useState(false)

  const handleApply = () => {
    if (operationType === "delete" && !confirmDelete) {
      alert("Vui lòng xác nhận xóa")
      return
    }

    onApply({
      type: operationType,
      ...operationData,
      confirmDelete
    } as BulkOperation)
    onClose()
  }

  const getOperationTitle = () => {
    switch (operationType) {
      case "status":
        return "Thay đổi trạng thái"
      case "department":
        return "Thay đổi Cơ quan, đơn vị"
      case "access":
        return "Thay đổi quyền truy cập"
      case "export":
        return "Xuất dữ liệu"
      case "delete":
        return "Xóa xe"
      default:
        return "Thao tác hàng loạt"
    }
  }

  const getOperationDescription = () => {
    switch (operationType) {
      case "status":
        return `Thay đổi trạng thái của ${selectedCount} xe được chọn`
      case "department":
        return `Thay đổi Cơ quan, đơn vị của ${selectedCount} xe được chọn`
      case "access":
        return `Thay đổi quyền truy cập của ${selectedCount} xe được chọn`
      case "export":
        return `Xuất dữ liệu của ${selectedCount} xe được chọn`
      case "delete":
        return `Xóa ${selectedCount} xe được chọn (không thể hoàn tác)`
      default:
        return `Thực hiện thao tác trên ${selectedCount} xe được chọn`
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{getOperationTitle()}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{getOperationDescription()}</p>

          <div className="space-y-2">
            <Label>Loại thao tác</Label>
            <Select value={operationType} onValueChange={(value) => setOperationType(value as BulkOperation["type"])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="status">Thay đổi trạng thái</SelectItem>
                <SelectItem value="department">Thay đổi Cơ quan, đơn vị</SelectItem>
                <SelectItem value="access">Thay đổi quyền truy cập</SelectItem>
                <SelectItem value="export">Xuất dữ liệu</SelectItem>
                <SelectItem value="delete">Xóa xe</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {operationType === "status" && (
            <div className="space-y-2">
              <Label>Trạng thái mới</Label>
              <Select
                value={operationData.status}
                onValueChange={(value) => setOperationData({ ...operationData, status: value as BulkOperation["status"] })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Chọn trạng thái" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Hoạt động</SelectItem>
                  <SelectItem value="inactive">Không hoạt động</SelectItem>
                  <SelectItem value="maintenance">Bảo trì</SelectItem>
                  <SelectItem value="retired">Đã nghỉ hưu</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {operationType === "department" && (
            <div className="space-y-2">
              <Label>Cơ quan, đơn vị mới</Label>
              <Select
                value={operationData.department}
                onValueChange={(value) => setOperationData({ ...operationData, department: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Chọn Cơ quan, đơn vị" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="IT">Công nghệ thông tin</SelectItem>
                  <SelectItem value="HR">Quân nhân</SelectItem>
                  <SelectItem value="Finance">Tài chính</SelectItem>
                  <SelectItem value="Operations">Vận hành</SelectItem>
                  <SelectItem value="Marketing">Marketing</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {operationType === "access" && (
            <div className="space-y-2">
              <Label>Quyền truy cập mới</Label>
              <RadioGroup
                value={operationData.accessLevel}
                onValueChange={(value) => setOperationData({ ...operationData, accessLevel: value as BulkOperation["accessLevel"] })}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="general" id="access-general" />
                  <Label htmlFor="access-general">Chung</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="restricted" id="access-restricted" />
                  <Label htmlFor="access-restricted">Hạn chế</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="admin" id="access-admin" />
                  <Label htmlFor="access-admin">Quản trị</Label>
                </div>
              </RadioGroup>
            </div>
          )}

          {operationType === "export" && (
            <div className="space-y-2">
              <Label>Định dạng xuất</Label>
              <RadioGroup defaultValue="excel">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="excel" id="export-excel" />
                  <Label htmlFor="export-excel">Excel (.xlsx)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="csv" id="export-csv" />
                  <Label htmlFor="export-csv">CSV (.csv)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="pdf" id="export-pdf" />
                  <Label htmlFor="export-pdf">PDF (.pdf)</Label>
                </div>
              </RadioGroup>
            </div>
          )}

          {operationType === "delete" && (
            <div className="space-y-3">
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                <p className="text-sm text-destructive font-medium">
                  ⚠️ Cảnh báo: Thao tác này không thể hoàn tác
                </p>
                <p className="text-xs text-destructive/80 mt-1">
                  Tất cả dữ liệu liên quan đến {selectedCount} xe sẽ bị xóa vĩnh viễn.
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="confirm-delete"
                  checked={confirmDelete}
                  onCheckedChange={setConfirmDelete}
                />
                <Label htmlFor="confirm-delete" className="text-sm">
                  Tôi hiểu rằng thao tác này không thể hoàn tác
                </Label>
              </div>
            </div>
          )}

          {(operationType === "status" || operationType === "department" || operationType === "access") && (
            <div className="space-y-2">
              <Label htmlFor="notes">Ghi chú (tùy chọn)</Label>
              <Textarea
                id="notes"
                value={operationData.notes || ""}
                onChange={(e) => setOperationData({ ...operationData, notes: e.target.value })}
                placeholder="Ghi chú về thao tác này..."
                rows={3}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Hủy
          </Button>
          <Button
            onClick={handleApply}
            variant={operationType === "delete" ? "destructive" : "default"}
            disabled={operationType === "delete" && !confirmDelete}
          >
            {operationType === "delete" ? "Xóa xe" : "Áp dụng"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
