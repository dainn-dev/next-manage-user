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
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
  Filter,
  Download
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

  // Filter bar state
  const [isFilterBarOpen, setIsFilterBarOpen] = useState(false)

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
      <div className="container mx-auto py-8">
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
    <div className="p-8 bg-background min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold text-foreground mb-2">Quản lý người dùng</h1>
          <p className="text-muted-foreground text-lg">Quản lý tài khoản người dùng và quyền hạn trong hệ thống</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={handleRefresh} disabled={loading} className="shadow-sm hover:shadow-md transition-all duration-200">
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Làm mới
          </Button>
          <Button onClick={() => setIsFormOpen(true)} className="shadow-sm hover:shadow-md transition-all duration-200">
            <Plus className="h-4 w-4 mr-2" />
            Thêm người dùng
          </Button>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tổng người dùng</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statistics.totalUsers}</div>
            <p className="text-xs text-muted-foreground">
              Tài khoản trong hệ thống
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Hoạt động</CardTitle>
            <UserCheck className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{statistics.activeUsers}</div>
            <p className="text-xs text-muted-foreground">
              Người dùng đang hoạt động
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Quản trị viên</CardTitle>
            <Shield className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{statistics.adminUsers}</div>
            <p className="text-xs text-muted-foreground">
              Có quyền quản trị
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bị khóa</CardTitle>
            <UserX className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{statistics.lockedUsers}</div>
            <p className="text-xs text-muted-foreground">
              Tài khoản bị khóa
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filter Bar */}
      <div className="bg-white border rounded-lg mb-6 shadow-sm">
        {/* Action Buttons - Inline */}
        <div className="flex flex-wrap gap-4 p-6 border-b border-gray-100 bg-gray-50/50">
          <Button
            variant={isFilterBarOpen ? "default" : "outline"}
            size="sm"
            onClick={() => setIsFilterBarOpen(!isFilterBarOpen)}
            className="flex items-center gap-2 shadow-sm hover:shadow-md transition-all duration-200"
          >
            <Filter className="h-4 w-4" />
            {isFilterBarOpen ? "Đóng bộ lọc" : "Mở bộ lọc"}
            {isFilterBarOpen ? (
              <span className="ml-1 text-sm">▼</span>
            ) : (
              <span className="ml-1 text-sm">▶</span>
            )}
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRefresh} 
            className="flex items-center gap-2 shadow-sm hover:shadow-md transition-all duration-200 hover:bg-blue-50 hover:border-blue-300"
          >
            <RefreshCw className="h-4 w-4" />
            Làm mới dữ liệu
          </Button>
        </div>

        {/* Collapsible Filter Content */}
        {isFilterBarOpen && (
          <div className="p-6 bg-white">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-2">Bộ lọc tìm kiếm</h3>
              <p className="text-sm text-gray-600">Sử dụng các bộ lọc bên dưới để tìm kiếm người dùng theo tiêu chí cụ thể</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="space-y-3">
                <Label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <Search className="h-4 w-4 text-blue-600" />
                  Tìm kiếm
                </Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Tìm theo tên, email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 h-11 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 rounded-lg shadow-sm"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <Shield className="h-4 w-4 text-purple-600" />
                  Vai trò
                </Label>
                <Select value={roleFilter} onValueChange={(value) => setRoleFilter(value as "all" | UserRole)}>
                  <SelectTrigger className="h-11 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 rounded-lg shadow-sm">
                    <SelectValue placeholder="Tất cả vai trò" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">👥 Tất cả vai trò</SelectItem>
                    <SelectItem value={UserRole.USER}>👤 Người dùng</SelectItem>
                    <SelectItem value={UserRole.ADMIN}>🛡️ Quản trị viên</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <Label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <UserCheck className="h-4 w-4 text-green-600" />
                  Trạng thái
                </Label>
                <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as "all" | UserStatus)}>
                  <SelectTrigger className="h-11 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 rounded-lg shadow-sm">
                    <SelectValue placeholder="Tất cả trạng thái" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">🔄 Tất cả trạng thái</SelectItem>
                    <SelectItem value={UserStatus.ACTIVE}>✅ Hoạt động</SelectItem>
                    <SelectItem value={UserStatus.INACTIVE}>⏸️ Không hoạt động</SelectItem>
                    <SelectItem value={UserStatus.LOCKED}>🔒 Bị khóa</SelectItem>
                    <SelectItem value={UserStatus.SUSPENDED}>⏳ Tạm khóa</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <Label className="text-sm font-semibold text-gray-700">&nbsp;</Label>
                <Button 
                  variant="outline" 
                  onClick={clearFilters} 
                  className="w-full h-11 border-gray-300 hover:bg-gray-50 hover:border-gray-400 rounded-lg shadow-sm transition-all duration-200"
                >
                  🗑️ Xóa bộ lọc
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bulk Actions */}
      {selectedUsers.length > 0 && (
        <div className="flex items-center gap-4 p-4 bg-blue-50 border border-blue-200 rounded-lg mb-6 shadow-sm">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></div>
            <Badge variant="secondary" className="bg-blue-100 text-blue-800 border-blue-300">
              {selectedUsers.length} người dùng đã chọn
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsBulkDialogOpen(true)}
              className="shadow-sm hover:shadow-md transition-all duration-200"
            >
              <MoreHorizontal className="h-4 w-4 mr-2" />
              Thao tác hàng loạt
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedUsers([])}
              className="shadow-sm hover:shadow-md transition-all duration-200"
            >
              Bỏ chọn
            </Button>
          </div>
        </div>
      )}

      {/* Users Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Danh sách người dùng</CardTitle>
            <div className="text-sm text-muted-foreground">
              Hiển thị {users.length} / {totalElements} người dùng
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin mr-2" />
              <span>Đang tải...</span>
            </div>
          ) : error ? (
            <div className="text-center py-8 text-red-600">
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
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Trang {currentPage + 1} / {totalPages}
              </div>
              <div className="flex items-center space-x-2">
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
          </CardContent>
        </Card>
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
