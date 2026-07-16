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
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { 
  Search, 
  Plus, 
  RefreshCw, 
  Users, 
  UserCheck, 
  UserX, 
  Shield, 
  MoreHorizontal,
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
    loadUsers()
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
      // Only fetch full list for statistics on first load with no filters
      if (searchTerm === "" && roleFilter === "all" && statusFilter === "all" && currentPage === 0) {
        // Use the paginated data for basic statistics if we have enough data
        if (usersData.totalElements <= usersData.size) {
          // If all users fit in one page, use current data for statistics
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
          // If there are more users, fetch full list for accurate statistics
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
      setError('Không thể tải danh sách người dùng')
      console.error('Error loading users:', err)
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
    loadUsers()
  }

  const clearFilters = () => {
    setSearchTerm("")
    setRoleFilter("all")
    setStatusFilter("all")
    setCurrentPage(0)
  }

  // Check if current user has admin privileges
  const isAdmin = currentUser?.role === UserRole.ADMIN

  if (!isAdmin) {
    return (
      <div className="admin-mobile-page">
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center">
              <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Không có quyền truy cập</h3>
              <p className="text-muted-foreground">
                Bạn cần quyền quản trị viên để truy cập trang quản lý người dùng.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="platform-page">
      <header className="platform-page-header grid-cols-[minmax(0,1fr)_auto] items-start">
        <div className="min-w-0">
          <h1 className="platform-page-title">Quản lý người dùng</h1>
          <p className="platform-page-description">Quản lý tài khoản, vai trò và trạng thái truy cập trong tổ chức.</p>
        </div>
        <div className="platform-page-actions !flex shrink-0 items-start justify-end gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={handleRefresh}
            disabled={loading}
            className="!h-8 !min-h-8 !w-8 shrink-0 rounded-lg !p-0 shadow-none sm:!h-10 sm:!min-h-10 sm:!w-auto sm:px-3"
            aria-label={loading ? "Đang tải" : "Làm mới"}
            title={loading ? "Đang tải" : "Làm mới"}
          >
            <RefreshCw className={loading ? "animate-spin" : undefined} aria-hidden="true" />
            <span className="sr-only sm:not-sr-only sm:ml-2">{loading ? "Đang tải" : "Làm mới"}</span>
          </Button>
          <Button
            size="icon"
            onClick={() => setIsFormOpen(true)}
            className="!h-8 !min-h-8 !w-8 shrink-0 rounded-lg !p-0 shadow-none sm:!h-10 sm:!min-h-10 sm:!w-auto sm:px-3"
            aria-label="Thêm người dùng"
            title="Thêm người dùng"
          >
            <Plus aria-hidden="true" />
            <span className="sr-only sm:not-sr-only sm:ml-2">Thêm người dùng</span>
          </Button>
        </div>
      </header>

      <section className="platform-stat-strip" aria-label="Tổng quan người dùng">
        {[
          { label: "Tổng người dùng", value: statistics.totalUsers, note: "Tài khoản trong tổ chức", icon: Users, tone: "var(--color-signal)" },
          { label: "Hoạt động", value: statistics.activeUsers, note: "Có thể truy cập hệ thống", icon: UserCheck, tone: "var(--color-success)" },
          { label: "Quản trị viên", value: statistics.adminUsers, note: "Có quyền quản trị", icon: Shield, tone: "var(--color-accent)" },
          { label: "Bị khóa", value: statistics.lockedUsers, note: "Cần xem xét lại truy cập", icon: UserX, tone: "var(--color-critical)" },
        ].map(({ label, value, note, icon: Icon, tone }) => (
          <div key={label} className="platform-stat">
            <div className="flex items-center gap-2">
              <Icon className="size-4" style={{ color: tone }} aria-hidden="true" />
              <p className="platform-stat-label">{label}</p>
            </div>
            <p className="platform-stat-value">{value}</p>
            <p className="platform-stat-note">{note}</p>
          </div>
        ))}
      </section>

      <section className="platform-toolbar" aria-label="Bộ lọc người dùng">
        <div className="relative min-w-0 flex-1 basis-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input aria-label="Tìm người dùng" placeholder="Tìm theo tên, email hoặc username" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} className="min-h-11 pl-9" />
        </div>
        <Select value={roleFilter} onValueChange={(value) => setRoleFilter(value as "all" | UserRole)}>
          <SelectTrigger className="min-h-11 w-full sm:w-52" aria-label="Lọc theo vai trò"><SelectValue placeholder="Vai trò" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả vai trò</SelectItem>
            <SelectItem value={UserRole.USER}>Người dùng</SelectItem>
            <SelectItem value={UserRole.ADMIN}>Quản trị viên</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as "all" | UserStatus)}>
          <SelectTrigger className="min-h-11 w-full sm:w-52" aria-label="Lọc theo trạng thái"><SelectValue placeholder="Trạng thái" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả trạng thái</SelectItem>
            <SelectItem value={UserStatus.ACTIVE}>Hoạt động</SelectItem>
            <SelectItem value={UserStatus.INACTIVE}>Không hoạt động</SelectItem>
            <SelectItem value={UserStatus.LOCKED}>Bị khóa</SelectItem>
            <SelectItem value={UserStatus.SUSPENDED}>Tạm khóa</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={clearFilters} className="min-h-11 whitespace-nowrap">Xóa lọc</Button>
      </section>

      {/* Bulk Actions */}
      {selectedUsers.length > 0 && (
        <div className="platform-toolbar border-[var(--color-accent)] bg-[var(--color-paper-2)]">
          <div className="flex items-center gap-2">
            <div className="size-2 rounded-full bg-primary" aria-hidden="true"></div>
            <Badge variant="secondary">
              {selectedUsers.length} người dùng đã chọn
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsBulkDialogOpen(true)}
            >
              <MoreHorizontal className="h-4 w-4 mr-2" />
              Thao tác hàng loạt
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedUsers([])}
            >
              Bỏ chọn
            </Button>
          </div>
        </div>
      )}

      <section className="platform-data-surface" aria-label="Danh sách người dùng">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-4 sm:px-6">
          <div>
            <h2 className="text-base font-semibold">Danh sách người dùng</h2>
            <p className="mt-1 text-sm text-muted-foreground">Hiển thị {users.length} / {totalElements} người dùng</p>
          </div>
        </div>
        <div className="min-w-0">
          {loading ? (
            <div className="platform-empty-state">
              <RefreshCw className="h-6 w-6 animate-spin mr-2" />
              <span>Đang tải...</span>
            </div>
          ) : error ? (
            <div className="platform-empty-state text-destructive">
              {error}
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
      </section>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="platform-pagination">
            <div>
              <div className="text-sm text-muted-foreground">
                Trang {currentPage + 1} / {totalPages}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(0)}
                  disabled={currentPage === 0}
                >
                  Đầu
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(currentPage - 1)}
                  disabled={currentPage === 0}
                >
                  Trước
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(currentPage + 1)}
                  disabled={currentPage === totalPages - 1}
                >
                  Sau
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(totalPages - 1)}
                  disabled={currentPage === totalPages - 1}
                >
                  Cuối
                </Button>
              </div>
            </div>
        </div>
      )}

      {/* User Form Dialog */}
      <UserForm
        isOpen={isFormOpen}
        onClose={handleCloseForm}
        onSubmit={editingUser ? handleUpdateUser as (userData: CreateUserRequest | UpdateUserRequest) => Promise<void> : handleCreateUser as (userData: CreateUserRequest | UpdateUserRequest) => Promise<void>}
        user={editingUser}
        employees={[]}
        isEditing={!!editingUser}
      />

      {/* Bulk Operations Dialog */}
      <BulkOperationsDialog
        isOpen={isBulkDialogOpen}
        onClose={() => setIsBulkDialogOpen(false)}
        selectedUsers={selectedUsers}
        onBulkUpdateStatus={handleBulkUpdateStatus}
        onBulkUpdateRole={handleBulkUpdateRole}
        onBulkDelete={handleBulkDelete}
      />
    </div>
  )
}
