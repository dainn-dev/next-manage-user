"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  Activity,
  ArrowLeftRight,
  BarChart3,
  Building2,
  Camera,
  Car,
  CircleParking,
  CreditCard,
  DoorOpen,
  LayoutDashboard,
  LayoutGrid,
  ListTree,
  LogOut,
  Map as MapIcon,
  MapPinned,
  PanelLeftClose,
  PanelLeftOpen,
  ScanLine,
  ScrollText,
  Settings,
  Shield,
  UserCog,
  Wrench,
  X,
  type LucideIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/lib/auth-context"
import { useToast } from "@/hooks/use-toast"
import { UserRole, isPlatformAdmin, isMember } from "@/lib/types"
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

/** Tenant ops IA — hidden from PLATFORM_ADMIN (SaaS operator console). */
const OPS = [UserRole.ADMIN, UserRole.SITE_MANAGER, UserRole.SECURITY_GUARD]
const MANAGERS = [UserRole.ADMIN, UserRole.SITE_MANAGER]
const TENANT_ADMIN_ONLY = [UserRole.ADMIN]
const MEMBER_ONLY = [UserRole.USER]

const memberNavigationGroups: NavigationGroup[] = [
  {
    items: [
      { key: "/me", label: "Xe của tôi", icon: Car, roles: MEMBER_ONLY },
      { key: "/me/orgs", label: "Đăng ký tại org", icon: Building2, roles: MEMBER_ONLY },
      { key: "/me/visit", label: "Visit / QR", icon: ScanLine, roles: MEMBER_ONLY },
      { key: "/me/history", label: "Lịch sử", icon: ArrowLeftRight, roles: MEMBER_ONLY },
      { key: "/me/account", label: "Tài khoản", icon: UserCog, roles: MEMBER_ONLY },
    ],
  },
]

const tenantNavigationGroups: NavigationGroup[] = [
  {
    items: [
      {
        key: "/dashboard",
        label: "Tổng quan",
        icon: LayoutDashboard,
        roles: OPS,
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
        roles: OPS,
      },
      {
        key: "/vehicles/entry-exit",
        label: "Thông tin ra/vào",
        icon: ArrowLeftRight,
        roles: MANAGERS,
      },
      {
        key: "/gate",
        label: "Cổng kiosk",
        icon: DoorOpen,
        roles: MANAGERS,
      },
      {
        key: "/events",
        label: "Sự kiện",
        icon: ListTree,
        roles: OPS,
      },
    ],
  },
  {
    label: "Bãi đỗ xe",
    items: [
      { key: "/parking/maps", label: "Sơ đồ bãi", icon: MapIcon, roles: OPS },
      { key: "/parking/cameras", label: "Camera", icon: Camera, roles: OPS },
      { key: "/parking/commissioning", label: "Thiết lập bãi đỗ", icon: Wrench, roles: MANAGERS },
      { key: "/parking/slots", label: "Ô đỗ xe", icon: LayoutGrid, comingSoon: true, roles: OPS },
    ],
  },
  {
    label: "Phương tiện",
    items: [
      { key: "/vehicles/search", label: "Tìm biển số", icon: ScanLine, roles: OPS },
      { key: "/vehicles", label: "Danh sách xe", icon: Car, roles: MANAGERS },
    ],
  },
  {
    label: "Phân tích",
    items: [
      { key: "/statistics", label: "Thống kê", icon: BarChart3, roles: MANAGERS },
    ],
  },
  {
    label: "Quản trị",
    items: [
      {
        key: "/settings/organization",
        label: "Tổ chức",
        icon: Settings,
        roles: TENANT_ADMIN_ONLY,
      },
      {
        key: "/sites",
        label: "Khu vực (Sites)",
        icon: MapPinned,
        roles: TENANT_ADMIN_ONLY,
      },
      {
        key: "/billing",
        label: "Thanh toán",
        icon: CreditCard,
        roles: TENANT_ADMIN_ONLY,
      },
      { key: "/users", label: "Quản lý người dùng", icon: UserCog, roles: TENANT_ADMIN_ONLY },
    ],
  },
]

