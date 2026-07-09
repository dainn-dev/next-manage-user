"use client"

import { useState } from "react"
import { UserRole, UserStatus } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Shield, UserCheck, UserX, Lock, Unlock, Trash2, AlertTriangle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface BulkOperationsDialogProps {
  isOpen: boolean
  onClose: () => void
  selectedUsers: string[]
  onBulkUpdateStatus: (userIds: string[], status: UserStatus) => Promise<void>
  onBulkUpdateRole: (userIds: string[], role: UserRole) => Promise<void>
  onBulkDelete: (userIds: string[]) => Promise<void>
}

export function BulkOperationsDialog({
  isOpen,
  onClose,
  selectedUsers,
  onBulkUpdateStatus,
  onBulkUpdateRole,
  onBulkDelete,
}: BulkOperationsDialogProps) {
  const [operation, setOperation] = useState<string>("")
  const [selectedStatus, setSelectedStatus] = useState<UserStatus>(UserStatus.ACTIVE)
  const [selectedRole, setSelectedRole] = useState<UserRole>(UserRole.USER)
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  const handleSubmit = async () => {
    if (!operation) {
      toast({
        title: "Lỗi",
        description: "Vui lòng chọn thao tác",
        variant: "destructive",
      })
      return
    }

    try {
      setIsLoading(true)

      switch (operation) {
        case "update-status":
          await onBulkUpdateStatus(selectedUsers, selectedStatus)
          toast({
            title: "Thành công",
            description: `Đã cập nhật trạng thái cho ${selectedUsers.length} người dùng`,
          })
          break

        case "update-role":
          await onBulkUpdateRole(selectedUsers, selectedRole)
          toast({
            title: "Thành công",
            description: `Đã cập nhật vai trò cho ${selectedUsers.length} người dùng`,
          })
          break

        case "delete":
          await onBulkDelete(selectedUsers)
          toast({
            title: "Thành công",
            description: `Đã xóa ${selectedUsers.length} người dùng`,
          })
          break

        default:
          throw new Error("Thao tác không hợp lệ")
      }

      onClose()
      resetForm()
    } catch (error) {
      toast({
        title: "Lỗi",
        description: error instanceof Error ? error.message : "Có lỗi xảy ra",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const resetForm = () => {
    setOperation("")
    setSelectedStatus(UserStatus.ACTIVE)
    setSelectedRole(UserRole.USER)
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }

  const getOperationIcon = (op: string) => {
    switch (op) {
      case "update-status":
        return <UserCheck className="h-4 w-4" />
      case "update-role":
        return <Shield className="h-4 w-4" />
      case "delete":
        return <Trash2 className="h-4 w-4" />
      default:
        return null
    }
  }

  const getOperationTitle = (op: string) => {
    switch (op) {
      case "update-status":
        return "Cập nhật trạng thái"
      case "update-role":
        return "Cập nhật vai trò"
      case "delete":
        return "Xóa người dùng"
      default:
        return ""
    }
  }

  const getStatusLabel = (status: UserStatus) => {
    switch (status) {
      case UserStatus.ACTIVE:
        return "Hoạt động"
      case UserStatus.INACTIVE:
        return "Không hoạt động"
      case UserStatus.LOCKED:
        return "Bị khóa"
      case UserStatus.SUSPENDED:
        return "Tạm khóa"
      default:
        return status
    }
  }

  const getRoleLabel = (role: UserRole) => {
    switch (role) {
      case UserRole.ADMIN:
        return "Quản trị viên"
      case UserRole.USER:
        return "Người dùng"
      default:
        return role
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Thao tác hàng loạt</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            Đã chọn {selectedUsers.length} người dùng
          </div>

          <div className="space-y-2">
            <Label>Chọn thao tác</Label>
            <Select value={operation} onValueChange={setOperation}>
              <SelectTrigger>
                <SelectValue placeholder="Chọn thao tác" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="update-status">
                  <div className="flex items-center space-x-2">
                    <UserCheck className="h-4 w-4" />
                    <span>Cập nhật trạng thái</span>
                  </div>
                </SelectItem>
                <SelectItem value="update-role">
                  <div className="flex items-center space-x-2">
                    <Shield className="h-4 w-4" />
                    <span>Cập nhật vai trò</span>
                  </div>
                </SelectItem>
                <SelectItem value="delete">
                  <div className="flex items-center space-x-2">
                    <Trash2 className="h-4 w-4" />
                    <span>Xóa người dùng</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {operation === "update-status" && (
            <div className="space-y-2">
              <Label>Trạng thái mới</Label>
              <Select value={selectedStatus} onValueChange={(value) => setSelectedStatus(value as UserStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UserStatus.ACTIVE}>
                    <div className="flex items-center space-x-2">
                      <UserCheck className="h-4 w-4" />
                      <span>Hoạt động</span>
                    </div>
                  </SelectItem>
                  <SelectItem value={UserStatus.INACTIVE}>
                    <div className="flex items-center space-x-2">
                      <UserX className="h-4 w-4" />
                      <span>Không hoạt động</span>
                    </div>
                  </SelectItem>
                  <SelectItem value={UserStatus.LOCKED}>
                    <div className="flex items-center space-x-2">
                      <Lock className="h-4 w-4" />
                      <span>Bị khóa</span>
                    </div>
                  </SelectItem>
                  <SelectItem value={UserStatus.SUSPENDED}>
                    <div className="flex items-center space-x-2">
                      <Unlock className="h-4 w-4" />
                      <span>Tạm khóa</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {operation === "update-role" && (
            <div className="space-y-2">
              <Label>Vai trò mới</Label>
              <Select value={selectedRole} onValueChange={(value) => setSelectedRole(value as UserRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UserRole.USER}>
                    <div className="flex items-center space-x-2">
                      <UserX className="h-4 w-4" />
                      <span>Người dùng</span>
                    </div>
                  </SelectItem>
                  <SelectItem value={UserRole.ADMIN}>
                    <div className="flex items-center space-x-2">
                      <Shield className="h-4 w-4" />
                      <span>Quản trị viên</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {operation === "delete" && (
            <div className="p-4 border border-red-200 bg-red-50 rounded-md">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <p className="text-sm text-red-800">
                  Bạn có chắc chắn muốn xóa {selectedUsers.length} người dùng đã chọn? 
                  Thao tác này không thể hoàn tác.
                </p>
              </div>
            </div>
          )}

          {operation && (
            <div className="p-4 border border-yellow-200 bg-yellow-50 rounded-md">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                <div className="text-sm text-yellow-800">
                  <p>
                    Thao tác: <strong>{getOperationTitle(operation)}</strong>
                    {operation === "update-status" && (
                      <> → <strong>{getStatusLabel(selectedStatus)}</strong></>
                    )}
                    {operation === "update-role" && (
                      <> → <strong>{getRoleLabel(selectedRole)}</strong></>
                    )}
                  </p>
                  <p>Áp dụng cho {selectedUsers.length} người dùng đã chọn.</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end space-x-2">
          <Button type="button" variant="outline" onClick={handleClose}>
            Hủy
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={!operation || isLoading}
            variant={operation === "delete" ? "destructive" : "default"}
          >
            {isLoading ? "Đang xử lý..." : "Thực hiện"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
