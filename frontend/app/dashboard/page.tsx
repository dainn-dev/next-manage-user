"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  RefreshCw,
  BarChart3,
  ListTree,
  Map as MapIcon,
  Wifi,
  WifiOff,
  Clock,
  CircleAlert,
} from "lucide-react"
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Legend,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts"
import { useToast } from "@/hooks/use-toast"
import { vehicleLogApi, type VehicleLogStatistics, type VehicleLog } from "@/lib/api/vehicle-log-api"
import { vehicleStatisticsApi } from "@/lib/api/vehicle-statistics-api"
import type { VehicleStatistics } from "@/lib/types"
import { useWebSocket, type VehicleCheckMessage, type EmployeeVehicleCheckMessage } from "@/hooks/use-websocket"
import { RealtimeGateDashboard } from "@/components/vehicles/realtime-gate-dashboard"
import { useAuth } from "@/lib/auth-context"
import { canViewDashboard } from "@/lib/types"
import { MvpAnalytics } from "@/components/dashboard/mvp-analytics"
import { CoreTodayMetrics } from "@/components/dashboard/core-today-metrics"
import { AdminPage, AdminPageHeader } from "@/components/layout/admin-page"
import { useDashboardData } from "@/lib/dashboard-data-context"
import { cn } from "@/lib/utils"

const TIMELINE_PAGE_SIZE = 8

