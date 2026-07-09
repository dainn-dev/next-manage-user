"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { canViewDashboard } from "@/lib/types"

export default function HomePage() {
  const router = useRouter()
  const { user, isLoading } = useAuth()

  // Land operators on the dashboard, everyone else on the vehicle list.
  // When unauthenticated, ProtectedLayout handles the redirect to /login, so we
  // only act once a user is known.
  useEffect(() => {
    if (isLoading || !user) return
    router.replace(canViewDashboard(user.role) ? "/dashboard" : "/vehicles")
  }, [isLoading, user, router])

  return null
}
