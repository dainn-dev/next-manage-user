"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Activity,
  ArrowLeft,
  Clock,
  MapPin,
  Radio,
  RefreshCw,
} from "lucide-react"
import { gateApi, type GateHealth } from "@/lib/api/gate-api"
import { ErrorBoundary } from "@/components/error-boundary"
import { AdminEmptyState, AdminPage } from "@/components/layout/admin-page"

// Poll a little faster than the gate list: this is a live health board and the
// backend's own scheduler re-evaluates staleness every ~30s.
const REFRESH_INTERVAL_MS = 15000

function formatAgo(seconds?: number | null): string {
  if (seconds === null || seconds === undefined) return "Chưa nhận nhịp tim"
  if (seconds < 60) return `${seconds}s trước`
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
    ? "border-emerald-300 bg-emerald-50 text-emerald-700"
    : gate.status === "disabled"
      ? "border-slate-300 bg-slate-50 text-slate-500"
      : "border-red-300 bg-red-50 text-red-600"
  const dot = gate.online
    ? "bg-emerald-500 animate-pulse"
    : gate.status === "disabled"
      ? "bg-slate-400"
      : "bg-red-500"
  return (
    <Badge variant="outline" className={className}>
      <span className={`inline-block w-2 h-2 rounded-full mr-1.5 ${dot}`} />
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

  const onlineCount = gates.filter((g) => g.online).length

  return (
    <AdminPage size="default" className="min-h-dvh">
      <header className="rounded-2xl border border-border/75 bg-card/90 p-3 shadow-[var(--shadow-card)] sm:p-5">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <Link
              href="/gate"
              className="mb-3 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground sm:text-sm"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Danh sách cổng
            </Link>
            <div className="flex min-w-0 items-center gap-2">
              <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-600 sm:size-10">
                <Activity className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />
              </span>
              <h1 className="truncate font-[family:var(--font-display)] text-[1.35rem] font-bold leading-[1.12] tracking-[-0.035em] text-foreground sm:text-[1.85rem]">
                Sức khỏe cổng
              </h1>
            </div>
            <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs leading-5 text-muted-foreground sm:text-sm">
              {gates.length > 0 && (
                <span>
                  <span className="font-semibold text-foreground">
                    {onlineCount}/{gates.length}
                  </span>{" "}
                  cổng trực tuyến
                </span>
              )}
              {updatedAt && (
                <span className="rounded-full bg-muted/70 px-2 py-0.5">
                  Cập nhật lúc {updatedAt}
                </span>
              )}
            </p>
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={load}
            disabled={loading}
            className="!h-9 !min-h-9 !w-9 shrink-0 rounded-xl border-border/70 bg-background/80 !p-0 shadow-none hover:border-blue-300 hover:bg-blue-50 sm:!h-10 sm:!min-h-10 sm:!w-10"
            aria-label="Làm mới trạng thái cổng"
            title="Làm mới"
          >
            <RefreshCw
              className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
            />
          </Button>
        </div>
      </header>

        {error && (
          <div className="mb-6 p-4 rounded-lg border border-red-300 bg-red-50 text-red-700 text-sm">
            {error}
          </div>
        )}

        {loading && gates.length === 0 && !error && (
          <AdminEmptyState
            className="min-h-[18rem] rounded-2xl bg-card/70"
            icon={<RefreshCw className="h-5 w-5 animate-spin" />}
            title="Đang tải trạng thái cổng"
            description="Hệ thống đang lấy dữ liệu realtime từ các kiosk."
          />
        )}

        {!loading && gates.length === 0 && !error && (
          <AdminEmptyState
            className="min-h-[18rem] rounded-2xl bg-card/70"
            icon={<Radio className="h-6 w-6" />}
            title="Chưa có cổng nào được đăng ký"
            description="Khi có cổng kiosk, trạng thái online và nhịp tim realtime sẽ hiển thị tại đây."
          />
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {gates.map((gate) => (
            <Card key={gate.id} className="transition-shadow hover:shadow-md">
              <CardContent className="p-5">
                <div className="flex min-w-0 items-start justify-between gap-3 mb-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        gate.online ? "bg-emerald-100" : "bg-slate-100"
                      }`}
                    >
                      <Radio
                        className={`h-5 w-5 ${
                          gate.online ? "text-emerald-600" : "text-slate-400"
                        }`}
                      />
                    </div>
                    <div className="min-w-0">
                      <h3 className="truncate font-semibold text-foreground">
                        {gate.name}
                      </h3>
                      {gate.location && (
                        <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          {gate.location}
                        </p>
                      )}
                    </div>
                  </div>
                  <HealthBadge gate={gate} />
                </div>

                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  <span>Nhịp cuối: {formatAgo(gate.secondsSinceHeartbeat)}</span>
                </div>
                {gate.lastHeartbeatAt && (
                  <div className="text-xs text-muted-foreground mt-1">
                    {new Date(gate.lastHeartbeatAt).toLocaleString("vi-VN")}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
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
