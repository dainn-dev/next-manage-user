"use client"

import { useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import Image from "next/image"

const navigationItems = [
  {
    key: "/employees",
    label: "Quân nhân",
    icon: "👥"
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
