"use client"

import { useState } from "react"
import { usePathname, useRouter } from "next/navigation"

const navigationItems = [
  {
    key: "/employees",
    label: "Nhân sự",
    icon: "👥",
    children: [
      { key: "/employees/approved", label: "Nhân viên được xem xét" },
      { key: "/employees/terminated", label: "Nhân viên bị đuổi việc" },
    ],
  },
  {
    key: "/departments",
    label: "Phòng ban",
    icon: "🏢",
  },
  {
    key: "/positions",
    label: "Vị trí",
    icon: "💼",
  },
  {
    key: "/vehicles",
    label: "Quản lý xe",
    icon: "🚗",
  },
  {
    key: "/custom-fields",
    label: "Thuộc tính tùy chỉnh",
    icon: "⚙️",
  },
  {
    key: "/library",
    label: "Danh sách thư viện",
    icon: "📚",
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

  const handleMenuClick = (key: string) => {
    router.push(key)
  }

  return (
    <div
      className={`bg-sidebar border-r border-sidebar-border h-screen transition-all duration-300 ${collapsed ? "w-16" : "w-64"} flex flex-col shadow-sm`}
    >
      <div className="p-6 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-sidebar-primary rounded-lg flex items-center justify-center text-sidebar-primary-foreground font-semibold text-lg">
            Z
          </div>
          {!collapsed && (
            <div>
              <h4 className="font-semibold text-sidebar-foreground text-base">ZKBio CVSecurity</h4>
              <p className="text-sm text-muted-foreground">Quản lý nhân sự</p>
            </div>
          )}
        </div>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="mt-4 p-2 hover:bg-muted rounded-md transition-colors duration-200 text-muted-foreground hover:text-sidebar-foreground"
        >
          {collapsed ? "→" : "←"}
        </button>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navigationItems.map((item) => (
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
                  <button
                    key={child.key}
                    onClick={() => handleMenuClick(child.key)}
                    className={`w-full text-left px-3 py-2 text-sm rounded-md transition-colors duration-200 ${
                      pathname === child.key
                        ? "bg-sidebar-accent/10 text-sidebar-accent font-medium"
                        : "text-muted-foreground hover:bg-muted hover:text-sidebar-foreground"
                    }`}
                  >
                    {child.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>

      <div className="p-6 border-t border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-sidebar-accent rounded-full flex items-center justify-center text-sidebar-accent-foreground text-sm font-medium">
            A
          </div>
          {!collapsed && (
            <div>
              <span className="text-sm font-medium text-sidebar-foreground">admin</span>
              <p className="text-xs text-muted-foreground">Quản trị viên</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
