"use client"

import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { Sidebar } from "./sidebar"
import { Topbar } from "./topbar"
import { useAuth } from "@/lib/auth-context"
import { ErrorBoundary } from "@/components/error-boundary"
import { PlatformShell } from "@/components/platform/platform-shell"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { isPlatformAdmin, isMember } from "@/lib/types"
import { canAccessOperatorRoute, operatorLandingPath } from "@/lib/dashboard-access"

/** Routes that render without auth or app chrome (sidebar/topbar). */
const PUBLIC_PATHS = new Set(["/", "/login", "/register", "/forgot-password", "/reset-password"])

/** Tenant ops paths PLATFORM_ADMIN should not use (redirect to platform console). */
function isTenantOpsPath(pathname: string | null): boolean {
  if (!pathname) return false
  if (pathname.startsWith("/platform")) return false
  if (pathname.startsWith("/me")) return false
  const tenantRoots = [
    "/dashboard",
    "/vehicles",
    "/gate",
    "/events",
    "/parking",
    "/statistics",
    "/users",
    "/employees",
    "/sites",
    "/billing",
    "/settings",
  ]
  return tenantRoots.some((root) => pathname === root || pathname.startsWith(`${root}/`))
}

function isPublicPath(pathname: string | null): boolean {
  return pathname != null && PUBLIC_PATHS.has(pathname)
}

function isGateKioskPath(pathname: string | null): boolean {
  if (!pathname) return false
  const parts = pathname.split("/").filter(Boolean)
  return parts.length === 2 && parts[0] === "gate" && parts[1] !== "health"
}

interface ProtectedLayoutProps {
  children: React.ReactNode
}

export function ProtectedLayout({ children }: ProtectedLayoutProps) {
  const { isAuthenticated, isLoading, user } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const publicRoute = isPublicPath(pathname)
  const platformUser = isPlatformAdmin(user?.role)
  const memberUser = isMember(user?.role)
  const tenantOpsRoute = isTenantOpsPath(pathname)
  const wrongShell = !!user && tenantOpsRoute && (
    platformUser
    || memberUser
    || (!canAccessOperatorRoute(user.role, pathname))
  )
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  useEffect(() => {
    setMobileSidebarOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!isLoading && !isAuthenticated && !publicRoute) {
      router.push('/login')
      return
    }
    if (isLoading || !isAuthenticated || publicRoute) return

    // PLATFORM_ADMIN stays in /platform/*; bounce away from tenant ops chrome.
    if (platformUser && isTenantOpsPath(pathname)) {
      router.replace("/platform/overview")
      return
    }
    // MEMBER uses /me/* consumer shell only.
    if (memberUser && isTenantOpsPath(pathname)) {
      router.replace("/me")
      return
    }
    if (!platformUser && !memberUser && isTenantOpsPath(pathname)
        && !canAccessOperatorRoute(user?.role, pathname)) {
      router.replace(operatorLandingPath(user?.role))
    }
  }, [isAuthenticated, isLoading, publicRoute, router, platformUser, memberUser, pathname])

  // Public marketing / auth pages skip the loading gate so the landing paints immediately.
  if (publicRoute) {
    return <>{children}</>
  }

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="text-muted-foreground">Đang kiểm tra xác thực...</p>
        </div>
      </div>
    )
  }

  // If not authenticated, don't render the protected content
  // The redirect to login will happen via useEffect
  if (!isAuthenticated) {
    return null
  }

  // Do not paint protected content while a role-based redirect is pending.
  // API authorization remains authoritative, but this prevents a one-frame
  // disclosure/flash of a tenant view in the wrong shell.
  if (wrongShell) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
          <p className="text-muted-foreground">Đang chuyển đến khu vực được phép...</p>
        </div>
      </div>
    )
  }

  // Per-gate kiosk (/gate/<id>) runs full-screen without the admin sidebar so it
  // reads as a dedicated display. Auth is still enforced above. The gate list
  // (/gate) and admin pages such as /gate/health keep the normal chrome.
  if (isGateKioskPath(pathname)) {
    return <ErrorBoundary>{children}</ErrorBoundary>
  }

  if (platformUser) {
    return (
      <PlatformShell>
        <ErrorBoundary>{children}</ErrorBoundary>
      </PlatformShell>
    )
  }

  // Tenant and member areas keep their existing role-aware shell.
  return (
    <div className="relative flex h-dvh min-w-0 overflow-hidden bg-background">
      <a
        href="#main-content"
        className="sr-only z-[var(--z-toast)] rounded-md bg-primary px-3 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Bỏ qua điều hướng
      </a>
      <Sidebar variant="desktop" />
      <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
        <SheetContent side="left" className="p-0 lg:hidden">
          <Sidebar variant="mobile" mobileOpen onMobileClose={() => setMobileSidebarOpen(false)} />
        </SheetContent>
      </Sheet>
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Topbar
          onMobileMenuClick={() => setMobileSidebarOpen(true)}
          mobileMenuOpen={mobileSidebarOpen}
        />
        <main id="main-content" className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden bg-background">
          <ErrorBoundary>{children}</ErrorBoundary>
        </main>
      </div>
    </div>
  )
}
