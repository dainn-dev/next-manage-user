"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Trash2, Edit, Users } from "lucide-react"
import { employeeApi } from "@/lib/api/employee-api"
import { useToast } from "@/hooks/use-toast"

interface BulkOperationsDialogProps {
  isOpen: boolean
  onClose: () => void
  selectedEmployeeIds: string[]
  onSuccess: () => void
}

type BulkOperation = "delete" | "updateStatus" | "updateDepartment"

export function BulkOperationsDialog({
  isOpen,
  onClose,
  selectedEmployeeIds,
  onSuccess,
}: BulkOperationsDialogProps) {
  const [operation, setOperation] = useState<BulkOperation>("delete")
  const [status, setStatus] = useState<string>("")
  const [department, setDepartment] = useState<string>("")
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  const handleSubmit = async () => {
    if (selectedEmployeeIds.length === 0) {
      toast({
        title: "Lỗi",
        description: "Vui lòng chọn ít nhất một nhân viên",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)

    try {
      switch (operation) {
        case "delete":
          await employeeApi.bulkDeleteEmployees(selectedEmployeeIds)
          toast({
            title: "Thành công",
            description: `Đã xóa ${selectedEmployeeIds.length} nhân viên`,
          })
          break

        case "updateStatus":
          if (!status) {
            toast({
              title: "Lỗi",
              description: "Vui lòng chọn trạng thái",
              variant: "destructive",
            })
            return
          }
          await employeeApi.bulkUpdateEmployeeStatus(selectedEmployeeIds, status)
          toast({
            title: "Thành công",
            description: `Đã cập nhật trạng thái cho ${selectedEmployeeIds.length} nhân viên`,
          })
          break

        case "updateDepartment":
          if (!department) {
            toast({
              title: "Lỗi",
              description: "Vui lòng nhập phòng ban",
              variant: "destructive",
            })
            return
          }
          await employeeApi.bulkUpdateEmployeeDepartment(selectedEmployeeIds, department)
          toast({
            title: "Thành công",
            description: `Đã cập nhật phòng ban cho ${selectedEmployeeIds.length} nhân viên`,
          })
          break
      }

      onSuccess()
      onClose()
      resetForm()
    } catch (error) {
      toast({
        title: "Lỗi",
        description: "Có lỗi xảy ra khi thực hiện thao tác",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const resetForm = () => {
    setOperation("delete")
    setStatus("")
    setDepartment("")
  }

  const getOperationTitle = () => {
    switch (operation) {
      case "delete":
        return "Xóa nhân viên"
      case "updateStatus":
        return "Cập nhật trạng thái"
      case "updateDepartment":
        return "Cập nhật phòng ban"
      default:
        return "Thao tác hàng loạt"
    }
  }

  const getOperationDescription = () => {
    const count = selectedEmployeeIds.length
    switch (operation) {
      case "delete":
        return `Bạn có chắc chắn muốn xóa ${count} nhân viên đã chọn? Hành động này không thể hoàn tác.`
      case "updateStatus":
        return `Cập nhật trạng thái cho ${count} nhân viên đã chọn.`
      case "updateDepartment":
        return `Cập nhật phòng ban cho ${count} nhân viên đã chọn.`
      default:
        return `Thực hiện thao tác cho ${count} nhân viên đã chọn.`
    }
  }

  const getOperationIcon = () => {
    switch (operation) {
      case "delete":
        return <Trash2 className="h-4 w-4" />
      case "updateStatus":
      case "updateDepartment":
        return <Edit className="h-4 w-4" />
      default:
        return <Users className="h-4 w-4" />
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {getOperationIcon()}
            {getOperationTitle()}
          </DialogTitle>
          <DialogDescription>
            {getOperationDescription()}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="operation">Thao tác</Label>
            <Select value={operation} onValueChange={(value) => setOperation(value as BulkOperation)}>
              <SelectTrigger>
                <SelectValue placeholder="Chọn thao tác" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="delete">
                  <div className="flex items-center gap-2">
                    <Trash2 className="h-4 w-4" />
                    Xóa nhân viên
                  </div>
                </SelectItem>
                <SelectItem value="updateStatus">
                  <div className="flex items-center gap-2">
                    <Edit className="h-4 w-4" />
                    Cập nhật trạng thái
                  </div>
                </SelectItem>
                <SelectItem value="updateDepartment">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Cập nhật phòng ban
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {operation === "updateStatus" && (
            <div className="grid gap-2">
              <Label htmlFor="status">Trạng thái</Label>
              <Select value={status} onValueChange={setStatus}>
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
          )}

          {operation === "updateDepartment" && (
            <div className="grid gap-2">
              <Label htmlFor="department">Phòng ban</Label>
              <Input
                id="department"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="Nhập tên phòng ban"
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Hủy
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isLoading}
            variant={operation === "delete" ? "destructive" : "default"}
          >
            {isLoading ? "Đang xử lý..." : "Xác nhận"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}