"use client"

import Image from "next/image"
import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import {
  Building2,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  ScrollText,
  Shield,
  X,
  type LucideIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { useAuth } from "@/lib/auth-context"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

interface PlatformShellProps {
  children: React.ReactNode
}

interface PlatformNavigationItem {
  href: string
  label: string
  description: string
  icon: LucideIcon
}

const platformNavigation: PlatformNavigationItem[] = [
  { href: "/platform/overview", label: "Overview", description: "Platform state", icon: LayoutDashboard },
  { href: "/platform/tenants", label: "Tenants", description: "Registry and lifecycle", icon: Building2 },
  { href: "/platform/billing", label: "Billing", description: "Cross-tenant subscriptions", icon: CreditCard },
  { href: "/platform/admins", label: "Admins", description: "Control-plane access", icon: Shield },
  { href: "/platform/audit", label: "Audit", description: "Operator activity", icon: ScrollText },
]

function userInitials(fullName?: string, username?: string): string {
  const source = fullName?.trim() || username?.trim() || "P"
  const parts = source.split(/\s+/)
  return parts.length > 1
    ? `${parts[0][0]}${parts.at(-1)?.[0] ?? ""}`.toUpperCase()
    : source[0].toUpperCase()
}

export function PlatformShell({ children }: PlatformShellProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout } = useAuth()
  const { toast } = useToast()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  const handleLogout = async () => {
    try {
      await logout()
      router.push("/login")
    } catch (error) {
      toast({
        title: "Không thể đăng xuất",
        description: error instanceof Error ? error.message : "Hãy thử lại.",
        variant: "destructive",
      })
    }
  }

  const renderSidebarContent = (compact: boolean, mobile: boolean) => (
    <>
      <div className="flex h-[var(--shell-topbar-height)] shrink-0 items-center gap-3 border-b border-sidebar-border px-4">
        <Image
          src="/logo.jpg"
          alt="ParkVision"
          width={32}
          height={32}
          className="size-8 rounded-[var(--radius-input)] object-contain"
          priority
        />
        {!compact && (
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold tracking-[-0.02em]">ParkVision</p>
            <p className="truncate text-xs text-muted-foreground">Platform control</p>
          </div>
        )}
        {mobile ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="ml-auto"
            onClick={() => setMobileOpen(false)}
            aria-label="Đóng điều hướng"
          >
            <X />
          </Button>
        ) : null}
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Platform sections">
        <p className={cn("mb-2 px-3 text-xs font-semibold uppercase tracking-[var(--tracking-label)] text-muted-foreground", compact && "sr-only")}>
          Control plane
        </p>
        <ul className="space-y-1">
          {platformNavigation.map((item) => {
            const active = pathname === item.href || pathname?.startsWith(`${item.href}/`)
            const Icon = item.icon
            return (
              <li key={item.href}>
                <button
                  type="button"
                  onClick={() => {
                    setMobileOpen(false)
                    router.push(item.href)
                  }}
                  aria-current={active ? "page" : undefined}
                  title={compact ? item.label : undefined}
                  className={cn(
                    "group flex min-h-11 w-full items-center gap-3 rounded-[var(--radius-input)] px-3 text-left text-sm font-medium whitespace-nowrap transition-[background-color,color,transform] duration-[var(--dur-short)] ease-[var(--ease-out)] active:translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-sidebar-foreground hover:bg-accent hover:text-accent-foreground",
                    compact && "justify-center px-0",
                  )}
                >
                  <Icon className="size-4 shrink-0" aria-hidden="true" />
                  {!compact && (
                    <span className="min-w-0">
                      <span className="block truncate">{item.label}</span>
                      <span className={cn("block truncate text-xs font-normal", active ? "text-primary-foreground/80" : "text-muted-foreground")}>
                        {item.description}
                      </span>
                    </span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <div className={cn("flex items-center gap-3 rounded-[var(--radius-input)] px-2 py-2", compact && "justify-center px-0")}>
          <div className="grid size-10 shrink-0 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
            {userInitials(user?.fullName, user?.username)}
          </div>
          {!compact && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{user?.fullName || user?.username || "Platform admin"}</p>
              <p className="truncate font-mono text-xs text-muted-foreground">PLATFORM_ADMIN</p>
            </div>
          )}
        </div>
        <div className={cn("mt-2 flex gap-2", compact && "lg:flex-col")}>
          {!mobile && (
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="hidden lg:inline-flex"
              onClick={() => setCollapsed((value) => !value)}
              aria-label={collapsed ? "Mở rộng điều hướng" : "Thu gọn điều hướng"}
            >
              {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            className={cn("flex-1 justify-start", compact && !mobile && "lg:size-11 lg:flex-none lg:px-0")}
            onClick={() => void handleLogout()}
            aria-label="Đăng xuất"
          >
            <LogOut />
            {!compact && <span>Đăng xuất</span>}
          </Button>
        </div>
      </div>
    </>
  )

  return (
    <div className="platform-shell flex h-dvh min-w-0 bg-background text-foreground">
      <a
        href="#platform-main"
        className="fixed left-4 top-3 z-[var(--z-tooltip)] -translate-y-20 rounded-[var(--radius-input)] bg-primary px-4 py-2 text-sm font-medium text-primary-foreground focus:translate-y-0"
      >
        Đi đến nội dung chính
      </a>

      <aside
        id="platform-navigation"
        aria-label="Platform navigation"
        className={cn(
          "hidden h-dvh flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:relative lg:flex lg:shadow-sm",
          collapsed ? "lg:w-[var(--shell-sidebar-collapsed)]" : "lg:w-[var(--shell-sidebar-width)]",
        )}
      >
        {renderSidebarContent(collapsed, false)}
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="p-0 lg:hidden">
          <div id="platform-navigation-mobile" aria-label="Platform navigation" className="flex h-full min-w-0 flex-col">
            {renderSidebarContent(false, true)}
          </div>
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="relative z-[var(--z-sticky)] flex h-[var(--shell-topbar-height)] shrink-0 items-center gap-3 border-b border-border bg-card/90 px-4 shadow-[var(--shadow-card)] backdrop-blur supports-[backdrop-filter]:bg-card/75 sm:px-6">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-controls="platform-navigation-mobile"
            aria-expanded={mobileOpen}
            aria-label="Mở điều hướng"
          >
            <Menu />
          </Button>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">Platform control plane</p>
            <p className="hidden truncate text-xs text-muted-foreground sm:block">
              Cross-tenant administration · no tenant operations
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden items-center gap-2 rounded-[var(--radius-pill)] border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground md:inline-flex">
              <span className="size-1.5 rounded-full bg-[var(--color-success)]" aria-hidden="true" />
              Platform scope
            </span>
          </div>
        </header>

        <main id="platform-main" tabIndex={-1} className="min-h-0 flex-1 overflow-y-auto bg-background outline-none">
          {children}
        </main>
      </div>
    </div>
  )
}
