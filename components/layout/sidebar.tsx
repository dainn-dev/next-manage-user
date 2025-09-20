"use client"

import React, { useState, useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import Image from "next/image"
import { ChevronDown, ChevronRight, LogOut } from "lucide-react"
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

interface NavigationItem {
  key: string
  label: string
  icon?: string
  children?: NavigationItem[]
}

const navigationItems: NavigationItem[] = [
  {
    key: "/employees",
    label: "Quân nhân",
    icon: "👥"
  },
  {
    key: "/users",
    label: "Quản lý người dùng",
    icon: "👤"
  },
  {
    key: "/departments",
    label: "Cơ quan, đơn vị",
    icon: "🏢",
  },
  {
    key: "/positions",
    label: "Chức vụ",
    icon: "💼",
  },
  {
    key: "/vehicles",
    label: "Quản lý xe",
    icon: "🚗",
    children: [
      {
        key: "/vehicles",
        label: "Danh sách xe"
      },
      {
        key: "/vehicles/monitoring",
        label: "Giám sát"
      },
      {
        key: "/vehicles/entry-exit",
        label: "Thông tin ra vào"
      }
    ]
  },
  {
    key: "/statistics",
    label: "Thống kê",
    icon: "📊",
  },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)
  const [positions, setPositions] = useState<PositionApiResponse[]>([])
  const [loadingPositions, setLoadingPositions] = useState(true)
  const { user, logout } = useAuth()
  const { toast } = useToast()

  // Load positions from API
  useEffect(() => {
    const loadPositions = async () => {
      try {
        const positionsData = await positionApi.getPositionMenuHierarchy()
        setPositions(positionsData)
      } catch (error) {
        console.error('Failed to load positions:', error)
        toast({
          title: "Lỗi tải dữ liệu",
          description: "Không thể tải danh sách chức vụ",
          variant: "destructive",
        })
      } finally {
        setLoadingPositions(false)
      }
    }

    loadPositions()
  }, [toast])

  // Filter navigation items based on user role
  const filteredNavigationItems = navigationItems.filter(item => {
    // Show users menu only for admin users
    if (item.key === "/users") {
      return user?.role === UserRole.ADMIN
    }
    return true
  })

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
    const firstName = user.firstName || ""
    const lastName = user.lastName || ""
    if (firstName && lastName) {
      return (firstName[0] + lastName[0]).toUpperCase()
    }
    return user.username[0].toUpperCase()
  }

  // Convert position API response to navigation path
  const getPositionPath = (position: PositionApiResponse, parentPath = "/positions"): string => {
    // Create a URL-friendly slug from the position name
    const slug = position.name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // Remove accents
      .replace(/[^a-z0-9\s-]/g, "") // Remove special characters
      .replace(/\s+/g, "-") // Replace spaces with hyphens
      .trim()
    
    return `${parentPath}/${slug}`
  }

  // Render position dropdown menu items recursively
  const renderPositionMenuItems = (positions: PositionApiResponse[]): React.ReactNode => {
    return positions.map((position) => {
      const hasChildren = position.children && position.children.length > 0
      const positionPath = getPositionPath(position)

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
          onClick={() => handleMenuClick(positionPath)}
          className={
            pathname === positionPath || pathname.startsWith(positionPath)
              ? "bg-sidebar-accent text-sidebar-accent-foreground"
              : ""
          }
        >
          {position.name}
        </DropdownMenuItem>
      )
    })
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
              alt="CVS Entry & Exit Management"
              width={collapsed ? 40 : 48}
              height={collapsed ? 40 : 48}
              className="object-contain p-1"
              priority
            />
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <h4 className="font-bold text-sidebar-foreground text-lg tracking-tight">CVS</h4>
              <p className="text-xs text-muted-foreground font-medium">Entry & Exit Management</p>
            </div>
          )}
        </div>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="mt-4 p-2 hover:bg-muted rounded-lg transition-all duration-200 text-muted-foreground hover:text-sidebar-foreground hover:scale-105 active:scale-95"
          title={collapsed ? "Mở rộng sidebar" : "Thu gọn sidebar"}
        >
          <div className="flex items-center justify-center w-5 h-5">
            {collapsed ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            )}
          </div>
        </button>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {filteredNavigationItems.map((item) => (
          <div key={item.key}>
            {/* Special handling for Chức vụ (Positions) with dropdown */}
            {item.key === "/positions" && !collapsed ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className={`w-full text-left px-3 py-2 rounded-md transition-colors duration-200 flex items-center gap-3 text-sm font-medium ${
                      pathname.startsWith(item.key)
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-sidebar-foreground hover:bg-muted hover:text-sidebar-foreground"
                    }`}
                  >
                    <span className="text-base">{item.icon}</span>
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
                    <DropdownMenuItem disabled>
                      <span>Không có dữ liệu</span>
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              /* Regular menu items */
              <>
                <button
                  onClick={() => handleMenuClick(item.key)}
                  className={`w-full text-left px-3 py-2 rounded-md transition-colors duration-200 flex items-center gap-3 text-sm font-medium ${
                    pathname === item.key
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground hover:bg-muted hover:text-sidebar-foreground"
                  }`}
                >
                  <span className="text-base">{item.icon}</span>
                  {!collapsed && <span>{item.label}</span>}
                  {item.children && !collapsed && (
                    <ChevronRight className="h-4 w-4 ml-auto" />
                  )}
                </button>
                {/* Regular children for non-positions items */}
                {item.children && !collapsed && pathname.startsWith(item.key) && (
                  <div className="ml-6 mt-1 space-y-1">
                    {item.children.map((child) => (
                      <button
                        key={child.key}
                        onClick={() => handleMenuClick(child.key)}
                        className={`w-full text-left px-3 py-2 text-sm rounded-md transition-colors duration-200 ${
                          pathname === child.key || pathname.startsWith(child.key)
                            ? "bg-sidebar-accent/10 text-sidebar-accent font-medium"
                            : "text-muted-foreground hover:bg-muted hover:text-sidebar-foreground"
                        }`}
                      >
                        {child.label}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
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
                {user?.firstName && user?.lastName 
                  ? `${user.firstName} ${user.lastName}` 
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
          >
            <LogOut className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  )
}
