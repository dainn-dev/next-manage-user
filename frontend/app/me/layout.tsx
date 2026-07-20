"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { isMember } from "@/lib/types"

export default function MemberLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading, isAuthenticated } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (isLoading || !isAuthenticated) return
    if (!isMember(user?.role)) {
      router.replace("/dashboard")
    }
  }, [isLoading, isAuthenticated, user?.role, router])

  if (isLoading || !isAuthenticated) return null
  if (!isMember(user?.role)) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
        Đang chuyển hướng…
      </div>
    )
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col gap-5 px-4 py-5 pb-[calc(2rem+env(safe-area-inset-bottom))] sm:px-5 sm:py-6 md:gap-6">
      {children}
    </div>
  )
}
