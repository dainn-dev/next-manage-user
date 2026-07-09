"use client"

import { useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { Sidebar } from "./sidebar"
import { Topbar } from "./topbar"
import { useAuth } from "@/lib/auth-context"
import { ErrorBoundary } from "@/components/error-boundary"

interface ProtectedLayoutProps {
  children: React.ReactNode
}

export function ProtectedLayout({ children }: ProtectedLayoutProps) {
  const { isAuthenticated, isLoading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (!isLoading && !isAuthenticated && pathname !== '/login') {
      router.push('/login')
    }
  }, [isAuthenticated, isLoading, pathname, router])

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
  if (!isAuthenticated && pathname !== '/login') {
    return null
  }

  // If on login page, don't show sidebar
  if (pathname === '/login') {
    return <>{children}</>
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
