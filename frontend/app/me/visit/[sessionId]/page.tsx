"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { memberApi, type MemberParkingSession } from "@/lib/api/member-api"
import { useToast } from "@/hooks/use-toast"

export default function MemberVisitDetailPage() {
  const params = useParams()
  const sessionId = String(params.sessionId || "")
  const [session, setSession] = useState<MemberParkingSession | null>(null)
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    if (!sessionId) return
    let cancelled = false
    ;(async () => {
      try {
        const data = await memberApi.getSession(sessionId)
        if (!cancelled) setSession(data)
      } catch (e) {
        toast({
          title: "Không tải được phiên",
          description: e instanceof Error ? e.message : "Lỗi không xác định",
          variant: "destructive",
        })
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [sessionId, toast])

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <p className="text-sm text-muted-foreground">
          <Link href="/me/visit" className="underline-offset-4 hover:underline">
            ← Visit / QR
          </Link>
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Xe đang ở đâu?</h1>
      </header>

      {loading ? (
        <p className="text-sm text-muted-foreground">Đang tải…</p>
      ) : !session ? (
        <p className="text-sm text-muted-foreground">Không tìm thấy phiên.</p>
      ) : (
        <dl className="space-y-4 text-sm">
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Biển số</dt>
            <dd className="mt-1 text-lg font-medium">{session.licensePlate}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Tổ chức / bãi</dt>
            <dd className="mt-1">{session.tenantName || session.tenantId || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Trạng thái</dt>
            <dd className="mt-1">{session.status}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Vị trí ô</dt>
            <dd className="mt-1">
              {session.locationLabel ||
                "Đã vào site — chưa gán ô (camera bãi sẽ cập nhật)"}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Bắt đầu</dt>
            <dd className="mt-1">
              {session.startedAt ? new Date(session.startedAt).toLocaleString("vi-VN") : "—"}
            </dd>
          </div>
        </dl>
      )}
    </div>
  )
}
