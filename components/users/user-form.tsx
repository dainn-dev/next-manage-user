"use client"

import { useState, useEffect } from "react"
import type { User, CreateUserRequest, UpdateUserRequest, Employee } from "@/lib/types"
import { UserRole, UserStatus } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Eye, EyeOff, User as UserIcon, Mail, Lock, Shield, UserCheck, UserX } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface UserFormProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (userData: CreateUserRequest | UpdateUserRequest) => Promise<void>
  user?: User | null
  employees?: Employee[]
  isEditing?: boolean
}

export function UserForm({
  isOpen,
  onClose,
  onSubmit,
  user,
  employees = [],
  isEditing = false,
}: UserFormProps) {
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
    fullName: "",
    role: UserRole.USER,
    status: UserStatus.ACTIVE,
    employeeId: "",
  })
  
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    if (user && isEditing) {
      setFormData({
        username: user.username || "",
        email: user.email || "",
        password: "",
        confirmPassword: "",
        fullName: user.fullName || "",
        role: user.role || UserRole.USER,
        status: user.status || UserStatus.ACTIVE,
        employeeId: user.employeeId || "none",
      })
    } else {
      setFormData({
        username: "",
        email: "",
        password: "",
        confirmPassword: "",
        fullName: "",
        role: UserRole.USER,
        status: UserStatus.ACTIVE,
        employeeId: "none",
      })
    }
  }, [user, isEditing, isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validation
    if (!formData.username.trim()) {
      toast({
        title: "Lỗi",
        description: "Tên đăng nhập là bắt buộc",
        variant: "destructive",
      })
      return
    }

    if (!formData.email.trim()) {
      toast({
        title: "Lỗi",
        description: "Email là bắt buộc",
        variant: "destructive",
      })
      return
    }

    if (!isEditing && !formData.password.trim()) {
      toast({
        title: "Lỗi",
        description: "Mật khẩu là bắt buộc",
        variant: "destructive",
      })
      return
    }

    if (!isEditing && formData.password !== formData.confirmPassword) {
      toast({
        title: "Lỗi",
        description: "Mật khẩu xác nhận không khớp",
        variant: "destructive",
      })
      return
    }

    if (!isEditing && formData.password.length < 6) {
      toast({
        title: "Lỗi",
        description: "Mật khẩu phải có ít nhất 6 ký tự",
        variant: "destructive",
      })
      return
    }

    try {
      setIsLoading(true)
      
      const userData: CreateUserRequest | UpdateUserRequest = {
        username: formData.username.trim(),
        email: formData.email.trim(),
        fullName: formData.fullName.trim() || undefined,
        role: formData.role,
        status: formData.status,
        employeeId: formData.employeeId === "none" ? undefined : formData.employeeId || undefined,
      }

      if (!isEditing) {
        (userData as CreateUserRequest).password = formData.password
      } else if (formData.password.trim()) {
        (userData as UpdateUserRequest).password = formData.password
      }

      await onSubmit(userData)
      
      toast({
        title: "Thành công",
        description: isEditing ? "Cập nhật người dùng thành công" : "Tạo người dùng thành công",
      })
      
      onClose()
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

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const getEmployeeName = (employeeId: string) => {
    const employee = employees.find(emp => emp.id === employeeId)
    return employee ? `${employee.name} (${employee.employeeId})` : ""
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <UserIcon className="h-5 w-5" />
            <span>{isEditing ? "Chỉnh sửa người dùng" : "Tạo người dùng mới"}</span>
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Thông tin cơ bản</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="username">Tên đăng nhập *</Label>
                  <div className="relative">
                    <UserIcon className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="username"
                      placeholder="Nhập tên đăng nhập"
                      value={formData.username}
                      onChange={(e) => handleInputChange("username", e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="Nhập email"
                      value={formData.email}
                      onChange={(e) => handleInputChange("email", e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Họ và Tên</Label>
                  <Input
                    id="fullName"
                    placeholder="Nhập họ và tên đầy đủ"
                    value={formData.fullName}
                    onChange={(e) => handleInputChange("fullName", e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Thông tin bảo mật</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!isEditing && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="password">Mật khẩu *</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Nhập mật khẩu"
                        value={formData.password}
                        onChange={(e) => handleInputChange("password", e.target.value)}
                        className="pl-10 pr-10"
                        required={!isEditing}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Xác nhận mật khẩu *</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="Nhập lại mật khẩu"
                        value={formData.confirmPassword}
                        onChange={(e) => handleInputChange("confirmPassword", e.target.value)}
                        className="pl-10 pr-10"
                        required={!isEditing}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </>
              )}

              {isEditing && (
                <div className="space-y-2">
                  <Label htmlFor="newPassword">Mật khẩu mới (để trống nếu không thay đổi)</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="newPassword"
                      type={showPassword ? "text" : "password"}
                      placeholder="Nhập mật khẩu mới"
                      value={formData.password}
                      onChange={(e) => handleInputChange("password", e.target.value)}
                      className="pl-10 pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Quyền và trạng thái</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Vai trò</Label>
                  <Select value={formData.role} onValueChange={(value) => handleInputChange("role", value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Chọn vai trò" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={UserRole.USER}>
                        <div className="flex items-center space-x-2">
                          <UserIcon className="h-4 w-4" />
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

                <div className="space-y-2">
                  <Label>Trạng thái</Label>
                  <Select value={formData.status} onValueChange={(value) => handleInputChange("status", value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Chọn trạng thái" />
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
                          <UserIcon className="h-4 w-4" />
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
                          <UserX className="h-4 w-4" />
                          <span>Tạm khóa</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {employees.length > 0 && (
                <div className="space-y-2">
                  <Label>Liên kết với nhân viên (tùy chọn)</Label>
                  <Select value={formData.employeeId} onValueChange={(value) => handleInputChange("employeeId", value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Chọn nhân viên" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">
                        <span>Không liên kết</span>
                      </SelectItem>
                      {employees.map((employee) => (
                        <SelectItem key={employee.id} value={employee.id}>
                          {getEmployeeName(employee.id)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="border-t my-6" />

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Hủy
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Đang xử lý..." : isEditing ? "Cập nhật" : "Tạo mới"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
