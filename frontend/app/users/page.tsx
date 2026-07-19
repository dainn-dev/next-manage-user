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
import { AdminPage, AdminPageHeader } from "@/components/layout/admin-page"
import { cn } from "@/lib/utils"
import { 
  Search, 
  Plus, 
  RefreshCw, 
  Users, 
  UserCheck, 
  UserX, 
  Shield, 
  MoreHorizontal,
  X,
  SlidersHorizontal,
  Activity,
  Cpu,
  Layers,
  Database,
  ShieldCheck,
  Loader2,
  Unlock,
  Lock
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

interface MetricCardProps {
  label: string
  code: string
  value: number | string
  note: string
  icon: any
  color?: "cyan" | "emerald" | "amber" | "rose" | "slate"
}

function MetricCard({
  label,
  code,
  value,
  note,
  icon: Icon,
  color = "cyan"
}: MetricCardProps) {
  const colorMap = {
    cyan: {
      text: "text-cyan-400",
      border: "border-cyan-500/20 hover:border-cyan-500/40",
      bg: "bg-cyan-950/10",
      glow: "shadow-[0_0_15px_rgba(6,182,212,0.15)]"
    },
    emerald: {
      text: "text-emerald-400",
      border: "border-emerald-500/20 hover:border-emerald-500/40",
      bg: "bg-emerald-950/10",
      glow: "shadow-[0_0_15px_rgba(16,185,129,0.15)]"
    },
    amber: {
      text: "text-amber-400",
      border: "border-amber-500/20 hover:border-amber-500/40",
      bg: "bg-amber-950/10",
      glow: "shadow-[0_0_15px_rgba(245,158,11,0.15)]"
    },
    rose: {
      text: "text-rose-400",
      border: "border-rose-500/20 hover:border-rose-500/40",
      bg: "bg-rose-950/10",
      glow: "shadow-[0_0_15px_rgba(244,63,94,0.15)]"
    },
    slate: {
      text: "text-slate-400",
      border: "border-slate-800 hover:border-slate-700",
      bg: "bg-slate-950/10",
      glow: ""
    }
  }

  const activeColor = colorMap[color]

  return (
    <div
      className={cn(
        "border bg-slate-950/40 text-slate-100 shadow-xl rounded-xl p-5 relative overflow-hidden backdrop-blur-xl transition-all duration-300 group",
        activeColor.border
      )}
    >
      {/* Sci-fi tech corner ticks */}
      <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-slate-850 group-hover:border-cyan-500/30 transition-colors" />
      <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-slate-850 group-hover:border-cyan-500/30 transition-colors" />
      <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-slate-850 group-hover:border-cyan-500/30 transition-colors" />
      <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-slate-850 group-hover:border-cyan-500/30 transition-colors" />

      <div className="flex items-center justify-between gap-2 border-b border-slate-900/60 pb-3 mb-3">
        <div className="space-y-0.5">
          <p className="font-mono text-[9px] tracking-widest text-slate-500 uppercase">{code}</p>
          <p className="text-[11px] font-mono tracking-wide text-slate-300 uppercase">{label}</p>
        </div>
        <div className={cn("p-2 rounded-lg bg-slate-950/80 border border-slate-900", activeColor.text, activeColor.glow)}>
          <Icon className="h-4 w-4" aria-hidden="true" />
        </div>
      </div>

      <p className="text-2xl font-mono font-bold text-white tracking-tight select-all">
        {value}
      </p>
      <p className="text-[10px] font-mono text-slate-500 mt-1 leading-normal uppercase">
        {note}
      </p>
    </div>
  )
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

  if (!isAdmin) {
    return (
      <AdminPage size="narrow" className="justify-center min-h-dvh flex items-center">
        <Card className="mx-auto max-w-lg border border-rose-500/20 bg-slate-950/40 text-slate-100 shadow-2xl relative overflow-hidden backdrop-blur-xl">
          {/* Cyber ticks */}
          <div className="absolute top-0 left-0 w-2.5 h-2.5 border-t-2 border-l-2 border-rose-500/30" />
          <div className="absolute top-0 right-0 w-2.5 h-2.5 border-t-2 border-r-2 border-rose-500/30" />
          <div className="absolute bottom-0 left-0 w-2.5 h-2.5 border-b-2 border-l-2 border-rose-500/30" />
          <div className="absolute bottom-0 right-0 w-2.5 h-2.5 border-b-2 border-r-2 border-rose-500/30" />

          <CardContent className="flex flex-col items-center gap-5 p-8 text-center relative z-10">
            <div className="p-4 rounded-full bg-slate-950/80 border border-slate-900 text-rose-400 shadow-[0_0_20px_rgba(244,63,94,0.15)] animate-pulse">
              <Shield className="h-8 w-8" aria-hidden="true" />
            </div>
            <div className="space-y-2">
              <h1 className="text-sm font-mono tracking-widest text-rose-400 uppercase">
                {"ACCESS_DENIED // KHÔNG CÓ QUYỀN TRUY CẬP"}
              </h1>
              <p className="text-xs font-mono text-slate-400 uppercase leading-relaxed max-w-sm">
                Tài khoản của bạn không sở hữu đặc quyền quản trị cấp cao. Vui lòng liên hệ với quản trị viên hệ thống để yêu cầu cấp quyền.
              </p>
            </div>
          </CardContent>
        </Card>
      </AdminPage>
    )
  }

  return (
    <AdminPage className="min-h-dvh">
      <AdminPageHeader
        eyebrow="MODULE // HỆ THỐNG"
        title="QUẢN LÝ NGƯỜI DÙNG"
        description="Quản trị cơ sở dữ liệu tài khoản, phân quyền vai trò (Role-based access control) và giám sát trạng thái bảo mật của thành viên tổ chức."
        className="grid-cols-[minmax(0,1fr)_auto] items-start"
        actions={
          <div className="flex shrink-0 items-start justify-end gap-2.5">
            <Button
              variant="outline"
              size="icon"
              onClick={handleRefresh}
              disabled={loading}
              className="h-10 w-10 border-slate-800 bg-slate-950/40 text-slate-300 hover:text-white hover:bg-slate-900 rounded-xl p-0 transition-all shadow-none shrink-0"
              aria-label="Làm mới"
              title="Làm mới"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
            <Button
              onClick={() => setIsFormOpen(true)}
              className="bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-mono font-bold uppercase tracking-wider text-xs h-10 px-4 rounded-xl transition-all shadow-lg hover:shadow-cyan-500/20 flex items-center justify-center gap-1.5"
            >
              <Plus className="h-4 w-4 text-slate-950" />
              <span>ADD_USER</span>
            </Button>
          </div>
        }
      />

      <div className="space-y-8 mt-4">
        {/* Section 1: Dynamic Metrics Cards Strip */}
        <section aria-label="Tổng quan thông số tài khoản" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="Tổng thành viên"
            code="SYS_USERS_REGISTERED"
            value={statistics.totalUsers}
            note="Tổng tài khoản đăng ký trong tổ chức"
            icon={Users}
            color="cyan"
          />
          <MetricCard
            label="Đang hoạt động"
            code="ACTIVE_CONNECTION_NODES"
            value={statistics.activeUsers}
            note="Tài khoản sẵn sàng vận hành"
            icon={UserCheck}
            color="emerald"
          />
          <MetricCard
            label="Quản trị viên"
            code="AUTH_LEVEL_ADMIN"
            value={statistics.adminUsers}
            note="Sở hữu toàn quyền quản trị"
            icon={Shield}
            color="cyan"
          />
          <MetricCard
            label="Tài khoản bị khóa"
            code="LOCKED_ACCESS_NODES"
            value={statistics.lockedUsers}
            note="Truy cập bị đình chỉ bảo mật"
            icon={UserX}
            color="rose"
          />
        </section>

        {/* Section 2: Advanced Dynamic Filters Toolbar */}
        <section aria-label="Bộ lọc tài khoản" className="border border-slate-800 bg-slate-955/60 p-4 rounded-xl relative overflow-hidden backdrop-blur-xl flex flex-col md:flex-row items-center gap-4 group">
          <div className="absolute top-0 left-0 w-1.5 h-1.5 border-t border-l border-slate-700 group-hover:border-cyan-500/30 transition-colors" />
          <div className="absolute top-0 right-0 w-1.5 h-1.5 border-t border-r border-slate-700 group-hover:border-cyan-500/30 transition-colors" />
          <div className="absolute bottom-0 left-0 w-1.5 h-1.5 border-b border-l border-slate-700 group-hover:border-cyan-500/30 transition-colors" />
          <div className="absolute bottom-0 right-0 w-1.5 h-1.5 border-b border-r border-slate-700 group-hover:border-cyan-500/30 transition-colors" />

          <div className="relative min-w-0 flex-1 w-full">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
            <Input
              aria-label="Tìm người dùng"
              placeholder="TÌM THEO TÊN, EMAIL HOẶC USERNAME..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="bg-slate-950/70 border-slate-800 text-cyan-100 placeholder-slate-700 font-mono h-11 pl-10 rounded-lg focus-visible:ring-cyan-500/30 focus-visible:border-cyan-500/30 tracking-wide text-xs"
            />
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
            <Select value={roleFilter} onValueChange={(value) => setRoleFilter(value as "all" | UserRole)}>
              <SelectTrigger className="w-full sm:w-48 bg-slate-950/60 border-slate-800 text-slate-200 font-mono h-11 rounded-lg text-xs" aria-label="Lọc theo vai trò">
                <SelectValue placeholder="VAI TRÒ" />
              </SelectTrigger>
              <SelectContent className="bg-slate-950 border-slate-800 text-slate-200">
                <SelectItem value="all" className="focus:bg-slate-900 font-mono text-xs">Tất cả vai trò</SelectItem>
                <SelectItem value={UserRole.USER} className="focus:bg-slate-900 font-mono text-xs">Người dùng</SelectItem>
                <SelectItem value={UserRole.ADMIN} className="focus:bg-slate-900 font-mono text-xs">Quản trị viên</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as "all" | UserStatus)}>
              <SelectTrigger className="w-full sm:w-48 bg-slate-950/60 border-slate-800 text-slate-200 font-mono h-11 rounded-lg text-xs" aria-label="Lọc theo trạng thái">
                <SelectValue placeholder="TRẠNG THÁI" />
              </SelectTrigger>
              <SelectContent className="bg-slate-950 border-slate-800 text-slate-200">
                <SelectItem value="all" className="focus:bg-slate-900 font-mono text-xs">Tất cả trạng thái</SelectItem>
                <SelectItem value={UserStatus.ACTIVE} className="focus:bg-slate-900 font-mono text-xs">Hoạt động</SelectItem>
                <SelectItem value={UserStatus.INACTIVE} className="focus:bg-slate-900 font-mono text-xs">Không hoạt động</SelectItem>
                <SelectItem value={UserStatus.LOCKED} className="focus:bg-slate-900 font-mono text-xs">Bị khóa</SelectItem>
                <SelectItem value={UserStatus.SUSPENDED} className="focus:bg-slate-900 font-mono text-xs">Tạm khóa</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              onClick={clearFilters}
              className="w-full sm:w-auto border-slate-800 bg-slate-950/40 text-slate-400 hover:text-white hover:bg-slate-900 font-mono text-xs h-11 px-4 rounded-lg flex items-center justify-center gap-1.5"
            >
              <X className="h-3.5 w-3.5" />
              <span>CLEAR</span>
            </Button>
          </div>
        </section>

        {/* Section 3: Selected Pipeline Strip */}
        {selectedUsers.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border border-cyan-500/30 bg-slate-950/80 rounded-xl relative overflow-hidden backdrop-blur-xl shadow-[0_0_20px_rgba(6,182,212,0.1)] animate-in fade-in-50 duration-200">
            {/* Pulsing indicator */}
            <div className="absolute top-0 left-0 w-1 h-full bg-cyan-500 animate-pulse" />
            
            <div className="flex items-center gap-3">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-500" />
              </span>
              <div className="space-y-0.5">
                <p className="font-mono text-[9px] tracking-widest text-slate-500 uppercase">BULK_OPERATIONS_PIPELINE</p>
                <p className="text-xs font-mono font-bold text-cyan-400 uppercase">
                  {selectedUsers.length} TÀI KHOẢN ĐƯỢC CHỌN TRONG SESSION
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsBulkDialogOpen(true)}
                className="border-cyan-500/20 bg-slate-950 text-cyan-400 hover:text-cyan-300 hover:bg-slate-900/60 font-mono text-[10px] uppercase h-9 px-4 rounded-lg flex items-center gap-1.5 shadow-sm"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                EXECUTE_BATCH
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedUsers([])}
                className="border-slate-800 bg-slate-950 text-slate-400 hover:text-slate-300 hover:bg-slate-900 font-mono text-[10px] uppercase h-9 px-4 rounded-lg flex items-center gap-1.5"
              >
                <X className="h-3.5 w-3.5" />
                CLEAR
              </Button>
            </div>
          </div>
        )}

        {/* Section 4: Main Registry Table Surface */}
        <section className="border border-slate-800 bg-slate-950/40 text-slate-100 shadow-xl rounded-xl relative overflow-hidden backdrop-blur-xl animate-in fade-in-60 duration-300" aria-label="Danh sách người dùng">
          {/* Cyber ticks */}
          <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-slate-800" />
          <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-slate-800" />
          <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-slate-800" />
          <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-slate-800" />

          {/* Cyber grid overlay */}
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.005)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.005)_1px,transparent_1px)] bg-[size:20px_20px] pointer-events-none opacity-20" />

          <div className="border-b border-slate-900 px-5 py-4 sm:px-6 flex items-center justify-between relative z-10">
            <div>
              <h2 className="text-xs font-mono tracking-wider text-cyan-400 uppercase">{"USER_REGISTRY // CƠ SỞ DỮ LIỆU TÀI KHOẢN"}</h2>
              <p className="mt-1 font-mono text-[10px] text-slate-500 uppercase">
                Hiển thị {users.length} tài khoản trong tổng số {totalElements} bản ghi thuộc hệ thống.
              </p>
            </div>
            <span className="font-mono text-[9px] text-slate-500 uppercase tracking-widest hidden sm:inline">{"[NODE_DWELL: ONLINE_STRICT]"}</span>
          </div>

          <div className="min-w-0 relative z-10">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16 gap-2 font-mono text-xs text-cyan-400 bg-slate-950/10">
                <Loader2 className="h-5 w-5 animate-spin text-cyan-500" />
                <span className="animate-pulse tracking-widest text-[10px] uppercase mt-1">FETCHING_DATABASE_STATE...</span>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-16 text-rose-400 font-mono text-xs">
                <p className="uppercase font-bold">[!] ERROR_FETCH_FAILURE</p>
                <p className="text-[11px] text-slate-500 mt-1">{error}</p>
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

          {/* High-Tech Pagination controls */}
          {totalPages > 1 && (
            <div className="border-t border-slate-900 bg-slate-950/50 p-4 flex flex-col sm:flex-row items-center justify-between gap-4 relative z-10">
              <span className="font-mono text-[10px] text-slate-500 uppercase tracking-widest">
                {"[PAGE: "}{currentPage + 1}{" // TOTAL_SEGMENTS: "}{totalPages}{"]"}
              </span>
              <div className="flex flex-wrap gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(0)}
                  disabled={currentPage === 0}
                  className="border-slate-800 bg-slate-950 text-slate-300 hover:text-white font-mono text-[10px] uppercase h-8 px-3 rounded-lg"
                >
                  FIRST
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(currentPage - 1)}
                  disabled={currentPage === 0}
                  className="border-slate-800 bg-slate-950 text-slate-300 hover:text-white font-mono text-[10px] uppercase h-8 px-3 rounded-lg"
                >
                  PREV
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(currentPage + 1)}
                  disabled={currentPage === totalPages - 1}
                  className="border-slate-800 bg-slate-950 text-slate-300 hover:text-white font-mono text-[10px] uppercase h-8 px-3 rounded-lg"
                >
                  NEXT
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(totalPages - 1)}
                  disabled={currentPage === totalPages - 1}
                  className="border-slate-800 bg-slate-950 text-slate-300 hover:text-white font-mono text-[10px] uppercase h-8 px-3 rounded-lg"
                >
                  LAST
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
