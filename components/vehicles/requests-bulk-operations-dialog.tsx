"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { CheckCircle, XCircle, Clock, Trash2 } from "lucide-react"

interface RequestsBulkOperationsDialogProps {
  isOpen: boolean
  onClose: () => void
  selectedCount: number
  onApply: (operation: BulkOperation) => void
}

interface BulkOperation {
  type: "status" | "export" | "delete"
  status?: "approved" | "rejected"
  notes?: string
  confirmDelete?: boolean
}

export function RequestsBulkOperationsDialog({ 
  isOpen, 
  onClose, 
  selectedCount, 
  onApply 
}: RequestsBulkOperationsDialogProps) {
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
      case "export":
        return "Xuất dữ liệu"
      case "delete":
        return "Xóa yêu cầu"
      default:
        return "Thao tác hàng loạt"
    }
  }

  const getOperationDescription = () => {
    switch (operationType) {
      case "status":
        return `Thay đổi trạng thái của ${selectedCount} yêu cầu được chọn`
      case "export":
        return `Xuất dữ liệu của ${selectedCount} yêu cầu được chọn`
      case "delete":
        return `Xóa ${selectedCount} yêu cầu được chọn (không thể hoàn tác)`
      default:
        return `Thực hiện thao tác trên ${selectedCount} yêu cầu được chọn`
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
                <SelectItem value="export">Xuất dữ liệu</SelectItem>
                <SelectItem value="delete">Xóa yêu cầu</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {operationType === "status" && (
            <div className="space-y-2">
              <Label>Trạng thái mới</Label>
              <RadioGroup
                value={operationData.status}
                onValueChange={(value) => setOperationData({ ...operationData, status: value as BulkOperation["status"] })}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="approved" id="status-approved" />
                  <Label htmlFor="status-approved" className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    Duyệt
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="rejected" id="status-rejected" />
                  <Label htmlFor="status-rejected" className="flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-red-600" />
                    Từ chối
                  </Label>
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
                  Tất cả dữ liệu liên quan đến {selectedCount} yêu cầu sẽ bị xóa vĩnh viễn.
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

          {(operationType === "status") && (
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
            {operationType === "delete" ? (
              <>
                <Trash2 className="h-4 w-4 mr-2" />
                Xóa yêu cầu
              </>
            ) : operationType === "status" ? (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                Áp dụng
              </>
            ) : (
              "Xuất dữ liệu"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