/** Platform operator IA — PLATFORM_ADMIN only. */
const platformNavigationGroups: NavigationGroup[] = [
  {
    label: "Platform",
    items: [
      {
        key: "/platform/overview",
        label: "Overview",
        icon: LayoutDashboard,
        roles: [UserRole.PLATFORM_ADMIN],
      },
      {
        key: "/platform/tenants",
        label: "Tenants",
        icon: Building2,
        roles: [UserRole.PLATFORM_ADMIN],
      },
      {
        key: "/platform/billing",
        label: "Billing",
        icon: CreditCard,
        roles: [UserRole.PLATFORM_ADMIN],
      },
      {
        key: "/platform/admins",
        label: "Admins",
        icon: Shield,
        roles: [UserRole.PLATFORM_ADMIN],
      },
      {
        key: "/platform/audit",
        label: "Audit",
        icon: ScrollText,
        roles: [UserRole.PLATFORM_ADMIN],
      },
    ],
  },
]

function roleLabel(role?: UserRole): string {
  switch (role) {
    case UserRole.PLATFORM_ADMIN:
      return "Platform admin"
    case UserRole.ADMIN:
      return "Tenant admin"
    case UserRole.SITE_MANAGER:
      return "Site manager"
    case UserRole.SECURITY_GUARD:
      return "Security guard"
    case UserRole.USER:
      return "Member"
    default:
      return "Người dùng"
  }
}

interface SidebarProps {
  mobileOpen?: boolean
  onMobileClose?: () => void
}

