"use client"

import { useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import Image from "next/image"
import {
  LayoutDashboard,
  Activity,
  ArrowLeftRight,
  DoorOpen,
  ListTree,
  Map as MapIcon,
  Camera,
  LayoutGrid,
  Car,
  FileCheck,
  BarChart3,
  UserCog,
  LogOut,
  type LucideIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/lib/auth-context"
import { useToast } from "@/hooks/use-toast"
import { UserRole } from "@/lib/types"
import { cn } from "@/lib/utils"

interface NavigationItem {
  key: string
  label: string
  icon?: LucideIcon
  /** Roles allowed to see this item. Undefined = visible to all roles. */
  roles?: UserRole[]
  /** Greenfield feature with no page yet — rendered disabled with a badge. */
  comingSoon?: boolean
}

interface NavigationGroup {
  label?: string
  items: NavigationItem[]
}

// ParkVision information architecture. Existing routes keep working; greenfield
// parking capabilities (Sites/Cameras/Maps/Slots/Events) appear as disabled
// "coming soon" entries so the target IA is visible without dead links.
const navigationGroups: NavigationGroup[] = [
  {
    items: [
      {
        key: "/dashboard",
        label: "Tổng quan",
        icon: LayoutDashboard,
        roles: [UserRole.ADMIN, UserRole.SECURITY_OFFICER, UserRole.APPROVER],
      },
    ],
  },
  {
    label: "Vận hành",
    items: [
      {
        key: "/vehicles/monitoring",
        label: "Giám sát",
        icon: Activity,
        roles: [UserRole.ADMIN, UserRole.SECURITY_OFFICER],
      },
      {
        key: "/vehicles/entry-exit",
        label: "Thông tin ra/vào",
        icon: ArrowLeftRight,
        roles: [UserRole.ADMIN, UserRole.SECURITY_OFFICER, UserRole.APPROVER],
      },
      {
        key: "/gate",
        label: "Cổng kiosk",
        icon: DoorOpen,
        roles: [UserRole.ADMIN, UserRole.SECURITY_OFFICER],
      },
      {
        key: "/events",
        label: "Sự kiện",
        icon: ListTree,
        comingSoon: true,
        roles: [UserRole.ADMIN, UserRole.SECURITY_OFFICER, UserRole.APPROVER],
      },
    ],
  },
  {
    label: "Bãi đỗ xe",
    items: [
      { key: "/parking/maps", label: "Sơ đồ bãi", icon: MapIcon, comingSoon: true, roles: [UserRole.ADMIN, UserRole.SECURITY_OFFICER, UserRole.APPROVER] },
      { key: "/parking/cameras", label: "Camera", icon: Camera, comingSoon: true, roles: [UserRole.ADMIN, UserRole.SECURITY_OFFICER, UserRole.APPROVER] },
      { key: "/parking/slots", label: "Ô đỗ xe", icon: LayoutGrid, comingSoon: true, roles: [UserRole.ADMIN, UserRole.SECURITY_OFFICER, UserRole.APPROVER] },
    ],
  },
  {
    label: "Phương tiện",
    items: [
      { key: "/vehicles", label: "Danh sách xe", icon: Car },
      { key: "/vehicles/requests", label: "Yêu cầu ra/vào", icon: FileCheck },
    ],
  },
  {
    label: "Phân tích",
    items: [
      { key: "/statistics", label: "Thống kê", icon: BarChart3 },
    ],
  },
  {
    label: "Quản trị",
    items: [
      { key: "/users", label: "Quản lý người dùng", icon: UserCog, roles: [UserRole.ADMIN] },
    ],
  },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)
  const { user, logout } = useAuth()
  const { toast } = useToast()

  // Filter items by role; drop empty groups.
  const filteredGroups = navigationGroups
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) => !item.roles || (user?.role ? item.roles.includes(user.role) : false)
      ),
    }))
    .filter((group) => group.items.length > 0)

  const handleMenuClick = (key: string) => {
    router.push(key)
  }

  const handleLogout = async () => {
    try {
      await logout()
      toast({
        title: "Đăng xuất thành công",
        description: "Bạn đã đăng xuất khỏi hệ thống",
      })
      router.push("/login")
    } catch {
      toast({
        title: "Lỗi đăng xuất",
        description: "Có lỗi xảy ra khi đăng xuất",
        variant: "destructive",
      })
    }
  }

  const getUserInitials = () => {
    if (!user) return "U"
    if (user.fullName) {
      const names = user.fullName.trim().split(' ')
      if (names.length >= 2) {
        return (names[0][0] + names[names.length - 1][0]).toUpperCase()
      } else {
        return names[0][0].toUpperCase()
      }
    }
    return user.username[0].toUpperCase()
  }

  const navButtonClass = (isActive: boolean) =>
    cn(
      "w-full text-left px-3 py-2 rounded-md transition-colors duration-200 flex items-center gap-3 text-sm font-medium",
      isActive
        ? "bg-sidebar-accent text-sidebar-accent-foreground"
        : "text-sidebar-foreground hover:bg-muted hover:text-sidebar-foreground"
    )

  const renderNavItem = (item: NavigationItem) => {
    const Icon = item.icon
    const isActive = pathname === item.key

    // Coming-soon (greenfield parking features): disabled, no navigation
    if (item.comingSoon) {
      return (
        <button
          key={item.key}
          disabled
          title={`${item.label} — sắp ra mắt`}
          aria-label={`${item.label} (sắp ra mắt)`}
          className="w-full cursor-not-allowed text-left px-3 py-2 rounded-md flex items-center gap-3 text-sm font-medium text-muted-foreground/70 opacity-70"
        >
          {Icon && <Icon className="h-4 w-4 shrink-0" />}
          {!collapsed && <span className="flex-1">{item.label}</span>}
          {!collapsed && (
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
              Sắp ra mắt
            </span>
          )}
        </button>
      )
    }

    // Regular nav item
    return (
      <button
        key={item.key}
        onClick={() => handleMenuClick(item.key)}
        title={item.label}
        className={navButtonClass(isActive)}
      >
        {Icon && <Icon className="h-4 w-4 shrink-0" />}
        {!collapsed && <span className="flex-1 text-left">{item.label}</span>}
      </button>
    )
  }

  return (
    <div
      className={`bg-sidebar border-r border-sidebar-border h-screen transition-all duration-300 ${collapsed ? "w-16" : "w-64"} flex flex-col shadow-sm`}
    >
      <div className="p-6 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className={`${collapsed ? "w-10 h-10" : "w-12 h-12"} rounded-xl overflow-hidden flex items-center justify-center bg-white/10 backdrop-blur-sm border border-white/20 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105`}>
            <Image
              src="/logo.jpg"
              alt="ParkVision Smart Parking"
              width={collapsed ? 40 : 48}
              height={collapsed ? 40 : 48}
              className="object-contain p-1"
              priority
            />
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <h4 className="font-bold text-sidebar-foreground text-lg tracking-tight">ParkVision</h4>
              <p className="text-xs text-muted-foreground font-medium">Smart Parking</p>
            </div>
          )}
        </div>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="mt-4 p-2 hover:bg-muted rounded-lg transition-all duration-200 text-muted-foreground hover:text-sidebar-foreground hover:scale-105 active:scale-95"
          title={collapsed ? "Mở rộng sidebar" : "Thu gọn sidebar"}
          aria-label={collapsed ? "Mở rộng sidebar" : "Thu gọn sidebar"}
        >
          <div className="flex items-center justify-center w-5 h-5">
            {collapsed ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7 -7 7 -7" />
              </svg>
            )}
          </div>
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto p-4 space-y-4">
        {filteredGroups.map((group) => (
          <div key={group.label || "main"} className="space-y-1">
            {!collapsed && group.label && (
              <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {group.label}
              </p>
            )}
            {group.items.map((item) => renderNavItem(item))}
          </div>
        ))}
      </nav>

      <div className="p-6 border-t border-sidebar-border">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 bg-sidebar-accent rounded-full flex items-center justify-center text-sidebar-accent-foreground text-sm font-medium">
            {getUserInitials()}
          </div>
          {!collapsed && (
            <div className="flex-1">
              <span className="text-sm font-medium text-sidebar-foreground">
                {user?.fullName
                  ? user.fullName
                  : user?.username || "Người dùng"}
              </span>
              <p className="text-xs text-muted-foreground">
                {user?.role || "Người dùng"}
              </p>
            </div>
          )}
        </div>
        {!collapsed && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="w-full justify-start text-muted-foreground hover:text-sidebar-foreground hover:bg-muted"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Đăng xuất
          </Button>
        )}
        {collapsed && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="w-full p-2 text-muted-foreground hover:text-sidebar-foreground hover:bg-muted"
            title="Đăng xuất"
            aria-label="Đăng xuất"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  )
}
