"use client"

import { useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { Sidebar } from "./sidebar"
import { Topbar } from "./topbar"
import { useAuth } from "@/lib/auth-context"
import { ErrorBoundary } from "@/components/error-boundary"
import { isPlatformAdmin } from "@/lib/types"

/** Routes that render without auth or app chrome (sidebar/topbar). */
const PUBLIC_PATHS = new Set(["/", "/login", "/register", "/forgot-password", "/reset-password"])

/** Tenant ops paths PLATFORM_ADMIN should not use (redirect to platform console). */
function isTenantOpsPath(pathname: string | null): boolean {
  if (!pathname) return false
  if (pathname.startsWith("/platform")) return false
  const tenantRoots = [
    "/dashboard",
    "/vehicles",
    "/gate",
    "/events",
    "/parking",
    "/statistics",
    "/users",
    "/employees",
  ]
  return tenantRoots.some((root) => pathname === root || pathname.startsWith(`${root}/`))
}

function isPublicPath(pathname: string | null): boolean {
  return pathname != null && PUBLIC_PATHS.has(pathname)
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

  useEffect(() => {
    if (!isLoading && !isAuthenticated && !publicRoute) {
      router.push('/login')
      return
    }
    if (isLoading || !isAuthenticated || publicRoute) return

    // PLATFORM_ADMIN stays in /platform/*; bounce away from tenant ops chrome.
    if (platformUser && isTenantOpsPath(pathname)) {
      router.replace("/platform/overview")
    }
  }, [isAuthenticated, isLoading, publicRoute, router, platformUser, pathname])

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

  // Per-gate kiosk (/gate/<id>) runs full-screen without the admin sidebar so it
  // reads as a dedicated display. Auth is still enforced above. The gate list
  // (/gate) keeps the normal chrome.
  if (pathname?.startsWith('/gate/')) {
    return <ErrorBoundary>{children}</ErrorBoundary>
  }

  // Show main app layout with sidebar
  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-auto bg-background">
          <ErrorBoundary>{children}</ErrorBoundary>
        </main>
      </div>
    </div>
  )
}
