"use client"

import { useState, useEffect } from "react"
import type { User, CreateUserRequest, UpdateUserRequest, Employee } from "@/lib/types"
import { UserRole, UserStatus, isSiteScopedOperator } from "@/lib/types"
import { siteApi, type Site } from "@/lib/api/site-api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Eye, EyeOff, User as UserIcon, Mail, Lock, Shield, UserCheck, UserX, MapPinned } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

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
    siteIds: [] as string[],
  })

  const [sites, setSites] = useState<Site[]>([])
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [errors, setErrors] = useState<Partial<Record<"username" | "email" | "password" | "confirmPassword" | "siteIds", string>>>({})
  const { toast } = useToast()

  useEffect(() => {
    if (!isOpen) return
    void siteApi.list().then(setSites).catch(() => setSites([]))
  }, [isOpen])

  useEffect(() => {
    setErrors({})
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
        siteIds: user.siteIds || [],
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
        siteIds: [],
      })
    }
  }, [user, isEditing, isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const nextErrors: Partial<Record<"username" | "email" | "password" | "confirmPassword" | "siteIds", string>> = {}
    if (!formData.username.trim()) nextErrors.username = "Nhập tên đăng nhập để tiếp tục."
    if (!formData.email.trim()) nextErrors.email = "Nhập địa chỉ email để tiếp tục."
    if (!isEditing && !formData.password.trim()) nextErrors.password = "Nhập mật khẩu cho tài khoản mới."
    if (!isEditing && formData.password && formData.password.length < 6) nextErrors.password = "Mật khẩu cần có ít nhất 6 ký tự."
    if (!isEditing && formData.password !== formData.confirmPassword) nextErrors.confirmPassword = "Mật khẩu xác nhận chưa khớp."
    if (isSiteScopedOperator(formData.role) && formData.siteIds.length === 0) {
      nextErrors.siteIds = "Chọn ít nhất một khu vực cho vai trò vận hành theo site."
    }
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      const firstField = Object.keys(nextErrors)[0]
      document.getElementById(firstField)?.focus()
      return
    }
    setErrors({})

    try {
      setIsLoading(true)
      const userData: CreateUserRequest | UpdateUserRequest = {
        username: formData.username.trim(),
        email: formData.email.trim(),
        fullName: formData.fullName.trim() || undefined,
        role: formData.role,
        status: formData.status,
        employeeId: formData.employeeId === "none" ? undefined : formData.employeeId || undefined,
        siteIds: isSiteScopedOperator(formData.role) ? formData.siteIds : [],
      }
      if (!isEditing) {
        ;(userData as CreateUserRequest).password = formData.password
      } else if (formData.password.trim()) {
        ;(userData as UpdateUserRequest).password = formData.password
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
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (field in errors) {
      setErrors((current) => ({ ...current, [field]: undefined }))
    }
  }

  const toggleSite = (siteId: string) => {
    setFormData((prev) => ({
      ...prev,
      siteIds: prev.siteIds.includes(siteId)
        ? prev.siteIds.filter((id) => id !== siteId)
        : [...prev.siteIds, siteId],
    }))
    setErrors((current) => ({ ...current, siteIds: undefined }))
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Cập nhật người dùng" : "Tạo người dùng"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {Object.keys(errors).length > 0 && (
            <div role="alert" className="rounded-[var(--radius-input)] border border-destructive/30 bg-[var(--color-critical-surface)] p-3 text-sm text-[var(--color-on-critical)]">
              Kiểm tra các trường được đánh dấu trước khi lưu.
            </div>
          )}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Thông tin tài khoản</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="username">Tên đăng nhập</Label>
                  <Input
                    id="username"
                    autoComplete="username"
                    value={formData.username}
                    onChange={(e) => handleInputChange("username", e.target.value)}
                    aria-invalid={!!errors.username}
                    aria-describedby={errors.username ? "username-error" : undefined}
                    required
                  />
                  {errors.username && <p id="username-error" className="text-xs font-medium text-destructive">{errors.username}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      className="pl-9"
                      value={formData.email}
                      onChange={(e) => handleInputChange("email", e.target.value)}
                      aria-invalid={!!errors.email}
                      aria-describedby={errors.email ? "email-error" : undefined}
                      required
                    />
                  </div>
                  {errors.email && <p id="email-error" className="text-xs font-medium text-destructive">{errors.email}</p>}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="fullName">Họ tên</Label>
                <Input
                  id="fullName"
                  value={formData.fullName}
                  onChange={(e) => handleInputChange("fullName", e.target.value)}
                />
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="password">{isEditing ? "Mật khẩu mới (tuỳ chọn)" : "Mật khẩu"}</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete={isEditing ? "new-password" : "new-password"}
                      className="pl-9 pr-12"
                      value={formData.password}
                      onChange={(e) => handleInputChange("password", e.target.value)}
                      aria-invalid={!!errors.password}
                      aria-describedby={errors.password ? "password-error" : undefined}
                      required={!isEditing}
                    />
                    <button
                      type="button"
                      className="absolute right-1 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-[var(--radius-input)] text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                    >
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                  {errors.password && <p id="password-error" className="text-xs font-medium text-destructive">{errors.password}</p>}
                </div>
                {!isEditing && (
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Xác nhận mật khẩu</Label>
                    <div className="relative">
                      <Input
                        id="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        autoComplete="new-password"
                        className="pr-12"
                        value={formData.confirmPassword}
                        onChange={(e) => handleInputChange("confirmPassword", e.target.value)}
                        aria-invalid={!!errors.confirmPassword}
                        aria-describedby={errors.confirmPassword ? "confirm-password-error" : undefined}
                        required
                      />
                      <button
                        type="button"
                        className="absolute right-1 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-[var(--radius-input)] text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                        onClick={() => setShowConfirmPassword((value) => !value)}
                        aria-label={showConfirmPassword ? "Ẩn mật khẩu xác nhận" : "Hiện mật khẩu xác nhận"}
                      >
                        {showConfirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                    {errors.confirmPassword && <p id="confirm-password-error" className="text-xs font-medium text-destructive">{errors.confirmPassword}</p>}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Quyền và trạng thái</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
                          <span>Người dùng (Member)</span>
                        </div>
                      </SelectItem>
                      <SelectItem value={UserRole.SITE_MANAGER}>
                        <div className="flex items-center space-x-2">
                          <MapPinned className="h-4 w-4" />
                          <span>Quản lý chi nhánh</span>
                        </div>
                      </SelectItem>
                      <SelectItem value={UserRole.SECURITY_GUARD}>
                        <div className="flex items-center space-x-2">
                          <Shield className="h-4 w-4" />
                          <span>Nhân viên bảo vệ</span>
                        </div>
                      </SelectItem>
                      <SelectItem value={UserRole.ADMIN}>
                        <div className="flex items-center space-x-2">
                          <Shield className="h-4 w-4" />
                          <span>Quản trị viên tenant</span>
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

              {isSiteScopedOperator(formData.role) && (
                <div className="space-y-2">
                  <Label>Khu vực được gán *</Label>
                  <p className="text-xs text-muted-foreground">
                    {formData.role === UserRole.SECURITY_GUARD
                      ? "Security guard chỉ quan sát vận hành trong các chi nhánh được chọn."
                      : "Site manager chỉ vận hành trong các chi nhánh được chọn."}
                  </p>
                  <div
                    id="siteIds"
                    tabIndex={-1}
                    aria-invalid={!!errors.siteIds}
                    aria-describedby={errors.siteIds ? "site-ids-error" : undefined}
                    className={cn("max-h-40 space-y-2 overflow-y-auto rounded-[var(--radius-input)] border p-3 outline-none", errors.siteIds && "border-destructive ring-2 ring-destructive/20")}
                  >
                    {sites.length === 0 && (
                      <p className="text-sm text-muted-foreground">Chưa có khu vực — tạo site trước.</p>
                    )}
                    {sites.map((site) => (
                      <label
                        key={site.id}
                        className={cn(
                          "flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted/50",
                          formData.siteIds.includes(site.id) && "bg-muted"
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={formData.siteIds.includes(site.id)}
                          onChange={() => toggleSite(site.id)}
                        />
                        <span>{site.name}</span>
                      </label>
                    ))}
                  </div>
                  {errors.siteIds && <p id="site-ids-error" className="text-xs font-medium text-destructive">{errors.siteIds}</p>}
                </div>
              )}

              {employees.length > 0 && (
                <div className="space-y-2">
                  <Label>Liên kết với nhân viên (tùy chọn)</Label>
                  <Select value={formData.employeeId} onValueChange={(value) => handleInputChange("employeeId", value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Chọn nhân viên" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Không liên kết</SelectItem>
                      {employees.map((emp) => (
                        <SelectItem key={emp.id} value={emp.id}>
                          {emp.name} ({emp.employeeId})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </CardContent>
          </Card>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
              Hủy
            </Button>
            <Button type="submit" disabled={isLoading} data-state={isLoading ? "loading" : undefined}>
              {isLoading ? "Đang lưu…" : isEditing ? "Cập nhật" : "Tạo"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
