"use client"

import React, { useState, useEffect } from "react"
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
  Users,
  Building2,
  Briefcase,
  Car,
  FileCheck,
  BarChart3,
  UserCog,
  ChevronDown,
  LogOut,
  type LucideIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useAuth } from "@/lib/auth-context"
import { useToast } from "@/hooks/use-toast"
import { UserRole } from "@/lib/types"
import { positionApi, type PositionApiResponse } from "@/lib/api/position-api"
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
    label: "Nhân sự",
    items: [
      { key: "/employees", label: "Quân nhân", icon: Users },
      { key: "/departments", label: "Cơ quan, đơn vị", icon: Building2 },
      { key: "/positions", label: "Chức vụ", icon: Briefcase },
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
  const [positions, setPositions] = useState<PositionApiResponse[]>([])
  const [loadingPositions, setLoadingPositions] = useState(false)
  const { user, logout } = useAuth()
  const { toast } = useToast()

  // Load positions from API
  useEffect(() => {
    const loadPositions = async () => {
      try {
        setLoadingPositions(true)
        const positionsData = await positionApi.getPositionMenuHierarchy()
        setPositions(positionsData)
      } catch (error) {
        console.error('Failed to load positions:', error)
        // Don't show toast error on component mount to avoid spam
        // User will see "Không có dữ liệu" in the dropdown instead
      } finally {
        setLoadingPositions(false)
      }
    }

    // Load positions when component mounts
    loadPositions()
  }, [toast])

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
    } catch (error) {
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

  // Convert position API response to navigation path
  const getPositionPath = (position: PositionApiResponse, parentPath = "/positions"): string => {
    // Create a URL-friendly slug from the position name
    const slug = position.name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "") // Remove combining diacritical marks (accents)
      .replace(/[^a-z0-9\s-]/g, "") // Remove special characters
      .replace(/\s+/g, "-") // Replace spaces with hyphens
      .trim()

    return `${parentPath}/${slug}`
  }

  // Handle position menu click based on filterBy property
  const handlePositionClick = (position: PositionApiResponse) => {
    if (position.filterBy === 'N_A') {
      // Don't allow clicking for N/A positions
      return
    }

    if (position.filterBy === 'CHUC_VU') {
      // Navigate to employees page with position filter using position ID for hierarchical context
      router.push(`/employees?positionId=${position.id}`)
    } else if (position.filterBy === 'CO_QUAN_DON_VI') {
      // Navigate to employees page with department filter
      router.push(`/employees?department=${encodeURIComponent(position.name)}`)
    } else {
      // Default behavior - navigate to position page
      const positionPath = getPositionPath(position)
      router.push(positionPath)
    }
  }

  // Render position dropdown menu items recursively
  const renderPositionMenuItems = (positions: PositionApiResponse[]): React.ReactNode => {
    return positions.map((position) => {
      const hasChildren = position.children && position.children.length > 0
      const isClickable = position.filterBy !== 'N_A'

      if (hasChildren) {
        return (
          <DropdownMenuSub key={position.id}>
            <DropdownMenuSubTrigger>
              <span>{position.name}</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {renderPositionMenuItems(position.children!)}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )
      }

      return (
        <DropdownMenuItem
          key={position.id}
          onClick={() => isClickable ? handlePositionClick(position) : undefined}
          className={`${
            pathname === getPositionPath(position) || pathname.startsWith(getPositionPath(position))
              ? "bg-sidebar-accent text-sidebar-accent-foreground"
              : ""
          } ${!isClickable ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
          disabled={!isClickable}
        >
          {position.name}
          {!isClickable && (
            <span className="ml-2 text-xs text-muted-foreground">(N/A)</span>
          )}
        </DropdownMenuItem>
      )
    })
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

    // Positions: API-driven hierarchical dropdown (expanded mode only)
    if (item.key === "/positions" && !collapsed) {
      return (
        <DropdownMenu key={item.key}>
          <DropdownMenuTrigger asChild>
            <button
              className={cn(
                navButtonClass(pathname.startsWith(item.key)),
                "cursor-pointer"
              )}
            >
              {Icon && <Icon className="h-4 w-4 shrink-0" />}
              <span className="flex-1">{item.label}</span>
              <ChevronDown className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            {loadingPositions ? (
              <DropdownMenuItem disabled>
                <span>Đang tải...</span>
              </DropdownMenuItem>
            ) : positions.length > 0 ? (
              renderPositionMenuItems(positions)
            ) : (
              <>
                <DropdownMenuItem onClick={() => handleMenuClick("/positions")}>
                  <span>Tất cả chức vụ</span>
                </DropdownMenuItem>
                <DropdownMenuItem disabled>
                  <span className="text-xs text-muted-foreground">Không thể tải menu phân cấp</span>
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )
    }

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
