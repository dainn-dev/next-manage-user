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
  BarChart3,
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
import { AdminEmptyState, AdminPage, AdminPageHeader, AdminSectionHeader } from "@/components/layout/admin-page"

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
      <AdminPage>
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 bg-primary/10 rounded-lg flex items-center justify-center">
              <RefreshCw className="h-8 w-8 text-primary animate-spin" />
            </div>
            <p className="text-muted-foreground font-medium">Đang tải tổng quan...</p>
          </div>
        </div>
      </AdminPage>
    )
  }

  if (loading && !todayStats) {
    return (
      <AdminPage>
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 bg-primary/10 rounded-lg flex items-center justify-center">
              <RefreshCw className="h-8 w-8 text-primary animate-spin" />
            </div>
            <p className="text-muted-foreground font-medium">Đang tải dữ liệu tổng quan...</p>
          </div>
        </div>
      </AdminPage>
    )
  }

  const kpis = [
    {
      label: "Tổng phương tiện",
      value: vehicleStats?.totalVehicles ?? 0,
      sub: "Phương tiện được quản lý",
      icon: Car,
      tone: "text-primary",
      surface: "bg-primary/10",
      bar: "bg-primary",
    },
    {
      label: "Đang hoạt động",
      value: vehicleStats?.activeVehicles ?? 0,
      sub: "Phương tiện đã được duyệt",
      icon: Activity,
      tone: "text-[var(--color-success)]",
      surface: "bg-[var(--color-success-surface)]",
      bar: "bg-[var(--color-success)]",
    },
    {
      label: "Lượt vào hôm nay",
      value: todayStats?.entryCount ?? 0,
      sub: "Số lượt xe vào cổng",
      icon: ArrowDownToLine,
      tone: "text-[var(--color-success)]",
      surface: "bg-[var(--color-success-surface)]",
      bar: "bg-[var(--color-success)]",
    },
    {
      label: "Lượt ra hôm nay",
      value: todayStats?.exitCount ?? 0,
      sub: "Số lượt xe ra cổng",
      icon: ArrowUpFromLine,
      tone: "text-[var(--color-critical)]",
      surface: "bg-[var(--color-critical-surface)]",
      bar: "bg-[var(--color-critical)]",
    },
  ]

  const chartData = (vehicleStats?.dailyStats ?? []).map((d) => ({
    label: d.date ? d.date.slice(5) : "",
    entry: d.entryCount,
    exit: d.exitCount,
    unique: d.uniqueVehicles,
  }))

  return (
    <AdminPage>
      <AdminPageHeader
        eyebrow="Bãi đỗ xe · hôm nay"
        title="Tổng quan vận hành"
        description="Hoạt động bãi đỗ xe và cổng ra/vào theo thời gian thực."
        className="grid-cols-[minmax(0,1fr)_auto] items-start"
        actions={
          <div className="flex shrink-0 items-start justify-end gap-2">
          <ConnectionPill
            connected={isConnected}
            onReconnect={reconnect}
          />
          <Button
            variant="outline"
            size="icon"
            className="!h-8 !min-h-8 !w-8 shrink-0 rounded-lg !p-0 shadow-none sm:!h-10 sm:!min-h-10 sm:!w-auto sm:px-3"
            onClick={() => loadData()}
            disabled={loading}
            aria-label="Làm mới dữ liệu"
            title="Làm mới dữ liệu"
          >
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
            <span className="sr-only sm:not-sr-only sm:ml-2">Làm mới dữ liệu</span>
          </Button>
          </div>
        }
      />

      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      <MvpAnalytics />

      <section aria-labelledby="dashboard-metrics-title" className="space-y-3">
        <AdminSectionHeader
          eyebrow="Chỉ số cốt lõi"
          title={<span id="dashboard-metrics-title">Nhịp vận hành trong ngày</span>}
        />
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon
          return (
            <Card key={kpi.label} className="overflow-hidden gap-0 rounded-xl py-0 shadow-[var(--shadow-card)]">
              <div className={`h-0.5 w-full opacity-80 ${kpi.bar}`} aria-hidden="true" />
              <CardHeader className="flex flex-row items-start justify-between gap-2 px-3 pb-0 pt-3 sm:gap-3 sm:px-5 sm:pt-5">
                <CardTitle className="min-w-0 text-[0.75rem] font-medium leading-4 text-muted-foreground sm:text-sm">
                  {kpi.label}
                </CardTitle>
                <span className={`grid size-8 shrink-0 place-items-center rounded-xl sm:size-9 ${kpi.surface}`} aria-hidden="true">
                  <Icon className={`size-3.5 sm:size-4 ${kpi.tone}`} />
                </span>
              </CardHeader>
              <CardContent className="px-3 pb-3 pt-2 sm:px-5 sm:pb-5 sm:pt-3">
                <div className="font-[family:var(--font-display)] text-xl font-bold leading-none tracking-[-0.025em] tabular-nums sm:text-3xl sm:tracking-[-0.03em]">
                  {kpi.value.toLocaleString("vi-VN")}
                </div>
                <p className="mt-2 hidden text-sm leading-5 text-muted-foreground sm:block">{kpi.sub}</p>
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

      <section aria-label="Xu hướng và trạng thái vận hành" className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(20rem,0.75fr)]">
        <Card className="gap-0 overflow-hidden rounded-xl py-0 shadow-[var(--shadow-card)]">
          <CardHeader className="flex min-w-0 flex-row items-start justify-between gap-2 px-3 pb-0 pt-3 sm:gap-3 sm:px-5 sm:pt-5">
            <div className="min-w-0">
              <CardTitle className="text-sm font-semibold leading-5 sm:text-lg">Xu hướng ra/vào</CardTitle>
              <p className="mt-1 hidden text-sm leading-5 text-muted-foreground sm:block">
                Theo ngày, gồm lượt vào, lượt ra và số xe duy nhất.
              </p>
            </div>
            <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary sm:size-9" aria-hidden="true">
              <BarChart3 className="size-3.5 sm:size-4" />
            </span>
          </CardHeader>
          <CardContent className="px-3 pb-3 pt-2 sm:px-6 sm:pb-6 sm:pt-3">
            {chartData.length === 0 ? (
              <AdminEmptyState
                className="min-h-44 bg-muted/25 sm:min-h-72"
                icon={<BarChart3 className="size-6" />}
                title="Chưa có dữ liệu xu hướng"
                description="Khi có lượt xe ra/vào, biểu đồ sẽ hiển thị nhịp vận hành theo ngày để ca trực dễ phát hiện bất thường."
              />
            ) : (
              <div className="h-44 w-full sm:h-80">
                <ResponsiveContainer>
                  <ComposedChart data={chartData} margin={{ top: 8, right: 4, bottom: 0, left: -8 }}>
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
        <OperationalSnapshotCard
          connected={isConnected}
          loading={loading}
          recentLogs={recentLogs}
          todayStats={todayStats}
          vehicleStats={vehicleStats}
        />
      </section>

      <section aria-label="Sự kiện và sơ đồ bãi đỗ" className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card className="gap-0 py-0">
          <CardHeader className="flex min-w-0 flex-row items-center justify-between gap-2 px-4 pb-0 pt-4 sm:px-6 sm:pt-6">
            <CardTitle className="flex items-center gap-2 text-base">
              <ListTree className="h-4 w-4 text-primary" />
              Dòng sự kiện gần đây
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-4 sm:px-6 sm:pb-6">
            {recentLogs.length === 0 ? (
              <AdminEmptyState
                className="min-h-56 bg-muted/25"
                icon={<ListTree className="size-6" />}
                title="Chưa có sự kiện nào hôm nay"
                description="Sự kiện vào/ra realtime sẽ xuất hiện ở đây kèm biển số, hướng di chuyển và thời điểm."
              />
            ) : (
              <ol className="max-h-72 space-y-2 overflow-y-auto pr-1 overscroll-contain">
                {recentLogs.map((log) => (
                  <li
                    key={log.id}
                    className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-md border border-border bg-background px-3 py-2 sm:grid-cols-[auto_minmax(0,1fr)_auto]"
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
                    <time className="col-span-2 flex items-center gap-1 whitespace-nowrap font-mono text-xs text-muted-foreground sm:col-span-1" dateTime={log.entryExitTime}>
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
            <AdminEmptyState
              className="min-h-56 bg-muted/25"
              icon={<MapIcon className="size-6" />}
              title="Sơ đồ ô đỗ xe theo thời gian thực"
              description="Mở bản đồ bãi để theo dõi trạng thái từng ô đỗ, camera và cảnh báo theo zone."
            />
          </CardContent>
        </Card>
      </section>
    </AdminPage>
  )
}

function OperationalSnapshotCard({
  connected,
  loading,
  recentLogs,
  todayStats,
  vehicleStats,
}: {
  connected: boolean
  loading: boolean
  recentLogs: VehicleLog[]
  todayStats: VehicleLogStatistics | null
  vehicleStats: VehicleStatistics | null
}) {
  const lastLog = recentLogs[0]
  const lastLogTime = lastLog?.entryExitTime
    ? new Date(lastLog.entryExitTime).toLocaleTimeString("vi-VN")
    : "Chưa có"

  const items = [
    {
      label: "Nhịp hôm nay",
      value: `${(todayStats?.entryCount ?? 0).toLocaleString("vi-VN")} vào · ${(todayStats?.exitCount ?? 0).toLocaleString("vi-VN")} ra`,
      note: `${(todayStats?.uniqueVehicles ?? 0).toLocaleString("vi-VN")} xe duy nhất`,
    },
    {
      label: "Đội xe hoạt động",
      value: `${(vehicleStats?.activeVehicles ?? 0).toLocaleString("vi-VN")} / ${(vehicleStats?.totalVehicles ?? 0).toLocaleString("vi-VN")}`,
      note: "Đã duyệt trên tổng phương tiện",
    },
    {
      label: "Sự kiện mới nhất",
      value: lastLogTime,
      note: lastLog?.licensePlateNumber ? `Biển số ${lastLog.licensePlateNumber}` : "Chờ lượt ra/vào đầu tiên",
    },
  ]

  return (
    <Card className="overflow-hidden gap-0 rounded-xl py-0 shadow-[var(--shadow-card)]">
      <div className="h-0.5 w-full bg-primary/80" aria-hidden="true" />
      <CardHeader className="px-3 pb-0 pt-3 sm:px-5 sm:pt-5">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="text-sm font-semibold leading-5 sm:text-lg">Trạng thái ca trực</CardTitle>
            <p className="mt-1 hidden text-sm leading-5 text-muted-foreground sm:block">
              Tóm tắt nhanh để người vận hành biết hệ thống đang ổn hay cần chú ý.
            </p>
          </div>
          <Badge
            variant="outline"
            className={`h-7 shrink-0 rounded-lg px-2 text-xs ${
              connected
                ? "border-[var(--color-success)] bg-[var(--color-success-surface)] text-[var(--color-success)]"
                : "border-[var(--color-critical)] bg-[var(--color-critical-surface)] text-[var(--color-critical)]"
            }`}
          >
            {connected ? "Realtime ổn" : "Mất realtime"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="px-3 pb-3 pt-3 sm:px-5 sm:pb-5 sm:pt-4">
        <div className="overflow-hidden rounded-xl border border-border/70 bg-background/60">
        {items.map((item) => (
          <div
            key={item.label}
            className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 border-b border-border/60 px-3 py-2.5 last:border-b-0"
          >
            <div className="min-w-0">
              <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                {item.label}
              </p>
              <p className="mt-0.5 truncate text-xs leading-5 text-muted-foreground sm:text-sm">{item.note}</p>
            </div>
            <p className="max-w-[9.5rem] break-words text-right font-[family:var(--font-display)] text-sm font-semibold leading-5 tracking-[-0.01em] text-foreground sm:max-w-none sm:text-lg sm:tracking-[-0.02em]">
              {loading ? "Đang cập nhật..." : item.value}
            </p>
          </div>
        ))}
        </div>
        <div className="mt-3 rounded-xl border border-primary/15 bg-primary/5 px-3 py-2.5 text-xs leading-5 text-primary sm:text-sm">
          Ưu tiên realtime và sự kiện gần đây; khi có cảnh báo, đưa lên đầu màn hình.
        </div>
      </CardContent>
    </Card>
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
      <span
        role="status"
        aria-label="Realtime"
        title="Realtime"
        className="inline-flex !h-8 !min-h-8 !w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--color-success)] bg-[var(--color-success-surface)] p-0 text-sm font-medium text-[var(--color-success)] sm:!h-10 sm:!min-h-10 sm:!w-auto sm:gap-1.5 sm:px-3"
      >
        <Wifi className="size-4" />
        <span className="sr-only sm:not-sr-only">Realtime</span>
      </span>
    )
  }
  return (
    <button
      onClick={onReconnect}
      className="inline-flex !h-8 !min-h-8 !w-8 shrink-0 touch-manipulation items-center justify-center rounded-lg border border-[var(--color-critical)] bg-[var(--color-critical-surface)] p-0 text-sm font-medium text-[var(--color-critical)] transition-opacity duration-[var(--dur-short)] ease-[var(--ease-out)] hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:!h-10 sm:!min-h-10 sm:!w-auto sm:gap-1.5 sm:px-3"
      aria-label="Mất kết nối realtime — nhấn để kết nối lại"
      title="Mất kết nối realtime"
    >
      <WifiOff className="size-4" />
      <span className="sr-only sm:not-sr-only">Mất kết nối</span>
    </button>
  )
}