export function Sidebar({ mobileOpen = false, onMobileClose }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)
  // A mobile drawer must always expose labels, even when this user previously
  // chose the compact desktop rail.
  const compact = collapsed && !mobileOpen
  const { user, logout } = useAuth()
  const { toast } = useToast()

  const memberUser = isMember(user?.role)
  const brandHref = memberUser ? "/me" : "/dashboard"
  const brandSubtitle = memberUser ? "Thành viên" : "Smart Parking"
  const brandAriaLabel = memberUser
    ? "ParkVision, về khu vực thành viên"
    : "ParkVision, về trang tổng quan"
  const navigationGroups = isPlatformAdmin(user?.role)
    ? platformNavigationGroups
    : memberUser
      ? memberNavigationGroups
      : tenantNavigationGroups

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
    onMobileClose?.()
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
      "flex min-h-11 w-full items-center rounded-lg text-sm font-medium transition-colors duration-200",
      compact ? "justify-center px-0" : "gap-3 px-3 text-left",
      isActive
        ? "bg-sidebar-accent text-sidebar-accent-foreground"
        : "text-sidebar-foreground hover:bg-muted hover:text-sidebar-foreground"
    )

  const renderNavItem = (item: NavigationItem) => {
    const Icon = item.icon
    const isActive = pathname === item.key || (item.key !== "/" && pathname?.startsWith(item.key + "/"))

    // Coming-soon (greenfield parking features): disabled, no navigation
    if (item.comingSoon) {
      return (
        <button
          key={item.key}
          type="button"
          disabled
          title={compact ? `${item.label} — sắp ra mắt` : undefined}
          aria-label={`${item.label} (sắp ra mắt)`}
          className={cn(
            "flex min-h-11 w-full cursor-not-allowed items-center rounded-lg text-sm font-medium text-muted-foreground/70 opacity-70",
            compact ? "justify-center px-0" : "gap-3 px-3 text-left"
          )}
        >
          {Icon && <Icon className="h-4 w-4 shrink-0" />}
          {!compact && <span className="flex-1">{item.label}</span>}
          {!compact && (
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
              Sắp ra mắt
            </span>
          )}
        </button>
      )
    }

    return (
      <button
        key={item.key}
        type="button"
        onClick={() => handleMenuClick(item.key)}
        title={compact ? item.label : undefined}
        aria-label={item.label}
        aria-current={isActive ? "page" : undefined}
        className={navButtonClass(!!isActive)}
      >
        {Icon && <Icon className="h-4 w-4 shrink-0" />}
        {!compact && <span className="flex-1 text-left">{item.label}</span>}
      </button>
    )
  }

  return (
    <aside
      id="tenant-navigation"
      className={cn(
        "fixed inset-y-0 left-0 z-50 flex h-dvh w-[min(18rem,calc(100%-2rem))] flex-col border-r border-sidebar-border bg-sidebar shadow-[var(--shadow-overlay)] transition-[transform,width] duration-[var(--dur-long)] ease-[var(--ease-out)] md:relative md:z-auto md:translate-x-0 md:shadow-sm",
        mobileOpen ? "translate-x-0" : "-translate-x-full",
        collapsed ? "md:w-[var(--shell-sidebar-collapsed)]" : "md:w-[var(--shell-sidebar-width)]"
      )}
      aria-label="Điều hướng chính"
    >
      <div className={cn("border-b border-sidebar-border", compact ? "p-2" : "p-4")}>
        <div className={cn("flex items-center", compact ? "flex-col gap-2" : "gap-2")}>
          <Link
            href={brandHref}
            onClick={onMobileClose}
            title={compact ? "ParkVision" : undefined}
            aria-label={brandAriaLabel}
            className={cn(
              "group flex min-h-11 items-center rounded-xl outline-none transition-colors duration-200 hover:bg-muted focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar",
              compact ? "size-11 justify-center" : "min-w-0 flex-1 gap-3 px-1.5"
            )}
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-sidebar-accent text-sidebar-accent-foreground shadow-sm transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
              <CircleParking className="size-5" aria-hidden="true" />
            </span>
            {!compact && (
              <span className="min-w-0">
                <span className="block truncate text-lg leading-tight font-bold tracking-tight text-sidebar-foreground">
                  ParkVision
                </span>
                <span className="block truncate text-xs font-medium text-muted-foreground">
                  {brandSubtitle}
                </span>
              </span>
            )}
          </Link>
          <button
            type="button"
            onClick={() => setCollapsed((value) => !value)}
            className="hidden size-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors duration-200 hover:bg-muted hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar md:flex"
            title={collapsed ? "Mở rộng sidebar" : "Thu gọn sidebar"}
            aria-label={collapsed ? "Mở rộng sidebar" : "Thu gọn sidebar"}
          >
            {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
          </button>
          <button
            type="button"
            onClick={onMobileClose}
            className="ml-auto flex size-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors duration-200 hover:bg-muted hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar md:hidden"
            aria-label="Đóng điều hướng"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      <nav className={cn("flex-1 space-y-4 overflow-y-auto", compact ? "px-2 py-3" : "p-4")}>
        {filteredGroups.map((group) => (
          <div key={group.label || "main"} className="space-y-1">
            {!compact && group.label && (
              <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {group.label}
              </p>
            )}
            {group.items.map((item) => renderNavItem(item))}
          </div>
        ))}
      </nav>

      <div className={cn("border-t border-sidebar-border", compact ? "flex flex-col items-center gap-2 p-2" : "p-4")}>
        <div className={cn("flex w-full items-center", compact ? "justify-center" : "mb-3 gap-3")}>
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-sm font-medium text-sidebar-accent-foreground">
            {getUserInitials()}
          </div>
          {!compact && (
            <div className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-sidebar-foreground">
                {user?.fullName
                  ? user.fullName
                  : user?.username || "Người dùng"}
              </span>
              <p className="truncate text-xs text-muted-foreground">
                {roleLabel(user?.role)}
              </p>
            </div>
          )}
        </div>
        {compact ? (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleLogout}
            className="size-11 text-muted-foreground hover:bg-muted hover:text-sidebar-foreground"
            title="Đăng xuất"
            aria-label="Đăng xuất"
          >
            <LogOut className="size-4" />
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="min-h-11 w-full justify-start text-muted-foreground hover:bg-muted hover:text-sidebar-foreground"
          >
            <LogOut className="mr-2 size-4" />
            Đăng xuất
          </Button>
        )}
      </div>
    </aside>
  )
}
