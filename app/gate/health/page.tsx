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
    <div className="p-6 md:p-8 bg-background min-h-screen">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <Link
              href="/gate"
              className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-2"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Danh sách cổng
            </Link>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Activity className="h-6 w-6 text-blue-600" />
              Sức khỏe cổng
            </h1>
            <p className="text-muted-foreground mt-1">
              {gates.length > 0 && (
                <>
                  <span className="font-medium text-foreground">
                    {onlineCount}/{gates.length}
                  </span>{" "}
                  cổng đang trực tuyến.
                </>
              )}
              {updatedAt && (
                <span className="ml-1">Cập nhật lúc {updatedAt}.</span>
              )}
            </p>
          </div>
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCw
              className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`}
            />
            Làm mới
          </Button>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-lg border border-red-300 bg-red-50 text-red-700 text-sm">
            {error}
          </div>
        )}

        {loading && gates.length === 0 && !error && (
          <div className="flex items-center justify-center h-48 text-muted-foreground">
            <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
            Đang tải trạng thái cổng…
          </div>
        )}

        {!loading && gates.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
            <Radio className="h-10 w-10 mb-2 opacity-50" />
            <p>Chưa có cổng nào được đăng ký.</p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {gates.map((gate) => (
            <Card key={gate.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
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
                    <div>
                      <h3 className="font-semibold text-foreground">
                        {gate.name}
                      </h3>
                      {gate.location && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
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
      </div>
    </div>
  )
}

export default function GateHealthPage() {
  return (
    <ErrorBoundary>
      <GateHealthDashboard />
    </ErrorBoundary>
  )
}
