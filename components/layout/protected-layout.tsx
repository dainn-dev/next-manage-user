"use client"

import { useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { Sidebar } from "./sidebar"
import { useAuth } from "@/lib/auth-context"

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
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="text-gray-600">Đang kiểm tra xác thực...</p>
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

  // Show main app layout with sidebar
  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto bg-white">{children}</main>
    </div>
  )
}
