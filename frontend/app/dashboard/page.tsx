"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  RefreshCw,
  ArrowDownToLine,
  ArrowUpFromLine,
  Car,
  Activity,
  ListTree,
  Map as MapIcon,
  Wifi,
  WifiOff,
  Clock,
} from "lucide-react"
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts"
import { useToast } from "@/hooks/use-toast"
import {
  vehicleLogApi,
  type VehicleLogStatistics,
  type VehicleLog,
} from "@/lib/api/vehicle-log-api"
import { vehicleStatisticsApi } from "@/lib/api/vehicle-statistics-api"
import type { VehicleStatistics } from "@/lib/types"
import {
  useWebSocket,
  type VehicleCheckMessage,
  type EmployeeVehicleCheckMessage,
} from "@/hooks/use-websocket"
import { RealtimeGateDashboard } from "@/components/vehicles/realtime-gate-dashboard"
import { useAuth } from "@/lib/auth-context"
import { canViewDashboard } from "@/lib/types"

const TIMELINE_PAGE_SIZE = 8

export default function DashboardPage() {
  const router = useRouter()
  const { user, isLoading: authLoading } = useAuth()
  const { toast } = useToast()

  const [todayStats, setTodayStats] = useState<VehicleLogStatistics | null>(null)
  const [vehicleStats, setVehicleStats] = useState<VehicleStatistics | null>(null)
  const [recentLogs, setRecentLogs] = useState<VehicleLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [realtimePulse, setRealtimePulse] = useState(0)

  // Role guard: non-operators are sent to the vehicle list (the dashboard is
  // operator-only; target RBAC is documented in docs/06, today's 4-role model
  // is the interim mapping via canViewDashboard).
  useEffect(() => {
    if (!authLoading && user && !canViewDashboard(user.role)) {
      router.replace("/vehicles")
    }
  }, [authLoading, user, router])

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [today, stats, logs] = await Promise.all([
        vehicleLogApi.getTodayStatistics().catch(() => null),
        vehicleStatisticsApi.getVehicleStatistics(),
        vehicleLogApi.getTodayLogs(0, TIMELINE_PAGE_SIZE).catch(() => null),
      ])
      setTodayStats(today)
      setVehicleStats(stats)
      setRecentLogs(logs?.content ?? [])
    } catch {
      const message = "Không thể tải dữ liệu tổng quan"
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [])

  // WebSocket: bump the realtime pulse on every gate vehicle-check event so the
  // embedded RealtimeGateDashboard refreshes immediately, and prepend a lightweight
  // entry to the event timeline for instant feedback.
  const handleVehicleCheck = useCallback(
    (message: VehicleCheckMessage | EmployeeVehicleCheckMessage) => {
      setRealtimePulse((p) => p + 1)

      const isEmployee = "employeeId" in message && "vehicleId" in message
      const emp = message as EmployeeVehicleCheckMessage
      const old = message as VehicleCheckMessage
      const plate = isEmployee ? emp.licensePlateNumber : old.licensePlateNumber
      const type = (isEmployee ? emp.logType : old.type).toLowerCase()
      const time = isEmployee ? emp.logTime || new Date().toISOString() : old.timestamp

      const entry: VehicleLog = {
        id: `rt-${Date.now()}`,
        licensePlateNumber: plate,
        entryExitTime: time,
        type: type === "exit" ? "exit" : "entry",
        vehicleType: "internal",
        employeeName: isEmployee ? emp.employeeName : undefined,
        createdAt: time,
        updatedAt: time,
      }
      setRecentLogs((prev) => [entry, ...prev].slice(0, TIMELINE_PAGE_SIZE))
    },
    []
  )

  const { isConnected, connectionError, reconnect } = useWebSocket(handleVehicleCheck)

  useEffect(() => {
    if (canViewDashboard(user?.role)) {
      loadData()
    }
  }, [loadData, user])

  // Don't render the operator dashboard while auth resolves or a non-operator
  // is being redirected away.
  if (authLoading || (user && !canViewDashboard(user.role))) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 bg-primary/10 rounded-lg flex items-center justify-center">
              <RefreshCw className="h-8 w-8 text-primary animate-spin" />
            </div>
            <p className="text-muted-foreground font-medium">Đang tải tổng quan...</p>
          </div>
        </div>
      </div>
    )
  }

  if (loading && !todayStats) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 bg-primary/10 rounded-lg flex items-center justify-center">
              <RefreshCw className="h-8 w-8 text-primary animate-spin" />
            </div>
            <p className="text-muted-foreground font-medium">Đang tải dữ liệu tổng quan...</p>
          </div>
        </div>
      </div>
    )
  }

  const kpis = [
    {
      label: "Tổng phương tiện",
      value: vehicleStats?.totalVehicles ?? 0,
      sub: "Phương tiện được quản lý",
      icon: Car,
      tone: "text-primary",
    },
    {
      label: "Đang hoạt động",
      value: vehicleStats?.activeVehicles ?? 0,
      sub: "Phương tiện đã được duyệt",
      icon: Activity,
      tone: "text-green-600",
    },
    {
      label: "Lượt vào hôm nay",
      value: todayStats?.entryCount ?? 0,
      sub: "Số lượt xe vào cổng",
      icon: ArrowDownToLine,
      tone: "text-green-600",
    },
    {
      label: "Lượt ra hôm nay",
      value: todayStats?.exitCount ?? 0,
      sub: "Số lượt xe ra cổng",
      icon: ArrowUpFromLine,
      tone: "text-red-600",
    },
  ]

  const chartData = (vehicleStats?.dailyStats ?? []).map((d) => ({
    label: d.date ? d.date.slice(5) : "",
    entry: d.entryCount,
    exit: d.exitCount,
    unique: d.uniqueVehicles,
  }))

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Tổng quan vận hành</h1>
          <p className="text-muted-foreground">
            Hoạt động bãi đỗ xe và cổng ra/vào theo thời gian thực
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ConnectionPill
            connected={isConnected}
            hasError={!!connectionError}
            onReconnect={reconnect}
          />
          <Button variant="outline" onClick={() => loadData()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Làm mới
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon
          return (
            <Card key={kpi.label}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {kpi.label}
                </CardTitle>
                <Icon className={`h-4 w-4 ${kpi.tone}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{kpi.value.toLocaleString("vi-VN")}</div>
                <p className="text-xs text-muted-foreground">{kpi.sub}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Realtime occupancy + trend chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RealtimeGateDashboard
          pulse={realtimePulse}
          onError={(message) =>
            toast({ title: "Lỗi dữ liệu realtime", description: message, variant: "destructive" })
          }
        />

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base">Xu hướng ra/vào (theo ngày)</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {chartData.length === 0 ? (
              <div className="flex items-center justify-center h-[320px] text-sm text-muted-foreground">
                Chưa có dữ liệu xu hướng
              </div>
            ) : (
              <div style={{ width: "100%", height: 320 }}>
                <ResponsiveContainer>
                  <ComposedChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="currentColor" className="text-muted-foreground" />
                    <YAxis tick={{ fontSize: 12 }} stroke="currentColor" className="text-muted-foreground" allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="entry" name="Lượt vào" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="exit" name="Lượt ra" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    <Line
                      type="monotone"
                      dataKey="unique"
                      name="Xe duy nhất"
                      stroke="#0F766E"
                      strokeWidth={2}
                      dot={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Event timeline + parking-map placeholder */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <ListTree className="h-4 w-4 text-primary" />
              Dòng sự kiện gần đây
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentLogs.length === 0 ? (
              <div className="flex items-center justify-center h-[260px] text-sm text-muted-foreground">
                Chưa có sự kiện nào hôm nay
              </div>
            ) : (
              <ol className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                {recentLogs.map((log) => (
                  <li
                    key={log.id}
                    className="flex items-center gap-3 rounded-md border border-border bg-card/50 px-3 py-2"
                  >
                    <Badge
                      variant={log.type === "entry" ? "default" : "secondary"}
                      className={
                        log.type === "entry"
                          ? "bg-green-600 hover:bg-green-600 text-white"
                          : "bg-red-600 hover:bg-red-600 text-white"
                      }
                    >
                      {log.type === "entry" ? "Vào" : "Ra"}
                    </Badge>
                    <span className="font-mono text-sm font-medium">
                      {log.licensePlateNumber}
                    </span>
                    {log.employeeName && (
                      <span className="text-sm text-muted-foreground truncate">
                        {log.employeeName}
                      </span>
                    )}
                    <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {log.entryExitTime
                        ? new Date(log.entryExitTime).toLocaleTimeString("vi-VN")
                        : "—"}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <MapIcon className="h-4 w-4 text-primary" />
              Sơ đồ bãi đỗ xe
            </CardTitle>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Sắp ra mắt
            </span>
          </CardHeader>
          <CardContent>
            <div className="flex h-[260px] flex-col items-center justify-center gap-3 rounded-md border border-dashed border-border bg-muted/30 text-center">
              <MapIcon className="h-10 w-10 text-muted-foreground/50" />
              <div>
                <p className="text-sm font-medium text-foreground">Sơ đồ ô đỗ xe theo thời gian thực</p>
                <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                  Trình thiết kế sơ đồ bãi (Parking Map Designer) và phát hiện ô đỗ đang được xây
                  dựng theo lộ trình (docs/08, docs/11).
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function ConnectionPill({
  connected,
  hasError,
  onReconnect,
}: {
  connected: boolean
  hasError: boolean
  onReconnect: () => void
}) {
  if (connected) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-green-500/30 bg-green-500/10 px-3 py-1 text-xs font-medium text-green-700 dark:text-green-400">
        <Wifi className="h-3.5 w-3.5" />
        Realtime
      </span>
    )
  }
  return (
    <button
      onClick={onReconnect}
      className="inline-flex items-center gap-1.5 rounded-full border border-destructive/30 bg-destructive/10 px-3 py-1 text-xs font-medium text-destructive hover:opacity-80"
      title="Mất kết nối realtime — nhấn để kết nối lại"
    >
      <WifiOff className="h-3.5 w-3.5" />
      Mất kết nối
    </button>
  )
}
