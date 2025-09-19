"use client"

import { useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import Image from "next/image"
import { ChevronRight, LogOut, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/lib/auth-context"
import { useToast } from "@/hooks/use-toast"
import { UserRole } from "@/lib/types"

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
    children: [
      {
        key: "/positions/si-quan",
        label: "Sĩ quan",
        children: [
          {
            key: "/positions/si-quan/trung-doi",
            label: "Trung đội"
          },
          {
            key: "/positions/si-quan/dai-doi",
            label: "Đại đội"
          },
          {
            key: "/positions/si-quan/tieu-doan",
            label: "Tiểu đoàn"
          },
          {
            key: "/positions/si-quan/trung-doan",
            label: "Trung đoàn"
          },
          {
            key: "/positions/si-quan/co-quan",
            label: "Cơ quan",
            children: [
              {
                key: "/positions/si-quan/co-quan/tham-muu",
                label: "Tham mưu"
              },
              {
                key: "/positions/si-quan/co-quan/chinh-tri",
                label: "Chính trị"
              },
              {
                key: "/positions/si-quan/co-quan/hau-can-ky-thuat",
                label: "Hậu cần - Kỹ thuật"
              }
            ]
          }
        ]
      },
      {
        key: "/positions/qncn",
        label: "QNCN",
        children: [
          {
            key: "/positions/qncn/tieu-doan",
            label: "Tiểu đoàn"
          },
          {
            key: "/positions/qncn/co-quan",
            label: "Cơ quan",
            children: [
              {
                key: "/positions/qncn/co-quan/tham-muu",
                label: "Tham mưu"
              },
              {
                key: "/positions/qncn/co-quan/chinh-tri",
                label: "Chính trị"
              },
              {
                key: "/positions/qncn/co-quan/hau-can-ky-thuat",
                label: "Hậu cần - Kỹ thuật"
              }
            ]
          }
        ]
      }
    ]
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
  const [hoveredItem, setHoveredItem] = useState<string | null>(null)
  const { user, logout } = useAuth()
  const { toast } = useToast()

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
            </button>
             {item.children && !collapsed && pathname.startsWith(item.key) && (
              <div className="ml-6 mt-1 space-y-1">
                {item.children.map((child) => (
                  <div key={child.key} className="relative">
                    <button
                      onClick={() => handleMenuClick(child.key)}
                      onMouseEnter={() => setHoveredItem(child.key)}
                      onMouseLeave={() => setHoveredItem(null)}
                      className={`w-full text-left px-3 py-2 text-sm rounded-md transition-colors duration-200 flex items-center justify-between ${
                        pathname === child.key || pathname.startsWith(child.key)
                          ? "bg-sidebar-accent/10 text-sidebar-accent font-medium"
                          : "text-muted-foreground hover:bg-muted hover:text-sidebar-foreground"
                      }`}
                    >
                      <span>{child.label}</span>
                      {child.children && (
                        <ChevronRight className="h-3 w-3 text-muted-foreground" />
                      )}
                    </button>
                    
                    {/* Nested hover menu for children */}
                    {child.children && hoveredItem === child.key && (
                      <div 
                        className="absolute left-full top-0 ml-1 z-50"
                        onMouseEnter={() => setHoveredItem(child.key)}
                        onMouseLeave={() => setHoveredItem(null)}
                      >
                        <div className="bg-white border border-gray-200 rounded-md shadow-lg py-1 min-w-[160px]">
                          {child.children.map((grandchild) => (
                            <div key={grandchild.key} className="relative group">
                              <button
                                onClick={() => handleMenuClick(grandchild.key)}
                                className={`w-full text-left px-3 py-2 text-sm transition-colors duration-200 hover:bg-gray-100 flex items-center justify-between ${
                                  pathname === grandchild.key || pathname.startsWith(grandchild.key)
                                    ? "bg-blue-50 text-blue-600 font-medium"
                                    : "text-gray-700 hover:text-gray-900"
                                }`}
                              >
                                <span>{grandchild.label}</span>
                                {grandchild.children && (
                                  <ChevronRight className="h-3 w-3 text-gray-400" />
                                )}
                              </button>
                              
                              {/* Third level hover menu */}
                              {grandchild.children && (
                                <div className="absolute left-full top-0 ml-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                                  <div className="bg-white border border-gray-200 rounded-md shadow-lg py-1 min-w-[160px]">
                                    {grandchild.children.map((greatGrandchild) => (
                                      <button
                                        key={greatGrandchild.key}
                                        onClick={() => handleMenuClick(greatGrandchild.key)}
                                        className={`w-full text-left px-3 py-2 text-sm transition-colors duration-200 hover:bg-gray-100 ${
                                          pathname === greatGrandchild.key
                                            ? "bg-green-50 text-green-600 font-medium"
                                            : "text-gray-700 hover:text-gray-900"
                                        }`}
                                      >
                                        {greatGrandchild.label}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
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
