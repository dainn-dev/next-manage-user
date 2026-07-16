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
import { MvpAnalytics } from "@/components/dashboard/mvp-analytics"

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

  const { isConnected, reconnect } = useWebSocket(handleVehicleCheck)

  useEffect(() => {
    if (canViewDashboard(user?.role)) {
      loadData()
    }
  }, [loadData, user])

  // Don't render the operator dashboard while auth resolves or a non-operator
  // is being redirected away.
  if (authLoading || (user && !canViewDashboard(user.role))) {
    return (
      <div className="admin-mobile-page">
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
      <div className="admin-mobile-page">
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
      tone: "text-[var(--color-success)]",
    },
    {
      label: "Lượt vào hôm nay",
      value: todayStats?.entryCount ?? 0,
      sub: "Số lượt xe vào cổng",
      icon: ArrowDownToLine,
      tone: "text-[var(--color-success)]",
    },
    {
      label: "Lượt ra hôm nay",
      value: todayStats?.exitCount ?? 0,
      sub: "Số lượt xe ra cổng",
      icon: ArrowUpFromLine,
      tone: "text-[var(--color-critical)]",
    },
  ]

  const chartData = (vehicleStats?.dailyStats ?? []).map((d) => ({
    label: d.date ? d.date.slice(5) : "",
    entry: d.entryCount,
    exit: d.exitCount,
    unique: d.uniqueVehicles,
  }))

  return (
    <main className="admin-mobile-page space-y-6 pb-[calc(var(--space-xl)+env(safe-area-inset-bottom))]">
      <header className="admin-mobile-header border-b border-border pb-4">
        <div className="min-w-0">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Bãi đỗ xe · hôm nay
          </p>
          <h1 className="mt-1 text-2xl font-semibold leading-tight tracking-tight text-foreground">
            Tổng quan vận hành
          </h1>
          <p className="mt-2 max-w-[60ch] text-sm leading-6 text-muted-foreground">
            Hoạt động bãi đỗ xe và cổng ra/vào theo thời gian thực
          </p>
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 sm:flex sm:items-center">
          <ConnectionPill
            connected={isConnected}
            onReconnect={reconnect}
          />
          <Button variant="outline" className="min-h-11 touch-manipulation" onClick={() => loadData()} disabled={loading}>
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
            Làm mới
          </Button>
        </div>
      </header>

      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      <MvpAnalytics />

      <section aria-labelledby="dashboard-metrics-title" className="space-y-3">
        <div>
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Chỉ số cốt lõi
          </p>
          <h2 id="dashboard-metrics-title" className="mt-1 text-lg font-semibold tracking-tight">
            Nhịp vận hành trong ngày
          </h2>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon
          return (
            <Card key={kpi.label} className="gap-0 py-0">
              <CardHeader className="flex flex-row items-center justify-between gap-2 px-4 pb-0 pt-4">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {kpi.label}
                </CardTitle>
                <span className="grid size-8 shrink-0 place-items-center rounded-md bg-muted" aria-hidden="true">
                  <Icon className={`size-4 ${kpi.tone}`} />
                </span>
              </CardHeader>
              <CardContent className="px-4 pb-4 pt-3">
                <div className="font-mono text-xl font-bold leading-none tabular-nums">
                  {kpi.value.toLocaleString("vi-VN")}
                </div>
                <p className="mt-2 text-xs leading-4 text-muted-foreground">{kpi.sub}</p>
              </CardContent>
            </Card>
          )
        })}
        </div>
      </section>

      <section aria-label="Theo dõi cổng realtime">
        <RealtimeGateDashboard
          pulse={realtimePulse}
          onError={(message) =>
            toast({ title: "Lỗi dữ liệu realtime", description: message, variant: "destructive" })
          }
        />
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="gap-0 py-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base">Xu hướng ra/vào (theo ngày)</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-3 sm:px-6 sm:pb-6">
            {chartData.length === 0 ? (
              <div className="flex items-center justify-center h-[320px] text-sm text-muted-foreground">
                Chưa có dữ liệu xu hướng
              </div>
            ) : (
              <div className="h-56 w-full sm:h-80">
                <ResponsiveContainer>
                  <ComposedChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="currentColor" className="text-muted-foreground" />
                    <YAxis tick={{ fontSize: 12 }} stroke="currentColor" className="text-muted-foreground" allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="entry" name="Lượt vào" fill="var(--color-success)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="exit" name="Lượt ra" fill="var(--color-critical)" radius={[4, 4, 0, 0]} />
                    <Line
                      type="monotone"
                      dataKey="unique"
                      name="Xe duy nhất"
                      stroke="var(--color-accent)"
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

      <section aria-label="Sự kiện và sơ đồ bãi đỗ" className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="gap-0 py-0">
          <CardHeader className="flex min-w-0 flex-row items-center justify-between gap-2 px-4 pb-0 pt-4 sm:px-6 sm:pt-6">
            <CardTitle className="flex items-center gap-2 text-base">
              <ListTree className="h-4 w-4 text-primary" />
              Dòng sự kiện gần đây
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-4 sm:px-6 sm:pb-6">
            {recentLogs.length === 0 ? (
              <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">
                Chưa có sự kiện nào hôm nay
              </div>
            ) : (
              <ol className="max-h-72 space-y-2 overflow-y-auto pr-1 overscroll-contain">
                {recentLogs.map((log) => (
                  <li
                    key={log.id}
                    className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-md border border-border bg-background px-3 py-2"
                  >
                    <Badge
                      variant={log.type === "entry" ? "default" : "secondary"}
                      className={
                        log.type === "entry"
                          ? "bg-[var(--color-success)] text-[var(--color-accent-ink)] hover:bg-[var(--color-success)]"
                          : "bg-[var(--color-critical)] text-[var(--color-accent-ink)] hover:bg-[var(--color-critical)]"
                      }
                    >
                      {log.type === "entry" ? "Vào" : "Ra"}
                    </Badge>
                    <div className="min-w-0">
                      <p className="truncate font-mono text-sm font-medium">{log.licensePlateNumber}</p>
                      {log.employeeName && <p className="truncate text-xs text-muted-foreground">{log.employeeName}</p>}
                    </div>
                    <time className="flex items-center gap-1 whitespace-nowrap font-mono text-xs text-muted-foreground" dateTime={log.entryExitTime}>
                      <Clock className="h-3 w-3" />
                      {log.entryExitTime
                        ? new Date(log.entryExitTime).toLocaleTimeString("vi-VN")
                        : "—"}
                    </time>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>

        <Card className="gap-0 py-0">
          <CardHeader className="flex min-w-0 flex-row items-center justify-between gap-2 px-4 pb-0 pt-4 sm:px-6 sm:pt-6">
            <CardTitle className="flex items-center gap-2 text-base">
              <MapIcon className="h-4 w-4 text-primary" />
              Sơ đồ bãi đỗ xe
            </CardTitle>
            <span className="rounded-full bg-muted px-2 py-1 font-mono text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Sắp ra mắt
            </span>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-4 sm:px-6 sm:pb-6">
            <div className="flex h-56 flex-col items-center justify-center gap-3 rounded-md border border-dashed border-border bg-muted/30 p-4 text-center">
              <MapIcon className="h-10 w-10 text-muted-foreground/50" />
              <div>
                <p className="text-sm font-medium text-foreground">Sơ đồ ô đỗ xe theo thời gian thực</p>
                <p className="mt-1 max-w-xs text-xs leading-5 text-muted-foreground">
                  Mở bản đồ bãi để theo dõi trạng thái từng ô đỗ.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
    </main>
  )
}

function ConnectionPill({
  connected,
  onReconnect,
}: {
  connected: boolean
  onReconnect: () => void
}) {
  if (connected) {
    return (
      <span role="status" className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-md border border-[var(--color-success)] bg-[var(--color-success-surface)] px-3 text-sm font-medium text-[var(--color-success)]">
        <Wifi className="size-4" />
        Realtime
      </span>
    )
  }
  return (
    <button
      onClick={onReconnect}
      className="inline-flex min-h-11 touch-manipulation items-center justify-center gap-1.5 rounded-md border border-[var(--color-critical)] bg-[var(--color-critical-surface)] px-3 text-sm font-medium text-[var(--color-critical)] transition-opacity duration-[var(--dur-short)] ease-[var(--ease-out)] hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      aria-label="Mất kết nối realtime — nhấn để kết nối lại"
    >
      <WifiOff className="size-4" />
      Mất kết nối
    </button>
  )
}
