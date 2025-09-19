"use client"

import { useState } from "react"
import type { User } from "@/lib/types"
import { UserRole, UserStatus } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { MoreHorizontal, Edit, Trash2, Shield, UserCheck, UserX, Lock, Unlock } from "lucide-react"
import { format } from "date-fns"
import { vi } from "date-fns/locale"

interface UserTableProps {
  users: User[]
  selectedUsers: string[]
  onUserSelect: (userId: string, selected: boolean) => void
  onSelectAll: (selected: boolean) => void
  onEditUser: (user: User) => void
  onDeleteUser: (userId: string) => void
  onUpdateUserStatus: (userId: string, status: UserStatus) => void
  onUpdateUserRole: (userId: string, role: UserRole) => void
}

export function UserTable({
  users,
  selectedUsers,
  onUserSelect,
  onSelectAll,
  onEditUser,
  onDeleteUser,
  onUpdateUserStatus,
  onUpdateUserRole,
}: UserTableProps) {
  const [hoveredUser, setHoveredUser] = useState<string | null>(null)

  const getStatusBadgeVariant = (status: UserStatus) => {
    switch (status) {
      case UserStatus.ACTIVE:
        return "default"
      case UserStatus.INACTIVE:
        return "secondary"
      case UserStatus.LOCKED:
        return "destructive"
      case UserStatus.SUSPENDED:
        return "outline"
      default:
        return "secondary"
    }
  }

  const getStatusBadgeText = (status: UserStatus) => {
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

  const getRoleBadgeVariant = (role: UserRole) => {
    switch (role) {
      case UserRole.ADMIN:
        return "default"
      case UserRole.USER:
        return "secondary"
      default:
        return "secondary"
    }
  }

  const getRoleBadgeText = (role: UserRole) => {
    switch (role) {
      case UserRole.ADMIN:
        return "Quản trị viên"
      case UserRole.USER:
        return "Người dùng"
      default:
        return role
    }
  }

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "dd/MM/yyyy HH:mm", { locale: vi })
    } catch {
      return "N/A"
    }
  }

  const getUserInitials = (user: User) => {
    if (user.firstName && user.lastName) {
      return (user.firstName[0] + user.lastName[0]).toUpperCase()
    } else if (user.firstName) {
      return user.firstName[0].toUpperCase()
    } else if (user.lastName) {
      return user.lastName[0].toUpperCase()
    }
    return user.username[0].toUpperCase()
  }

  const getUserDisplayName = (user: User) => {
    if (user.firstName && user.lastName) {
      return `${user.lastName} ${user.firstName}`
    } else if (user.firstName) {
      return user.firstName
    } else if (user.lastName) {
      return user.lastName
    }
    return user.username
  }

  const allSelected = users.length > 0 && selectedUsers.length === users.length
  const someSelected = selectedUsers.length > 0 && selectedUsers.length < users.length

  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">
              <Checkbox
                checked={allSelected}
                onCheckedChange={onSelectAll}
              />
            </TableHead>
            <TableHead>Người dùng</TableHead>
            <TableHead>Vai trò</TableHead>
            <TableHead>Trạng thái</TableHead>
            <TableHead>Đăng nhập cuối</TableHead>
            <TableHead>Ngày tạo</TableHead>
            <TableHead className="w-12"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => (
            <TableRow
              key={user.id}
              className={`cursor-pointer transition-colors ${
                hoveredUser === user.id ? "bg-muted/50" : ""
              }`}
              onMouseEnter={() => setHoveredUser(user.id)}
              onMouseLeave={() => setHoveredUser(null)}
            >
              <TableCell>
                <Checkbox
                  checked={selectedUsers.includes(user.id)}
                  onCheckedChange={(checked) => onUserSelect(user.id, !!checked)}
                />
              </TableCell>
              <TableCell>
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-sm font-medium">
                    {getUserInitials(user)}
                  </div>
                  <div>
                    <div className="font-medium">{getUserDisplayName(user)}</div>
                    <div className="text-sm text-muted-foreground">
                      @{user.username}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {user.email}
                    </div>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <Badge variant={getRoleBadgeVariant(user.role)}>
                  {getRoleBadgeText(user.role)}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge variant={getStatusBadgeVariant(user.status)}>
                  {getStatusBadgeText(user.status)}
                </Badge>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {user.lastLogin ? formatDate(user.lastLogin) : "Chưa đăng nhập"}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {formatDate(user.createdAt)}
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onEditUser(user)}>
                      <Edit className="mr-2 h-4 w-4" />
                      Chỉnh sửa
                    </DropdownMenuItem>
                    
                    {user.status === UserStatus.ACTIVE ? (
                      <DropdownMenuItem onClick={() => onUpdateUserStatus(user.id, UserStatus.INACTIVE)}>
                        <UserX className="mr-2 h-4 w-4" />
                        Vô hiệu hóa
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem onClick={() => onUpdateUserStatus(user.id, UserStatus.ACTIVE)}>
                        <UserCheck className="mr-2 h-4 w-4" />
                        Kích hoạt
                      </DropdownMenuItem>
                    )}
                    
                    {user.status === UserStatus.LOCKED ? (
                      <DropdownMenuItem onClick={() => onUpdateUserStatus(user.id, UserStatus.ACTIVE)}>
                        <Unlock className="mr-2 h-4 w-4" />
                        Mở khóa
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem onClick={() => onUpdateUserStatus(user.id, UserStatus.LOCKED)}>
                        <Lock className="mr-2 h-4 w-4" />
                        Khóa tài khoản
                      </DropdownMenuItem>
                    )}
                    
                    {user.role === UserRole.USER ? (
                      <DropdownMenuItem onClick={() => onUpdateUserRole(user.id, UserRole.ADMIN)}>
                        <Shield className="mr-2 h-4 w-4" />
                        Cấp quyền Admin
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem onClick={() => onUpdateUserRole(user.id, UserRole.USER)}>
                        <UserX className="mr-2 h-4 w-4" />
                        Thu hồi quyền Admin
                      </DropdownMenuItem>
                    )}
                    
                    <DropdownMenuItem 
                      onClick={() => onDeleteUser(user.id)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Xóa
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      
      {users.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          Không có người dùng nào
        </div>
      )}
    </div>
  )
}
