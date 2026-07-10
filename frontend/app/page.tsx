"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { canViewDashboard } from "@/lib/types"
import { LandingPage } from "@/components/landing/landing-page"

export default function HomePage() {
  const router = useRouter()
  const { user, isAuthenticated, isLoading } = useAuth()

  // Authenticated operators go into the app; guests see the marketing landing.
  useEffect(() => {
    if (isLoading || !isAuthenticated || !user) return
    router.replace(canViewDashboard(user.role) ? "/dashboard" : "/vehicles")
  }, [isLoading, isAuthenticated, user, router])

  if (isLoading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-background">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
          <p className="text-muted-foreground text-sm">Đang tải…</p>
        </div>
      </div>
    )
  }

  if (isAuthenticated && user) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-background">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
          <p className="text-muted-foreground text-sm">Đang vào hệ thống…</p>
        </div>
      </div>
    )
  }

  return <LandingPage />
}
