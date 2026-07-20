"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { ArrowLeft, Clock, MapPin, Radio, RefreshCw } from "lucide-react"

import { ErrorBoundary } from "@/components/error-boundary"
import { AdminEmptyState, AdminPage, AdminPageHeader } from "@/components/layout/admin-page"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { gateApi, type GateHealth } from "@/lib/api/gate-api"

const REFRESH_INTERVAL_MS = 15000

function formatAgo(seconds?: number | null): string {
  if (seconds === null || seconds === undefined) return "Chưa nhận nhịp tim"
  if (seconds < 60) return `${seconds} giây trước`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} phút trước`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} giờ trước`
  return `${Math.floor(hours / 24)} ngày trước`
}

function HealthBadge({ gate }: { gate: GateHealth }) {
  const label = gate.online
    ? "Trực tuyến"
    : gate.status === "disabled"
      ? "Vô hiệu"
      : "Ngoại tuyến"
  const className = gate.online
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : gate.status === "disabled"
      ? "border-slate-200 bg-slate-50 text-slate-600"
      : "border-rose-200 bg-rose-50 text-rose-700"
  const dot = gate.online
    ? "bg-emerald-500"
    : gate.status === "disabled"
      ? "bg-slate-400"
      : "bg-rose-500"

  return (
    <Badge variant="outline" className={className}>
      <span className={`mr-1.5 size-1.5 rounded-full ${dot}`} />
      {label}
    </Badge>
  )
}

function GateHealthDashboard() {
  const [gates, setGates] = useState<GateHealth[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await gateApi.getGateHealth()
      setGates(data)
      setError(null)
      setUpdatedAt(new Date().toLocaleTimeString("vi-VN"))
    } catch {
      setError(
        "Không thể tải trạng thái cổng. Bạn cần quyền quản trị / phê duyệt / an ninh để xem trang này.",
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const id = setInterval(load, REFRESH_INTERVAL_MS)
    return () => clearInterval(id)
  }, [load])

  const onlineCount = gates.filter((gate) => gate.online).length

  return (
    <AdminPage size="default" className="min-h-dvh space-y-5">
      <AdminPageHeader
        eyebrow="Vận hành bãi xe"
        title="Sức khỏe cổng"
        description="Theo dõi kết nối và nhịp tim gần nhất của các kiosk theo thời gian thực."
        actionList={[
          {
            key: "refresh",
            content: <Button
              variant="outline"
              size="icon"
              onClick={load}
              disabled={loading}
              className="size-11 shrink-0 rounded-xl"
              aria-label="Làm mới trạng thái cổng"
              title="Làm mới"
            >
              <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
            </Button>,
          },
        ]}
      />

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-[var(--radius-sheet)] border border-border bg-card px-5 py-3 text-sm text-muted-foreground shadow-[var(--shadow-card)] sm:px-6">
        <Link
          href="/gate"
          className="inline-flex min-h-11 items-center gap-2 font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Danh sách cổng
        </Link>
        {gates.length > 0 && <span aria-hidden="true">•</span>}
        {gates.length > 0 && (
          <span>
            <strong className="font-semibold text-foreground">{onlineCount}/{gates.length}</strong> cổng trực tuyến
          </span>
        )}
        {gates.length > 0 && updatedAt && <span aria-hidden="true">•</span>}
        {updatedAt && <span>Cập nhật lúc {updatedAt}</span>}
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm leading-6 text-rose-800" role="alert">
          {error}
        </div>
      )}

      {loading && gates.length === 0 && !error && (
        <AdminEmptyState
          className="min-h-[18rem] rounded-[var(--radius-sheet)] bg-card"
          icon={<RefreshCw className="size-5 animate-spin" />}
          title="Đang tải trạng thái cổng"
          description="Hệ thống đang lấy dữ liệu mới nhất từ các kiosk."
        />
      )}

      {!loading && gates.length === 0 && !error && (
        <AdminEmptyState
          className="min-h-[18rem] rounded-[var(--radius-sheet)] bg-card"
          icon={<Radio className="size-6" />}
          title="Chưa có cổng nào được đăng ký"
          description="Khi có cổng kiosk, trạng thái trực tuyến và nhịp tim sẽ hiển thị tại đây."
        />
      )}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Trạng thái từng cổng">
        {gates.map((gate) => {
          const iconTone = gate.online
            ? "bg-emerald-100 text-emerald-700"
            : gate.status === "disabled"
              ? "bg-slate-100 text-slate-600"
              : "bg-rose-100 text-rose-700"

          return (
            <Card key={gate.id} className="border-border bg-card shadow-none transition-shadow hover:shadow-[var(--shadow-card)]">
              <CardContent className="flex h-full flex-col gap-5 p-5">
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className={`grid size-11 shrink-0 place-items-center rounded-xl ${iconTone}`}>
                      <Radio className={`size-5 ${gate.online ? "animate-pulse" : ""}`} aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <h2 className="truncate text-lg font-semibold tracking-tight text-foreground">{gate.name}</h2>
                      {gate.location && (
                        <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                          <MapPin className="size-4 shrink-0" aria-hidden="true" />
                          <span className="truncate">{gate.location}</span>
                        </p>
                      )}
                    </div>
                  </div>
                  <HealthBadge gate={gate} />
                </div>

                <div className="rounded-xl border border-border bg-muted/50 p-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <Clock className="size-4 text-primary" aria-hidden="true" />
                    Nhịp tim gần nhất
                  </div>
                  <p className="mt-1.5 text-base font-medium text-foreground">
                    {formatAgo(gate.secondsSinceHeartbeat)}
                  </p>
                  {gate.lastHeartbeatAt && (
                    <time className="mt-1 block text-xs leading-5 text-muted-foreground" dateTime={gate.lastHeartbeatAt}>
                      {new Date(gate.lastHeartbeatAt).toLocaleString("vi-VN")}
                    </time>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </section>
    </AdminPage>
  )
}

export default function GateHealthPage() {
  return (
    <ErrorBoundary>
      <GateHealthDashboard />
    </ErrorBoundary>
  )
}
