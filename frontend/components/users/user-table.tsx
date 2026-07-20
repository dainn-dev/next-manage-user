"use client"

import { useState } from "react"
import type { User } from "@/lib/types"
import { UserRole, UserStatus } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
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
  onDeleteUser: (userId: string) => void | Promise<void>
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
  const [pendingDeletion, setPendingDeletion] = useState<User | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

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
      case UserRole.SITE_MANAGER:
        return "outline"
      case UserRole.SECURITY_GUARD:
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
      case UserRole.SITE_MANAGER:
        return "Site manager"
      case UserRole.SECURITY_GUARD:
        return "Security guard"
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
    if (user.fullName) {
      const names = user.fullName.trim().split(" ")
      return names.length >= 2
        ? (names[0][0] + names[names.length - 1][0]).toUpperCase()
        : names[0][0].toUpperCase()
    }
    return user.username[0].toUpperCase()
  }

  const getUserDisplayName = (user: User) => user.fullName || user.username
  const allSelected = users.length > 0 && selectedUsers.length === users.length
  const someSelected = selectedUsers.length > 0 && selectedUsers.length < users.length

  const confirmDeletion = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    if (!pendingDeletion || isDeleting) return

    setIsDeleting(true)
    await onDeleteUser(pendingDeletion.id)
    setIsDeleting(false)
    setPendingDeletion(null)
  }

  const actionMenu = (user: User) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-11"
          aria-label={`Thao tác với ${getUserDisplayName(user)}`}
        >
          <MoreHorizontal className="size-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onEditUser(user)}>
          <Edit className="mr-2 size-4" />
          Chỉnh sửa
        </DropdownMenuItem>
        {user.status === UserStatus.ACTIVE ? (
          <DropdownMenuItem onClick={() => onUpdateUserStatus(user.id, UserStatus.INACTIVE)}>
            <UserX className="mr-2 size-4" />
            Vô hiệu hóa
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onClick={() => onUpdateUserStatus(user.id, UserStatus.ACTIVE)}>
            <UserCheck className="mr-2 size-4" />
            Kích hoạt
          </DropdownMenuItem>
        )}
        {user.status === UserStatus.LOCKED ? (
          <DropdownMenuItem onClick={() => onUpdateUserStatus(user.id, UserStatus.ACTIVE)}>
            <Unlock className="mr-2 size-4" />
            Mở khóa
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onClick={() => onUpdateUserStatus(user.id, UserStatus.LOCKED)}>
            <Lock className="mr-2 size-4" />
            Khóa tài khoản
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={() => onUpdateUserRole(user.id, UserRole.ADMIN)}>
          <Shield className="mr-2 size-4" />
          Đặt Tenant admin
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onUpdateUserRole(user.id, UserRole.USER)}>
          <UserX className="mr-2 size-4" />
          Đặt Member
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setPendingDeletion(user)} className="text-destructive focus:text-destructive">
          <Trash2 className="mr-2 size-4" />
          Xóa
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )

  return (
    <>
      <div className="grid gap-3 md:hidden">
        {users.map((user) => (
          <article key={user.id} className="material-data-card" aria-label={`Người dùng ${getUserDisplayName(user)}`}>
            <header className="flex min-w-0 items-start gap-3">
              <Checkbox
                className="mt-1"
                checked={selectedUsers.includes(user.id)}
                onCheckedChange={(checked) => onUserSelect(user.id, !!checked)}
                aria-label={`Chọn ${getUserDisplayName(user)}`}
              />
              <div className="grid size-11 shrink-0 place-items-center rounded-full bg-primary-container text-sm font-semibold text-on-primary-container">
                {getUserInitials(user)}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-sm font-semibold text-foreground">{getUserDisplayName(user)}</h3>
                <p className="truncate text-xs text-muted-foreground">@{user.username}</p>
                <p className="truncate text-sm text-muted-foreground">{user.email}</p>
              </div>
              {actionMenu(user)}
            </header>
            <div className="flex flex-wrap gap-2">
              <Badge variant={getRoleBadgeVariant(user.role)}>{getRoleBadgeText(user.role)}</Badge>
              <Badge variant={getStatusBadgeVariant(user.status)}>{getStatusBadgeText(user.status)}</Badge>
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 border-t border-border pt-3 text-xs">
              <div className="min-w-0">
                <dt className="text-muted-foreground">Đăng nhập cuối</dt>
                <dd className="mt-0.5 truncate font-medium text-foreground">{user.lastLogin ? formatDate(user.lastLogin) : "Chưa đăng nhập"}</dd>
              </div>
              <div className="min-w-0">
                <dt className="text-muted-foreground">Ngày tạo</dt>
                <dd className="mt-0.5 truncate font-medium text-foreground">{formatDate(user.createdAt)}</dd>
              </div>
            </dl>
            <Button variant="tonal" className="w-full" onClick={() => onEditUser(user)}>
              <Edit className="size-4" />
              Chỉnh sửa người dùng
            </Button>
          </article>
        ))}
      </div>

      <div className="hidden md:block">
        <Table containerLabel="Danh sách người dùng" className="min-w-[54rem]">
          <TableHeader>
            <TableRow>
              <TableHead className="w-14">
                <Checkbox
                  checked={allSelected ? true : someSelected ? "indeterminate" : false}
                  onCheckedChange={(checked) => onSelectAll(checked === true)}
                  aria-label="Chọn tất cả người dùng trên trang"
                />
              </TableHead>
              <TableHead>Người dùng</TableHead>
              <TableHead>Vai trò</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead>Đăng nhập cuối</TableHead>
              <TableHead>Ngày tạo</TableHead>
              <TableHead className="w-14"><span className="sr-only">Thao tác</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow
                key={user.id}
                className={hoveredUser === user.id ? "bg-muted/50" : undefined}
                onMouseEnter={() => setHoveredUser(user.id)}
                onMouseLeave={() => setHoveredUser(null)}
              >
                <TableCell>
                  <Checkbox
                    checked={selectedUsers.includes(user.id)}
                    onCheckedChange={(checked) => onUserSelect(user.id, !!checked)}
                    aria-label={`Chọn ${getUserDisplayName(user)}`}
                  />
                </TableCell>
                <TableCell>
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="grid size-10 shrink-0 place-items-center rounded-full bg-primary-container text-sm font-semibold text-on-primary-container">
                      {getUserInitials(user)}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-medium">{getUserDisplayName(user)}</p>
                      <p className="truncate text-xs text-muted-foreground">@{user.username}</p>
                      <p className="truncate text-sm text-muted-foreground">{user.email}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell><Badge variant={getRoleBadgeVariant(user.role)}>{getRoleBadgeText(user.role)}</Badge></TableCell>
                <TableCell><Badge variant={getStatusBadgeVariant(user.status)}>{getStatusBadgeText(user.status)}</Badge></TableCell>
                <TableCell className="text-sm text-muted-foreground">{user.lastLogin ? formatDate(user.lastLogin) : "Chưa đăng nhập"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{formatDate(user.createdAt)}</TableCell>
                <TableCell>{actionMenu(user)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {users.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">Không có người dùng nào</p>}

      <AlertDialog open={!!pendingDeletion} onOpenChange={(open) => !open && !isDeleting && setPendingDeletion(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa người dùng?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDeletion
                ? `Bạn sắp xóa ${getUserDisplayName(pendingDeletion)}. Hành động này không thể hoàn tác.`
                : "Hành động này không thể hoàn tác."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Hủy</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
              onClick={confirmDeletion}
            >
              {isDeleting ? "Đang xóa…" : "Xóa người dùng"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