export default function DashboardPage() {
  const router = useRouter()
  const [currentTime, setCurrentTime] = useState("")
  const [todayStats, setTodayStats] = useState<VehicleLogStatistics | null>(null)
  const [vehicleStats, setVehicleStats] = useState<VehicleStatistics | null>(null)
  const [recentLogs, setRecentLogs] = useState<VehicleLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [realtimePulse, setRealtimePulse] = useState(0)
  const { refresh: refreshScopedDashboard } = useDashboardData()
  const { user, isLoading: authLoading } = useAuth()
  const { toast } = useToast()

  useEffect(() => {
    setCurrentTime(new Date().toLocaleTimeString("vi-VN"))
    const interval = window.setInterval(() => setCurrentTime(new Date().toLocaleTimeString("vi-VN")), 1000)
    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!authLoading && user && !canViewDashboard(user.role)) router.replace("/vehicles")
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
      setError("Không thể tải dữ liệu tổng quan. Hãy thử lại sau ít phút.")
    } finally {
      setLoading(false)
    }
  }, [])

  const reloadDashboard = useCallback(async () => {
    await Promise.all([loadData(), refreshScopedDashboard()])
    setRealtimePulse((value) => value + 1)
  }, [loadData, refreshScopedDashboard])

  const handleVehicleCheck = useCallback((message: VehicleCheckMessage | EmployeeVehicleCheckMessage) => {
    console.log('[REALTIME] WebSocket message received:', message)
    setRealtimePulse((value) => value + 1)
    const isEmployee = "employeeId" in message && "vehicleId" in message
    const employeeMessage = message as EmployeeVehicleCheckMessage
    const vehicleMessage = message as VehicleCheckMessage
    const plate = isEmployee ? employeeMessage.licensePlateNumber : vehicleMessage.licensePlateNumber
    const type = (isEmployee ? employeeMessage.logType : vehicleMessage.type).toLowerCase()
    const time = isEmployee ? employeeMessage.logTime || new Date().toISOString() : vehicleMessage.timestamp

    const entry: VehicleLog = {
      id: `rt-${Date.now()}`,
      licensePlateNumber: plate,
      entryExitTime: time,
      type: type === "exit" ? "exit" : "entry",
      vehicleType: "internal",
      employeeName: isEmployee ? employeeMessage.employeeName : undefined,
      createdAt: time,
      updatedAt: time,
    }
    setRecentLogs((previous) => {
      const updated = [entry, ...previous].slice(0, TIMELINE_PAGE_SIZE)
      console.log('[REALTIME] Recent logs updated, count:', updated.length)
      return updated
    })
    setTodayStats((previous) => {
      if (!previous) return previous
      const updated = {
        ...previous,
        entryCount: previous.entryCount + (type === "entry" ? 1 : 0),
        exitCount: previous.exitCount + (type === "exit" ? 1 : 0),
      }
      console.log('[REALTIME] Stats updated:', updated)
      return updated
    })
  }, [])

  const { isConnected, reconnect } = useWebSocket(handleVehicleCheck, {
    onConnect: () => {
      console.log('[REALTIME] WebSocket connected, triggering data refresh')
      void loadData() // Refresh data on reconnect to catch missed events
    }
  })

  useEffect(() => {
    if (canViewDashboard(user?.role)) void loadData()
  }, [loadData, user])

  if (authLoading || (user && !canViewDashboard(user.role))) {
    return <DashboardLoading label="Đang kiểm tra quyền truy cập…" />
  }

  if (loading && !todayStats) {
    return <DashboardLoading label="Đang tải dữ liệu tổng quan…" />
  }

  const chartData = (vehicleStats?.dailyStats ?? []).map((day) => ({
    label: day.date ? day.date.slice(5) : "",
    entry: day.entryCount,
    exit: day.exitCount,
    unique: day.uniqueVehicles,
  }))
  const chartSummary = chartData.length
    ? `Có ${chartData.length} ngày dữ liệu. Tổng lượt vào là ${chartData.reduce((total, day) => total + day.entry, 0).toLocaleString("vi-VN")}, tổng lượt ra là ${chartData.reduce((total, day) => total + day.exit, 0).toLocaleString("vi-VN")}.`
    : "Chưa có dữ liệu xu hướng trong khoảng thời gian hiện tại."

  return (
    <AdminPage className="space-y-6">
      <AdminPageHeader
        eyebrow="Bảng điều khiển"
        title="Trung tâm điều hành"
        description="Theo dõi lưu lượng, trạng thái cổng và hoạt động của bãi đỗ theo thời gian thực."
        actions={
          <div className="dashboard-header-actions grid min-w-0 grid-cols-3 items-center gap-2">
            <p className="flex min-h-11 min-w-0 items-center justify-center whitespace-nowrap rounded-[var(--radius-input)] bg-muted px-1 text-center text-[10px] font-medium tabular-nums text-muted-foreground sm:px-3 sm:text-xs">
              Giờ ca trực <span className="ml-1 text-foreground">{currentTime || "00:00:00"}</span>
            </p>
            <ConnectionPill connected={isConnected} onReconnect={reconnect} compact />
            <Button
              variant="outline"
              className="!h-11 !min-h-11 !w-full !px-2"
              onClick={() => void reloadDashboard()}
              disabled={loading}
              data-state={loading ? "loading" : undefined}
              aria-label="Nạp lại dữ liệu"
            >
              <RefreshCw className={cn("size-4", loading && "animate-spin")} />
              <span className="text-[10px] sm:text-sm"><span className="sm:hidden">Nạp lại</span><span className="hidden sm:inline">Nạp lại dữ liệu</span></span>
            </Button>
          </div>
        }
      />

      {error && (
        <div role="alert" className="flex items-start gap-3 rounded-[var(--radius-card)] border border-destructive/30 bg-[var(--color-critical-surface)] p-4 text-sm leading-6 text-[var(--color-on-critical)]">
          <CircleAlert className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <div className="min-w-0 flex-1"><p>{error} Dùng nút “Nạp lại dữ liệu” phía trên để thử lại.</p></div>
        </div>
      )}

      <MvpAnalytics />

      <CoreTodayMetrics
        connected={isConnected}
        lastEventAt={recentLogs[0]?.entryExitTime}
        loading={loading}
        todayStats={todayStats}
        vehicleStats={vehicleStats}
      />

      <section aria-label="Theo dõi cổng realtime">
        <RealtimeGateDashboard pulse={realtimePulse} onError={(message) => toast({ title: "Lỗi dữ liệu realtime", description: message, variant: "destructive" })} />
      </section>

      <section aria-label="Xu hướng và trạng thái vận hành" className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(20rem,0.75fr)]">
        <Card>
          <CardHeader>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-primary">Thống kê</p>
              <CardTitle className="mt-1">Xu hướng lưu lượng</CardTitle>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">Lượt vào, lượt ra và số phương tiện duy nhất theo ngày.</p>
            </div>
            <CardAction>
              <span className="grid size-11 shrink-0 place-items-center rounded-[var(--radius-input)] bg-primary-container text-on-primary-container"><BarChart3 className="size-5" aria-hidden="true" /></span>
            </CardAction>
          </CardHeader>
          <CardContent>
            {chartData.length === 0 ? (
              <EmptyChartState />
            ) : (
              <>
                <p className="sr-only">{chartSummary}</p>
                <div className="h-64 w-full sm:h-80">
                  <ResponsiveContainer>
                    <ComposedChart data={chartData} margin={{ top: 12, right: 12, bottom: 0, left: -12 }}>
                      <CartesianGrid stroke="var(--color-rule)" strokeDasharray="3 3" />
                      <XAxis dataKey="label" tick={{ fill: "var(--color-muted)", fontSize: 12 }} stroke="var(--color-rule-2)" minTickGap={24} />
                      <YAxis tick={{ fill: "var(--color-muted)", fontSize: 12 }} stroke="var(--color-rule-2)" allowDecimals={false} width={36} />
                      <Tooltip
                        contentStyle={{ backgroundColor: "var(--card)", borderColor: "var(--border)", borderRadius: "var(--radius-input)", color: "var(--foreground)", fontSize: "12px", boxShadow: "var(--shadow-card)" }}
                      />
                      <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "12px" }} />
                      <Bar dataKey="entry" name="Lượt vào" fill="var(--chart-2)" radius={[4, 4, 0, 0]} fillOpacity={0.85} />
                      <Bar dataKey="exit" name="Lượt ra" fill="var(--chart-5)" radius={[4, 4, 0, 0]} fillOpacity={0.85} />
                      <Line type="monotone" dataKey="unique" name="Xe duy nhất" stroke="var(--chart-1)" strokeWidth={2.5} dot={{ fill: "var(--chart-1)", strokeWidth: 1 }} activeDot={{ r: 5 }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
                <details className="mt-3 rounded-[var(--radius-input)] bg-muted p-3 text-sm text-muted-foreground">
                  <summary className="cursor-pointer font-medium text-foreground">Tóm tắt dữ liệu biểu đồ</summary>
                  <p className="mt-2 leading-6">{chartSummary}</p>
                </details>
              </>
            )}
          </CardContent>
        </Card>

        <OperationalSnapshotCard connected={isConnected} loading={loading} recentLogs={recentLogs} todayStats={todayStats} vehicleStats={vehicleStats} />
      </section>

      <section aria-label="Sự kiện và sơ đồ bãi đỗ" className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ListTree className="size-5 text-primary" />Sự kiện ra vào gần đây</CardTitle>
            <CardAction>
              <Badge variant={isConnected ? "default" : "outline"}>{isConnected ? "Đang đồng bộ" : "Đang chờ kết nối"}</Badge>
            </CardAction>
          </CardHeader>
          <CardContent>
            {recentLogs.length === 0 ? (
              <div className="flex min-h-52 flex-col items-center justify-center gap-3 rounded-[var(--radius-input)] border border-dashed border-border bg-muted/30 p-6 text-center">
                <ListTree className="size-8 text-muted-foreground" />
                <div><p className="font-medium">Chưa có sự kiện nào hôm nay</p><p className="mt-1 text-sm leading-6 text-muted-foreground">Sự kiện xe ra/vào sẽ xuất hiện ở đây khi cổng gửi dữ liệu.</p></div>
              </div>
            ) : (
              <ol className="max-h-80 space-y-2 overflow-y-auto pr-1 overscroll-contain">
                {recentLogs.map((log) => (
                  <li key={log.id} className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-[var(--radius-input)] border border-border bg-muted/35 px-3 py-3">
                    <Badge variant={log.type === "entry" ? "default" : "destructive"}>{log.type === "entry" ? "Vào" : "Ra"}</Badge>
                    <div className="min-w-0"><p className="truncate font-mono text-sm font-semibold text-foreground">{log.licensePlateNumber}</p>{log.employeeName && <p className="truncate text-xs text-muted-foreground">{log.employeeName}</p>}</div>
                    <time className="flex items-center gap-1 text-xs tabular-nums text-muted-foreground" dateTime={log.entryExitTime}><Clock className="size-3.5" />{log.entryExitTime ? new Date(log.entryExitTime).toLocaleTimeString("vi-VN") : "—"}</time>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle className="flex items-center gap-2"><MapIcon className="size-5 text-primary" />Sơ đồ vùng đỗ xe</CardTitle>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">Kiểm tra trạng thái từng ô và cấu hình bản đồ theo khu vực.</p>
            </div>
            <CardAction>
              <Badge variant="outline">Bản đồ bãi đỗ</Badge>
            </CardAction>
          </CardHeader>
          <CardContent>
            <div className="grid min-h-52 place-items-center rounded-[var(--radius-input)] border border-dashed border-border bg-muted/30 p-6 text-center">
              <div className="max-w-sm"><span className="mx-auto grid size-12 place-items-center rounded-full bg-primary-container text-on-primary-container"><MapIcon className="size-6" /></span><p className="mt-4 font-semibold">Mở sơ đồ vận hành</p><p className="mt-1 text-sm leading-6 text-muted-foreground">Xem tình trạng ô đỗ và chi tiết vị trí theo dữ liệu Map Designer.</p><Button className="mt-4" variant="tonal" onClick={() => router.push("/parking/maps")}>Xem sơ đồ bãi đỗ</Button></div>
            </div>
          </CardContent>
        </Card>
      </section>
    </AdminPage>
  )
}

function DashboardLoading({ label }: { label: string }) {
  return (
    <AdminPage><div className="flex h-64 items-center justify-center"><div className="flex flex-col items-center gap-4"><span className="grid size-14 place-items-center rounded-[var(--radius-card)] bg-primary-container text-on-primary-container"><RefreshCw className="size-7 animate-spin" /></span><p className="text-sm font-medium text-muted-foreground">{label}</p></div></div></AdminPage>
  )
}

function EmptyChartState() {
  return <div className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-[var(--radius-input)] border border-dashed border-border bg-muted/30 p-6 text-center"><BarChart3 className="size-8 text-muted-foreground" /><div><p className="font-medium">Chưa có dữ liệu xu hướng</p><p className="mt-1 text-sm leading-6 text-muted-foreground">Khi có lượt xe ra/vào cổng, biểu đồ nhịp vận hành sẽ hiển thị tại đây.</p></div></div>
}

function OperationalSnapshotCard({ connected, loading, recentLogs, todayStats, vehicleStats }: { connected: boolean; loading: boolean; recentLogs: VehicleLog[]; todayStats: VehicleLogStatistics | null; vehicleStats: VehicleStatistics | null }) {
  const lastLog = recentLogs[0]
  const items = [
    { label: "Lưu lượng hôm nay", value: `${(todayStats?.entryCount ?? 0).toLocaleString("vi-VN")} vào / ${(todayStats?.exitCount ?? 0).toLocaleString("vi-VN")} ra`, note: `${(todayStats?.uniqueVehicles ?? 0).toLocaleString("vi-VN")} xe duy nhất` },
    { label: "Đội xe vận hành", value: `${(vehicleStats?.activeVehicles ?? 0).toLocaleString("vi-VN")} / ${(vehicleStats?.totalVehicles ?? 0).toLocaleString("vi-VN")}`, note: "Phương tiện hoạt động" },
    { label: "Sự kiện mới nhất", value: lastLog?.entryExitTime ? new Date(lastLog.entryExitTime).toLocaleTimeString("vi-VN") : "Chưa có", note: lastLog?.licensePlateNumber ? `Biển số: ${lastLog.licensePlateNumber}` : "Đang chờ ghi nhận" },
  ]
  return (
    <Card>
      <CardHeader>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Trạng thái ca trực</p>
          <CardTitle className="mt-1">Tóm tắt vận hành</CardTitle>
        </div>
        <CardAction>
          <Badge variant={connected ? "default" : "destructive"}>{connected ? "Gateway online" : "Gateway offline"}</Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="grid gap-3">
        {items.map((item) => <div key={item.label} className="rounded-[var(--radius-input)] border border-border bg-muted/30 p-3"><p className="text-xs font-medium text-muted-foreground">{item.label}</p><p className="mt-1 text-sm font-semibold tabular-nums text-foreground">{loading ? "Đang tải…" : item.value}</p><p className="mt-1 text-xs text-muted-foreground">{item.note}</p></div>)}
        <p className="rounded-[var(--radius-input)] bg-primary-container p-3 text-xs leading-5 text-on-primary-container">Dữ liệu realtime được ưu tiên đồng bộ qua WebSocket. Dùng nút nạp lại nếu dữ liệu không cập nhật.</p>
      </CardContent>
    </Card>
  )
}

function ConnectionPill({ connected, onReconnect, compact = false }: { connected: boolean; onReconnect: () => void; compact?: boolean }) {
  if (connected) {
    return (
      <span role="status" className={cn("inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-input)] bg-[var(--color-success-surface)] px-3 text-sm font-medium text-[var(--color-on-success)]", compact && "w-full px-2 text-[10px] sm:px-3 sm:text-sm")}>
        <Wifi className="size-4 shrink-0" />Thời gian thực
      </span>
    )
  }
  return <Button variant="outline" onClick={onReconnect} className={cn("border-destructive/30 text-destructive", compact && "!h-11 !min-h-11 !w-full !px-2 text-[10px] sm:text-sm")}><WifiOff className="size-4" />Kết nối lại</Button>
}
