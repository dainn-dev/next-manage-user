"use client"

import { useState, useEffect } from "react"
import type { User, CreateUserRequest, UpdateUserRequest } from "@/lib/types"
import { UserRole, UserStatus } from "@/lib/types"
import { userApi } from "@/lib/api/user-api"
import { UserTable } from "@/components/users/user-table"
import { UserForm } from "@/components/users/user-form"
import { BulkOperationsDialog } from "@/components/users/bulk-operations-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { DashboardMetricsSection } from "@/components/dashboard/dashboard-metrics-section"
import { AdminPage, AdminPageHeader } from "@/components/layout/admin-page"
import { 
  Search, 
  Plus, 
  RefreshCw, 
  Users, 
  UserCheck, 
  UserX, 
  Shield, 
  X,
  SlidersHorizontal,
  Loader2,
} from "lucide-react"
import { useAuth } from "@/lib/auth-context"

interface PaginatedUsers {
  content: User[]
  totalElements: number
  totalPages: number
  size: number
  number: number
  first: boolean
  last: boolean
  numberOfElements: number
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isBulkDialogOpen, setIsBulkDialogOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Filters and search
  const [searchTerm, setSearchTerm] = useState("")
  const [roleFilter, setRoleFilter] = useState<"all" | UserRole>("all")
  const [statusFilter, setStatusFilter] = useState<"all" | UserStatus>("all")
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(0)
  const [pageSize, setPageSize] = useState(10)
  const [totalPages, setTotalPages] = useState(0)
  const [totalElements, setTotalElements] = useState(0)
  
  // Statistics
  const [statistics, setStatistics] = useState({
    totalUsers: 0,
    activeUsers: 0,
    inactiveUsers: 0,
    lockedUsers: 0,
    suspendedUsers: 0,
    adminUsers: 0,
    regularUsers: 0,
  })

  const { user: currentUser } = useAuth()
  const { toast } = useToast()

  useEffect(() => {
    void loadUsers()
  }, [currentPage, pageSize, searchTerm, roleFilter, statusFilter])

