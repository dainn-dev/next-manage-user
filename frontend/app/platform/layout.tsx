"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { isPlatformAdmin, UserRole } from "@/lib/types"

/**
 * Platform console gate: only PLATFORM_ADMIN may view `/platform/*`.
 * Tenant operators are sent back to the tenant dashboard.
 * Members are sent to their own shell at /me.
 */
export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading, isAuthenticated } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (isLoading) return
    if (!isAuthenticated) {
      router.replace("/login")
      return
    }
    if (!isPlatformAdmin(user?.role)) {
      const destination = user?.role === UserRole.USER ? "/me" : "/dashboard"
      router.replace(destination)
    }
  }, [isLoading, isAuthenticated, user?.role, router])

  // Still checking session — show spinner, don't redirect yet
  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
        <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-primary mr-2" aria-hidden="true" />
        Đang xác thực…
      </div>
    )
  }

  // Session resolved but user is not authenticated — send to login
  if (!isAuthenticated) {
    return null // useEffect redirect to /login fires; render nothing meanwhile
  }

  if (!isPlatformAdmin(user?.role)) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
        Đang chuyển hướng…
      </div>
    )
  }

  return <>{children}</>
}
