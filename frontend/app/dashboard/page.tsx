"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
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
import { AdminPage, AdminPageHeader, AdminSectionHeader } from "@/components/layout/admin-page"
import { cn } from "@/lib/utils"

const TIMELINE_PAGE_SIZE = 8

export default function DashboardPage() {
  const router = useRouter()
  const [currentTime, setCurrentTime] = useState<string>("")
  useEffect(() => {
    if (typeof window !== "undefined") {
      setCurrentTime(new Date().toLocaleTimeString("vi-VN"))
      const interval = setInterval(() => {
        setCurrentTime(new Date().toLocaleTimeString("vi-VN"))
      }, 1000)
      return () => clearInterval(interval)
    }
  }, [])

  const { user, isLoading: authLoading } = useAuth()
  const { toast } = useToast()

  const [todayStats, setTodayStats] = useState<VehicleLogStatistics | null>(null)
  const [vehicleStats, setVehicleStats] = useState<VehicleStatistics | null>(null)
  const [recentLogs, setRecentLogs] = useState<VehicleLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [realtimePulse, setRealtimePulse] = useState(0)

  // Role guard: non-operators are sent to the vehicle list
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

  if (authLoading || (user && !canViewDashboard(user.role))) {
    return (
      <AdminPage>
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 bg-primary/10 rounded-xl flex items-center justify-center">
              <RefreshCw className="h-8 w-8 text-primary animate-spin" />
            </div>
            <p className="text-muted-foreground font-semibold text-sm">Đang tải...</p>
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
            <div className="w-16 h-16 bg-primary/10 rounded-xl flex items-center justify-center">
              <RefreshCw className="h-8 w-8 text-primary animate-spin" />
            </div>
            <p className="text-muted-foreground font-semibold text-sm">Đang tải dữ liệu tổng quan...</p>
          </div>
        </div>
      </AdminPage>
    )
  }

  const chartData = (vehicleStats?.dailyStats ?? []).map((d) => ({
    label: d.date ? d.date.slice(5) : "",
    entry: d.entryCount,
    exit: d.exitCount,
    unique: d.uniqueVehicles,
  }))

  const kpis = [
    {
      label: "Tổng phương tiện",
      value: vehicleStats?.totalVehicles ?? 0,
      sub: "Phương tiện được đăng ký",
      icon: Car,
      color: "text-blue-500 bg-blue-500/10 border-blue-500/20",
    },
    {
      label: "Đang hoạt động",
      value: vehicleStats?.activeVehicles ?? 0,
      sub: "Phương tiện đã được duyệt",
      icon: Activity,
      color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
    },
    {
      label: "Lượt vào hôm nay",
      value: todayStats?.entryCount ?? 0,
      sub: "Số lượt xe vào cổng",
      icon: ArrowDownToLine,
      color: "text-teal-500 bg-teal-500/10 border-teal-500/20",
    },
    {
      label: "Lượt ra hôm nay",
      value: todayStats?.exitCount ?? 0,
      sub: "Số lượt xe ra cổng",
      icon: ArrowUpFromLine,
      color: "text-rose-500 bg-rose-500/10 border-rose-500/20",
    },
  ]

  return (
    <AdminPage className="space-y-6">
      {/* Custom Page Header */}
      <AdminPageHeader
        eyebrow="Bảng điều khiển"
        title="Trung tâm điều hành"
        description="Hệ thống giám sát và quản lý vận hành cổng bãi đỗ thông minh thời gian thực."
        actions={
          <div className="flex flex-wrap items-center gap-3">
            {/* Live real-time clock */}
            <div className="flex flex-col items-end px-3 py-1 rounded-xl border border-border bg-card font-mono text-xs shadow-sm min-w-[120px]">
              <span className="text-muted-foreground text-[8px] uppercase tracking-wider font-semibold">Giờ ca trực</span>
              <span className="text-primary font-bold tabular-nums">
                {currentTime || "00:00:00"}
              </span>
            </div>

            <ConnectionPill connected={isConnected} onReconnect={reconnect} />

            <Button
              variant="outline"
              size="sm"
              className="h-10 border-border bg-card hover:bg-muted text-foreground transition-all flex items-center gap-1.5"
              onClick={() => loadData()}
              disabled={loading}
            >
              <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>Nạp lại API</span>
            </Button>
          </div>
        }
      />

      {error && (
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-4 text-xs font-mono text-rose-600 dark:text-rose-400 font-semibold shadow-sm">
          ● LỖI TRUY XUẤT HỆ THỐNG: {error}
        </div>
      )}

      {/* Occupancy metrics section */}
      <MvpAnalytics />

      {/* KPI stats grid */}
      <section aria-labelledby="dashboard-metrics-title" className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <h2 id="dashboard-metrics-title" className="text-xs font-bold tracking-widest text-muted-foreground uppercase">
            Chỉ số cốt lõi hôm nay
          </h2>
        </div>

        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {kpis.map((kpi) => {
            const Icon = kpi.icon
            return (
              <div
                key={kpi.label}
                className="relative overflow-hidden rounded-xl border border-border bg-card p-4 transition-all duration-300 hover:scale-[1.01] shadow-[var(--shadow-card)]"
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground tracking-wide">
                      {kpi.label}
                    </p>
                  </div>
                  <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-xl border", kpi.color)}>
                    <Icon className="size-4" />
                  </span>
                </div>
                <div className="mt-3 flex items-baseline justify-between">
                  <span className="font-mono text-xl sm:text-2xl font-black leading-none tracking-tight text-foreground tabular-nums">
                    {kpi.value.toLocaleString("vi-VN")}
                  </span>
                  <Badge variant="outline" className="text-[9px] font-mono border-muted">Active</Badge>
                </div>
                <p className="mt-1.5 text-[11px] text-muted-foreground truncate">{kpi.sub}</p>
              </div>
            )
          })}
        </div>
      </section>

      {/* Realtime Gate Dashboard */}
      <section aria-label="Theo dõi cổng realtime">
        <RealtimeGateDashboard
          pulse={realtimePulse}
          onError={(message) =>
            toast({ title: "Lỗi dữ liệu realtime", description: message, variant: "destructive" })
          }
        />
      </section>

      {/* Operational trends */}
      <section aria-label="Xu hướng và trạng thái vận hành" className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(20rem,0.75fr)]">
        <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-sm flex flex-col justify-between">
          <div>
            {/* Header */}
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="min-w-0">
                <span className="text-[10px] font-bold text-primary uppercase tracking-widest">
                  Thống kê & Biểu đồ
                </span>
                <h3 className="text-base font-bold text-foreground mt-0.5">Xu hướng lưu lượng</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Biểu đồ thống kê lượt vào/ra và lượng phương tiện duy nhất theo ngày.
                </p>
              </div>
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-muted text-primary border border-border">
                <BarChart3 className="size-4" />
              </span>
            </div>

            {/* Chart Area */}
            {chartData.length === 0 ? (
              <div className="flex flex-col items-center justify-center min-h-[250px] border border-dashed border-border rounded-xl bg-muted/25 p-6 text-center">
                <BarChart3 className="size-8 text-muted-foreground/60 mb-2" />
                <p className="text-sm font-semibold text-muted-foreground">Chưa có dữ liệu xu hướng</p>
                <p className="text-xs text-muted-foreground/70 max-w-sm mt-1">
                  Khi có lượt xe ra/vào cổng, biểu đồ nhịp vận hành sẽ hiển thị tại đây.
                </p>
              </div>
            ) : (
              <div className="h-60 sm:h-80 w-full font-mono text-xs mt-4">
                <ResponsiveContainer>
                  <ComposedChart data={chartData} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-muted/30" opacity={0.4} />
                    <XAxis dataKey="label" tick={{ fill: 'currentColor', fontSize: 10 }} className="text-muted-foreground" stroke="currentColor" />
                    <YAxis tick={{ fill: 'currentColor', fontSize: 10 }} className="text-muted-foreground" stroke="currentColor" allowDecimals={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'var(--background)',
                        borderColor: 'var(--border)',
                        borderRadius: '12px',
                        color: 'var(--foreground)',
                        fontFamily: 'monospace',
                        fontSize: '11px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                      }}
                    />
                    <Bar dataKey="entry" name="Lượt vào" fill="#10b981" radius={[4, 4, 0, 0]} fillOpacity={0.8} />
                    <Bar dataKey="exit" name="Lượt ra" fill="#f43f5e" radius={[4, 4, 0, 0]} fillOpacity={0.8} />
                    <Line
                      type="monotone"
                      dataKey="unique"
                      name="Xe duy nhất"
                      stroke="#3b82f6"
                      strokeWidth={2.5}
                      dot={{ fill: '#3b82f6', strokeWidth: 1 }}
                      activeDot={{ r: 5 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>

        <OperationalSnapshotCard
          connected={isConnected}
          loading={loading}
          recentLogs={recentLogs}
          todayStats={todayStats}
          vehicleStats={vehicleStats}
        />
      </section>

      {/* Bottom panels: Logs & Radar scanning */}
      <section aria-label="Sự kiện và sơ đồ bãi đỗ" className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Live event feed */}
        <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-border">
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              <ListTree className="h-4.5 w-4.5 text-primary" />
              Sự kiện ra vào gần đây
            </h3>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
          </div>

          {recentLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-[220px] border border-dashed border-border rounded-xl bg-muted/20 p-6 text-center">
              <ListTree className="size-8 text-muted-foreground/60 mb-2" />
              <p className="text-sm font-semibold text-muted-foreground">Chưa có sự kiện nào hôm nay</p>
              <p className="text-xs text-muted-foreground/70 max-w-sm mt-1">
                Sự kiện xe ra/vào cổng trong thời gian thực sẽ xuất hiện ở đây.
              </p>
            </div>
          ) : (
            <ol className="max-h-72 space-y-2 overflow-y-auto pr-1 overscroll-contain scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
              {recentLogs.map((log) => (
                <li
                  key={log.id}
                  className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border bg-muted/30 px-3.5 py-2.5 transition-all duration-200 hover:border-muted"
                >
                  <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase border ${
                    log.type === "entry"
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                      : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                  }`}>
                    {log.type === "entry" ? "VÀO" : "RA"}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-mono text-xs font-bold text-foreground tracking-wider">
                      {log.licensePlateNumber}
                    </p>
                    {log.employeeName && (
                      <p className="truncate text-[10px] text-muted-foreground font-medium mt-0.5">
                        {log.employeeName}
                      </p>
                    )}
                  </div>
                  <time className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground" dateTime={log.entryExitTime}>
                    <Clock className="h-3 w-3 text-muted-foreground/60" />
                    {log.entryExitTime
                      ? new Date(log.entryExitTime).toLocaleTimeString("vi-VN")
                      : "—"}
                  </time>
                </li>
              ))}
            </ol>
          )}
        </div>

        {/* High-Tech Active Radar / Parking Area Layout */}
        <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-border">
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              <MapIcon className="h-4.5 w-4.5 text-primary" />
              Sơ đồ vùng đỗ xe
            </h3>
            <Badge variant="outline" className="border-primary/25 bg-primary/5 text-primary text-[10px] uppercase">
              Vận hành ổn định
            </Badge>
          </div>

          <div className="relative flex flex-col items-center justify-center min-h-[220px] border border-border rounded-xl bg-muted/20 p-6 overflow-hidden">
            {/* Background grid */}
            <div className="absolute inset-0 opacity-[0.1]" style={{
              backgroundImage: "linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)",
              backgroundSize: "20px 20px"
            }} />

            {/* Pulsing scanning beam */}
            <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-transparent to-primary/5 animate-pulse border-b border-primary/10" />

            {/* Radar scan circular line */}
            <div className="relative size-32 rounded-full border border-primary/25 flex items-center justify-center">
              <div className="size-24 rounded-full border border-primary/15 flex items-center justify-center">
                <div className="size-16 rounded-full border border-primary/10 flex items-center justify-center">
                  <div className="size-2 bg-primary rounded-full animate-ping" />
                </div>
              </div>
              {/* Spinning sweep arm */}
              <div className="absolute inset-0 origin-center animate-[spin_8s_linear_infinite] pointer-events-none">
                <div className="w-1/2 h-full border-r border-primary/25 bg-gradient-to-l from-primary/5 to-transparent skew-x-12" />
              </div>
            </div>

            <div className="relative z-10 text-center mt-4">
              <p className="text-xs font-mono font-bold text-foreground">HỆ THỐNG KIỂM SOÁT SLOT</p>
              <p className="text-[11px] text-muted-foreground max-w-sm mt-1">
                Giao diện quản lý thông minh. Các phân khu đang đạt hiệu suất tối ưu 82%.
              </p>
            </div>
          </div>
        </div>
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
      label: "LƯU LƯỢNG HÔM NAY",
      value: `${(todayStats?.entryCount ?? 0).toLocaleString("vi-VN")} Vào / ${(todayStats?.exitCount ?? 0).toLocaleString("vi-VN")} Ra`,
      note: `${(todayStats?.uniqueVehicles ?? 0).toLocaleString("vi-VN")} Xe duy nhất`,
      color: "text-emerald-600 dark:text-emerald-400",
    },
    {
      label: "ĐỘI XE VẬN HÀNH",
      value: `${(vehicleStats?.activeVehicles ?? 0).toLocaleString("vi-VN")} / ${(vehicleStats?.totalVehicles ?? 0).toLocaleString("vi-VN")}`,
      note: "Phương tiện hoạt động",
      color: "text-blue-600 dark:text-blue-400",
    },
    {
      label: "SỰ KIỆN MỚI NHẤT",
      value: lastLogTime,
      note: lastLog?.licensePlateNumber ? `Biển số: ${lastLog.licensePlateNumber}` : "Đang chờ ghi nhận",
      color: "text-amber-600 dark:text-amber-400",
    },
  ]

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-sm flex flex-col justify-between">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">TRẠNG THÁI CA TRỰC</span>
          </div>
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-mono font-semibold border ${
            connected
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              : "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400"
          }`}>
            <span className={`size-1.5 rounded-full ${connected ? "bg-emerald-400 animate-pulse" : "bg-rose-400"}`} />
            {connected ? "Gateway Online" : "Gateway Offline"}
          </span>
        </div>

        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={item.label}
              className="rounded-xl border border-border bg-muted/20 p-3.5 flex flex-col justify-between gap-1 transition-all duration-200 hover:border-muted"
            >
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-bold text-muted-foreground">{item.label}</span>
                <span className="text-[8px] font-mono text-muted-foreground">LIVE</span>
              </div>
              <div className="flex items-baseline justify-between mt-1">
                <p className={`text-sm font-bold font-mono ${item.color}`}>
                  {loading ? "Đang tải..." : item.value}
                </p>
                <p className="text-[10px] text-muted-foreground font-medium tracking-wide">{item.note}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-primary/10 bg-primary/5 px-3.5 py-3 text-xs text-primary leading-normal flex items-start gap-2 shadow-sm font-medium">
        <span className="font-bold text-primary">[!]</span>
        <span>Hệ thống ưu tiên đồng bộ WebSocket. Nếu xảy ra gián đoạn, hãy sử dụng nút làm mới ở phía trên.</span>
      </div>
    </div>
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
        className="inline-flex !h-10 shrink-0 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 gap-1.5 px-3.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 shadow-sm"
      >
        <Wifi className="size-3.5" />
        <span>Thời gian thực</span>
      </span>
    )
  }
  return (
    <button
      onClick={onReconnect}
      className="inline-flex !h-10 shrink-0 touch-manipulation items-center justify-center rounded-xl border border-rose-500/30 bg-rose-500/10 gap-1.5 px-3.5 text-xs font-semibold text-rose-600 dark:text-rose-400 transition-opacity duration-150 hover:opacity-80 shadow-sm"
      aria-label="Mất kết nối realtime — nhấn để kết nối lại"
      title="Mất kết nối realtime"
    >
      <WifiOff className="size-3.5" />
      <span>Mất kết nối</span>
    </button>
  )
}
