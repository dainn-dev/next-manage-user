"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { isPlatformAdmin } from "@/lib/types"

/**
 * Platform console gate: only PLATFORM_ADMIN may view `/platform/*`.
 * Tenant operators are sent back to the tenant dashboard.
 */
export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading, isAuthenticated } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (isLoading || !isAuthenticated) return
    if (!isPlatformAdmin(user?.role)) {
      router.replace("/dashboard")
    }
  }, [isLoading, isAuthenticated, user?.role, router])

  if (isLoading || !isAuthenticated) {
    return null
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
