"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { memberApi, type MemberParkingSession } from "@/lib/api/member-api"
import { useToast } from "@/hooks/use-toast"

export default function MemberHistoryPage() {
  const [sessions, setSessions] = useState<MemberParkingSession[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const data = await memberApi.listSessions()
        if (!cancelled) setSessions(data)
      } catch (e) {
        toast({
          title: "Không tải được lịch sử",
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
  }, [toast])

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Lịch sử visit</h1>
        <p className="text-sm text-muted-foreground">
          Các phiên gửi xe bạn đã claim (siêu thị / public). Org closed hiện qua đăng ký biển.
        </p>
      </header>

      {loading ? (
        <p className="text-sm text-muted-foreground">Đang tải…</p>
      ) : sessions.length === 0 ? (
        <p className="text-sm text-muted-foreground">Chưa có visit nào.</p>
      ) : (
        <ul className="space-y-4">
          {sessions.map((s) => (
            <li key={s.sessionId} className="border-b border-border/60 pb-3 last:border-0">
              <Link
                href={`/me/visit/${s.sessionId}`}
                className="block hover:opacity-80"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium">{s.licensePlate}</span>
                  <span className="text-xs uppercase text-muted-foreground">{s.status}</span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {s.tenantName || "ParkVision"}
                  {s.startedAt
                    ? ` · ${new Date(s.startedAt).toLocaleString("vi-VN")}`
                    : ""}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