  const loadUsers = async () => {
    try {
      setLoading(true)
      let usersData: PaginatedUsers

      if (searchTerm.trim()) {
        usersData = await userApi.searchUsers(searchTerm, currentPage, pageSize)
      } else if (roleFilter !== "all") {
        usersData = await userApi.getUsersByRole(roleFilter, currentPage, pageSize)
      } else if (statusFilter !== "all") {
        usersData = await userApi.getUsersByStatus(statusFilter, currentPage, pageSize)
      } else {
        usersData = await userApi.getAllUsers(currentPage, pageSize)
      }

      setUsers(usersData.content)
      setTotalPages(usersData.totalPages)
      setTotalElements(usersData.totalElements)
      setCurrentPage(usersData.number)

      // Calculate statistics from the current page data (for basic stats)
      if (searchTerm === "" && roleFilter === "all" && statusFilter === "all" && currentPage === 0) {
        if (usersData.totalElements <= usersData.size) {
          const stats = {
            totalUsers: usersData.totalElements,
            activeUsers: usersData.content.filter(u => u.status === UserStatus.ACTIVE).length,
            inactiveUsers: usersData.content.filter(u => u.status === UserStatus.INACTIVE).length,
            lockedUsers: usersData.content.filter(u => u.status === UserStatus.LOCKED).length,
            suspendedUsers: usersData.content.filter(u => u.status === UserStatus.SUSPENDED).length,
            adminUsers: usersData.content.filter(u => u.role === UserRole.ADMIN).length,
            regularUsers: usersData.content.filter(u => u.role === UserRole.USER).length,
          }
          setStatistics(stats)
        } else {
          const allUsersData = await userApi.getAllUsersList()
          const stats = {
            totalUsers: allUsersData.length,
            activeUsers: allUsersData.filter(u => u.status === UserStatus.ACTIVE).length,
            inactiveUsers: allUsersData.filter(u => u.status === UserStatus.INACTIVE).length,
            lockedUsers: allUsersData.filter(u => u.status === UserStatus.LOCKED).length,
            suspendedUsers: allUsersData.filter(u => u.status === UserStatus.SUSPENDED).length,
            adminUsers: allUsersData.filter(u => u.role === UserRole.ADMIN).length,
            regularUsers: allUsersData.filter(u => u.role === UserRole.USER).length,
          }
          setStatistics(stats)
        }
      }
    } catch (err) {
      setError("Không thể tải danh sách người dùng")
      console.error("Error loading users:", err)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateUser = async (userData: CreateUserRequest) => {
    try {
      const newUser = await userApi.createUser(userData)
      setUsers(prev => [newUser, ...prev])
      setStatistics(prev => ({
        ...prev,
        totalUsers: prev.totalUsers + 1,
        activeUsers: userData.status === UserStatus.ACTIVE ? prev.activeUsers + 1 : prev.activeUsers,
        adminUsers: userData.role === UserRole.ADMIN ? prev.adminUsers + 1 : prev.adminUsers,
        regularUsers: userData.role === UserRole.USER ? prev.regularUsers + 1 : prev.regularUsers,
      }))
    } catch (error) {
      throw error
    }
  }

  const handleUpdateUser = async (userData: UpdateUserRequest) => {
    if (!editingUser) return

    try {
      const updatedUser = await userApi.updateUser(editingUser.id, userData)
      setUsers(prev => prev.map(u => u.id === editingUser.id ? updatedUser : u))
      setEditingUser(null)
    } catch (error) {
      throw error
    }
  }

  const handleDeleteUser = async (userId: string) => {
    try {
      await userApi.deleteUser(userId)
      setUsers(prev => prev.filter(u => u.id !== userId))
      setStatistics(prev => ({
        ...prev,
        totalUsers: prev.totalUsers - 1,
      }))
      
      toast({
        title: "Thành công",
        description: "Đã xóa người dùng",
      })
    } catch (error) {
      toast({
        title: "Lỗi",
        description: error instanceof Error ? error.message : "Không thể xóa người dùng",
        variant: "destructive",
      })
    }
  }

  const handleUpdateUserStatus = async (userId: string, status: UserStatus) => {
    try {
      const updatedUser = await userApi.updateUserStatus(userId, status)
      setUsers(prev => prev.map(u => u.id === userId ? updatedUser : u))
      
      toast({
        title: "Thành công",
        description: "Đã cập nhật trạng thái người dùng",
      })
    } catch (error) {
      toast({
        title: "Lỗi",
        description: error instanceof Error ? error.message : "Không thể cập nhật trạng thái",
        variant: "destructive",
      })
    }
  }

  const handleUpdateUserRole = async (userId: string, role: UserRole) => {
    try {
      const updatedUser = await userApi.updateUserRole(userId, role)
      setUsers(prev => prev.map(u => u.id === userId ? updatedUser : u))
      
      toast({
        title: "Thành công",
        description: "Đã cập nhật vai trò người dùng",
      })
    } catch (error) {
      toast({
        title: "Lỗi",
        description: error instanceof Error ? error.message : "Không thể cập nhật vai trò",
        variant: "destructive",
      })
    }
  }

  const handleBulkUpdateStatus = async (userIds: string[], status: UserStatus) => {
    try {
      await userApi.bulkUpdateUserStatus(userIds, status)
      setUsers(prev => prev.map(u => 
        userIds.includes(u.id) ? { ...u, status } : u
      ))
      setSelectedUsers([])
    } catch (error) {
      throw error
    }
  }

  const handleBulkUpdateRole = async (userIds: string[], role: UserRole) => {
    try {
      await userApi.bulkUpdateUserRole(userIds, role)
      setUsers(prev => prev.map(u => 
        userIds.includes(u.id) ? { ...u, role } : u
      ))
      setSelectedUsers([])
    } catch (error) {
      throw error
    }
  }

  const handleBulkDelete = async (userIds: string[]) => {
    try {
      await userApi.bulkDeleteUsers(userIds)
      setUsers(prev => prev.filter(u => !userIds.includes(u.id)))
      setSelectedUsers([])
    } catch (error) {
      throw error
    }
  }

  const handleUserSelect = (userId: string, selected: boolean) => {
    if (selected) {
      setSelectedUsers(prev => [...prev, userId])
    } else {
      setSelectedUsers(prev => prev.filter(id => id !== userId))
    }
  }

  const handleSelectAll = (selected: boolean) => {
    if (selected) {
      setSelectedUsers(users.map(u => u.id))
    } else {
      setSelectedUsers([])
    }
  }

  const handleEditUser = (user: User) => {
    setEditingUser(user)
    setIsFormOpen(true)
  }

  const handleCloseForm = () => {
    setIsFormOpen(false)
    setEditingUser(null)
  }

  const handleRefresh = () => {
    void loadUsers()
  }

  const clearFilters = () => {
    setSearchTerm("")
    setRoleFilter("all")
    setStatusFilter("all")
    setCurrentPage(0)
  }

  const isAdmin = currentUser?.role === UserRole.ADMIN
  const accountMetrics = [
    {
      label: "Tổng thành viên",
      value: statistics.totalUsers.toLocaleString("vi-VN"),
      note: "Tổng tài khoản đăng ký trong tổ chức",
      icon: Users,
      tone: "primary",
    },
    {
      label: "Đang hoạt động",
      value: statistics.activeUsers.toLocaleString("vi-VN"),
      note: "Tài khoản sẵn sàng vận hành",
      icon: UserCheck,
      tone: "success",
    },
    {
      label: "Quản trị viên",
      value: statistics.adminUsers.toLocaleString("vi-VN"),
      note: "Sở hữu toàn quyền quản trị",
      icon: Shield,
      tone: "serious",
    },
    {
      label: "Tài khoản bị khóa",
      value: statistics.lockedUsers.toLocaleString("vi-VN"),
      note: "Truy cập bị đình chỉ bảo mật",
      icon: UserX,
      tone: "critical",
    },
  ] as const

  if (!isAdmin) {
    return (
      <AdminPage size="narrow" className="justify-center min-h-dvh flex items-center">
        <Card className="mx-auto max-w-lg border border-border bg-card text-foreground shadow-2xl relative overflow-hidden">
          <CardContent className="flex flex-col items-center gap-5 p-8 text-center relative z-10">
            <div className="p-4 rounded-full bg-rose-50 dark:bg-rose-950/20 text-rose-500 border border-rose-500/10">
              <Shield className="h-8 w-8" aria-hidden="true" />
            </div>
            <div className="space-y-2">
              <h1 className="text-sm font-bold tracking-wider text-rose-500 uppercase">
                Không có quyền truy cập
              </h1>
              <p className="text-xs text-muted-foreground leading-relaxed max-w-sm">
                Tài khoản của bạn không sở hữu đặc quyền quản trị hệ thống. Vui lòng liên hệ với quản trị viên bãi xe để yêu cầu cấp quyền truy cập tính năng này.
              </p>
            </div>
          </CardContent>
        </Card>
      </AdminPage>
    )
  }

  return (
    <AdminPage className="min-h-dvh space-y-6">
      <AdminPageHeader
        eyebrow="Quản trị tài khoản"
        title="Quản lý người dùng"
        description="Quản trị danh sách người dùng, phân quyền vai trò (RBAC) và giám sát trạng thái bảo mật của thành viên tổ chức."
        actions={
          <div className="flex items-center gap-2.5">
            <Button
              variant="outline"
              size="icon"
              onClick={handleRefresh}
              disabled={loading}
              className="h-10 w-10 border-border bg-card text-muted-foreground hover:text-foreground rounded-xl shadow-sm"
              aria-label="Làm mới"
              title="Làm mới"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
            <Button
              onClick={() => setIsFormOpen(true)}
              className="bg-primary text-primary-foreground font-bold text-xs h-10 px-4 rounded-xl flex items-center justify-center gap-1.5 shadow-md"
            >
              <Plus className="h-4 w-4" />
              <span>Thêm người dùng</span>
            </Button>
          </div>
        }
      />

      <div className="space-y-6">
        <DashboardMetricsSection
          id="user-account-overview"
          title="Tổng quan thông số tài khoản"
          description="Tổng hợp quy mô thành viên, quyền quản trị và trạng thái bảo mật tài khoản."
          loading={loading}
          metrics={accountMetrics}
        />

        {/* Filters Toolbar */}
        <section aria-label="Bộ lọc tài khoản" className="border border-border bg-card p-4 rounded-xl flex flex-col md:flex-row items-center gap-4 shadow-sm">
          <div className="relative flex-1 w-full">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              aria-label="Tìm người dùng"
              placeholder="Tìm theo tên, email hoặc username..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="bg-background border-border text-foreground font-medium h-11 pl-10 rounded-xl focus-visible:ring-primary/20 tracking-wide text-xs"
            />
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
            <Select value={roleFilter} onValueChange={(value) => setRoleFilter(value as "all" | UserRole)}>
              <SelectTrigger className="w-full sm:w-44 bg-background border-border text-foreground h-11 rounded-xl text-xs" aria-label="Lọc theo vai trò">
                <SelectValue placeholder="Vai trò" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border text-foreground">
                <SelectItem value="all" className="text-xs">Tất cả vai trò</SelectItem>
                <SelectItem value={UserRole.USER} className="text-xs">Người dùng</SelectItem>
                <SelectItem value={UserRole.ADMIN} className="text-xs">Quản trị viên</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as "all" | UserStatus)}>
              <SelectTrigger className="w-full sm:w-44 bg-background border-border text-foreground h-11 rounded-xl text-xs" aria-label="Lọc theo trạng thái">
                <SelectValue placeholder="Trạng thái" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border text-foreground">
                <SelectItem value="all" className="text-xs">Tất cả trạng thái</SelectItem>
                <SelectItem value={UserStatus.ACTIVE} className="text-xs">Hoạt động</SelectItem>
                <SelectItem value={UserStatus.INACTIVE} className="text-xs">Không hoạt động</SelectItem>
                <SelectItem value={UserStatus.LOCKED} className="text-xs">Bị khóa</SelectItem>
                <SelectItem value={UserStatus.SUSPENDED} className="text-xs">Tạm khóa</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              onClick={clearFilters}
              className="w-full sm:w-auto border-border bg-background text-muted-foreground hover:text-foreground text-xs h-11 px-4 rounded-xl flex items-center justify-center gap-1.5"
            >
              <X className="h-3.5 w-3.5" />
              <span>Xóa lọc</span>
            </Button>
          </div>
        </section>

        {/* Selected Batch Pipeline Strip */}
        {selectedUsers.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border border-primary/20 bg-primary/5 rounded-xl animate-in fade-in-50 duration-200 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary/40 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
              </span>
              <div className="space-y-0.5">
                <p className="text-[11px] font-semibold text-primary">
                  Đã chọn {selectedUsers.length} tài khoản trong phiên làm việc
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsBulkDialogOpen(true)}
                className="border-primary/20 bg-background text-primary hover:bg-muted font-bold text-[11px] h-9 px-4 rounded-xl flex items-center gap-1.5 shadow-sm"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Thực thi hàng loạt
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedUsers([])}
                className="border-border bg-background text-muted-foreground hover:text-foreground text-[11px] h-9 px-4 rounded-xl flex items-center gap-1.5"
              >
                <X className="h-3.5 w-3.5" />
                Hủy chọn
              </Button>
            </div>
          </div>
        )}

        {/* Main Registry Table Surface */}
        <section className="border border-border bg-card text-foreground shadow-[var(--shadow-card)] rounded-xl relative overflow-hidden" aria-label="Danh sách người dùng">
          <div className="border-b border-border px-5 py-4 sm:px-6 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-foreground">Danh sách tài khoản hệ thống</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Hiển thị {users.length} tài khoản trong tổng số {totalElements} bản ghi thuộc hệ thống.
              </p>
            </div>
          </div>

          <div className="min-w-0">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16 gap-2 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="animate-pulse text-xs tracking-wider font-semibold uppercase mt-1">Đang truy xuất dữ liệu...</span>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-16 text-rose-500 text-xs">
                <p className="font-bold">Lỗi tải dữ liệu</p>
                <p className="text-muted-foreground mt-1">{error}</p>
              </div>
            ) : (
              <UserTable
                users={users}
                selectedUsers={selectedUsers}
                onUserSelect={handleUserSelect}
                onSelectAll={handleSelectAll}
                onEditUser={handleEditUser}
                onDeleteUser={handleDeleteUser}
                onUpdateUserStatus={handleUpdateUserStatus}
                onUpdateUserRole={handleUpdateUserRole}
              />
            )}
          </div>

          {/* Pagination controls */}
          {totalPages > 1 && (
            <div className="border-t border-border bg-muted/20 p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
              <span className="text-xs text-muted-foreground font-medium">
                Trang {currentPage + 1} / {totalPages}
              </span>
              <div className="flex flex-wrap gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(0)}
                  disabled={currentPage === 0}
                  className="border-border bg-background text-muted-foreground hover:text-foreground text-xs h-8 px-3 rounded-lg"
                >
                  Đầu
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(currentPage - 1)}
                  disabled={currentPage === 0}
                  className="border-border bg-background text-muted-foreground hover:text-foreground text-xs h-8 px-3 rounded-lg"
                >
                  Trước
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(currentPage + 1)}
                  disabled={currentPage === totalPages - 1}
                  className="border-border bg-background text-muted-foreground hover:text-foreground text-xs h-8 px-3 rounded-lg"
                >
                  Sau
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(totalPages - 1)}
                  disabled={currentPage === totalPages - 1}
                  className="border-border bg-background text-muted-foreground hover:text-foreground text-xs h-8 px-3 rounded-lg"
                >
                  Cuối
                </Button>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* User Form Dialog overlay */}
      <UserForm
        isOpen={isFormOpen}
        onClose={handleCloseForm}
        onSubmit={editingUser ? (handleUpdateUser as (userData: CreateUserRequest | UpdateUserRequest) => Promise<void>) : (handleCreateUser as (userData: CreateUserRequest | UpdateUserRequest) => Promise<void>)}
        user={editingUser}
        employees={[]}
        isEditing={!!editingUser}
      />

      {/* Bulk Operations Dialog overlay */}
      <BulkOperationsDialog
        isOpen={isBulkDialogOpen}
        onClose={() => setIsBulkDialogOpen(false)}
        selectedUsers={selectedUsers}
        onBulkUpdateStatus={handleBulkUpdateStatus}
        onBulkUpdateRole={handleBulkUpdateRole}
        onBulkDelete={handleBulkDelete}
      />
    </AdminPage>
  )
}
