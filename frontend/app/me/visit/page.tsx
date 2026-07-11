"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { memberApi } from "@/lib/api/member-api"
import { useToast } from "@/hooks/use-toast"

export default function MemberVisitPage() {
  const [code, setCode] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const { toast } = useToast()
  const router = useRouter()

  const onClaim = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const session = await memberApi.claimSession(code.trim())
      toast({
        title: "Đã gắn phiên gửi xe",
        description: `${session.licensePlate} · ${session.tenantName || "ParkVision"}`,
      })
      router.push(`/me/visit/${session.sessionId}`)
    } catch (err) {
      toast({
        title: "Không claim được mã QR",
        description: err instanceof Error ? err.message : "Mã không hợp lệ hoặc đã hết hạn",
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Visit / QR</h1>
        <p className="text-sm text-muted-foreground">
          Nhập mã trên phiếu QR in tại cổng siêu thị để theo dõi xe (where is my car).
        </p>
      </header>

      <form onSubmit={onClaim} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="qr-code">Mã QR / session</Label>
          <Input
            id="qr-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Dán mã từ phiếu hoặc session id"
            autoComplete="off"
            required
          />
        </div>
        <Button type="submit" disabled={submitting || !code.trim()}>
          {submitting ? "Đang xử lý…" : "Claim phiên"}
        </Button>
      </form>
    </div>
  )
}
