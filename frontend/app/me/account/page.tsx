"use client"

import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"

export default function MemberAccountPage() {
  const { user, logout } = useAuth()
  const router = useRouter()
  const { toast } = useToast()

  const onLogout = async () => {
    await logout()
    toast({ title: "Đã đăng xuất" })
    router.push("/login")
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Tài khoản</h1>
        <p className="text-sm text-muted-foreground">Thông tin MEMBER trên ParkVision.</p>
      </header>

      <dl className="space-y-3 text-sm">
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">Tên đăng nhập</dt>
          <dd className="mt-1 font-medium">{user?.username}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">Email</dt>
          <dd className="mt-1">{user?.email || "—"}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">Họ tên</dt>
          <dd className="mt-1">{user?.fullName || "—"}</dd>
        </div>
      </dl>

      <Button variant="outline" onClick={onLogout}>
        Đăng xuất
      </Button>
    </div>
  )
}
