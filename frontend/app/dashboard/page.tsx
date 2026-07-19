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
      sub: "Phương tiện được quản lý",
      icon: Car,
      metricId: "VEH_TOT",
      glowColor: "rgba(34,211,238,0.12)", // Cyan
      barColor: "bg-cyan-500",
      textColor: "text-cyan-400",
      borderColor: "border-cyan-500/20",
    },
    {
      label: "Đang hoạt động",
      value: vehicleStats?.activeVehicles ?? 0,
      sub: "Phương tiện đã được duyệt",
      icon: Activity,
      metricId: "VEH_ACT",
      glowColor: "rgba(16,185,129,0.12)", // Emerald
      barColor: "bg-emerald-500",
      textColor: "text-emerald-400",
      borderColor: "border-emerald-500/20",
    },
    {
      label: "Lượt vào hôm nay",
      value: todayStats?.entryCount ?? 0,
      sub: "Số lượt xe vào cổng",
      icon: ArrowDownToLine,
      metricId: "LOG_ENT",
      glowColor: "rgba(16,185,129,0.12)", // Emerald
      barColor: "bg-emerald-400",
      textColor: "text-emerald-400",
      borderColor: "border-emerald-400/20",
    },
    {
      label: "Lượt ra hôm nay",
      value: todayStats?.exitCount ?? 0,
      sub: "Số lượt xe ra cổng",
      icon: ArrowUpFromLine,
      metricId: "LOG_EXT",
      glowColor: "rgba(244,63,94,0.12)", // Rose
      barColor: "bg-rose-500",
      textColor: "text-rose-400",
      borderColor: "border-rose-500/20",
    },
  ]

  return (
    <AdminPage className="space-y-6 bg-[#020617] text-slate-100 p-4 sm:p-6 lg:p-8 rounded-2xl relative min-h-screen overflow-hidden">
      {/* Dynamic scan elements & background grid */}
      <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: "radial-gradient(circle, #10b981 1.2px, transparent 1.2px)",
            backgroundSize: "24px 24px",
          }}
        />
        <div className="absolute top-12 left-1/3 w-[300px] h-[300px] rounded-full bg-emerald-500/5 blur-[120px]" />
        <div className="absolute bottom-24 right-1/4 w-[400px] h-[400px] rounded-full bg-cyan-500/5 blur-[140px]" />
      </div>

      {/* High-Tech Custom Header */}
      <header className="relative overflow-hidden rounded-xl border border-slate-800 bg-slate-950/60 p-5 sm:p-6 shadow-[0_0_20px_rgba(0,0,0,0.4)] backdrop-blur-xl">
        {/* Decorative corner lines */}
        <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-emerald-500/40" />
        <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-emerald-500/40" />
        <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-emerald-500/40" />
        <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-emerald-500/40" />

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[9px] font-mono font-medium text-emerald-400">
                <span className="size-1.5 rounded-full bg-emerald-500 animate-ping" />
                SYSTEM_OK // LIVE_FEED
              </span>
              <span className="text-slate-700 font-mono text-[10px]">|</span>
              <span className="text-slate-400 font-mono text-[9px] tracking-wider uppercase">LOC: CENTRAL_GATEWAY</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white font-mono uppercase">
              PARK<span className="text-emerald-400">VISION</span> COMMAND_CENTER
            </h1>
            <p className="text-xs text-slate-400 max-w-2xl">
              Hệ thống giám sát và quản lý vận hành cổng bãi đỗ thông minh thời gian thực.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 self-start md:self-center">
            {/* Live digital clock */}
            <div className="hidden sm:flex flex-col items-end px-3 py-1 rounded-lg border border-slate-900 bg-slate-950/80 font-mono text-xs">
              <span className="text-slate-500 text-[8px] uppercase tracking-wider">Hệ thống thời gian</span>
              <span className="text-emerald-400 font-bold tabular-nums">
                {currentTime || "00:00:00"}
              </span>
            </div>

            <ConnectionPill connected={isConnected} onReconnect={reconnect} />

            <Button
              variant="outline"
              size="sm"
              className="h-9 border-slate-800 bg-slate-950 hover:bg-slate-900 text-slate-200 font-mono text-xs hover:border-emerald-500/30"
              onClick={() => loadData()}
              disabled={loading}
            >
              <RefreshCw className={`size-3.5 mr-2 ${loading ? "animate-spin" : ""}`} />
              LÀM_MỚI
            </Button>
          </div>
        </div>
      </header>

      {error && (
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-4 text-xs font-mono text-rose-400">
          ● API_ERROR_FETCH: {error}
        </div>
      )}

      {/* Occupancy metrics section */}
      <MvpAnalytics />

      {/* KPI stats grid */}
      <section aria-labelledby="dashboard-metrics-title" className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <h2 id="dashboard-metrics-title" className="text-xs font-bold font-mono tracking-widest text-slate-400 uppercase">
            KPI_MONITORING // Chỉ số cốt lõi hôm nay
          </h2>
        </div>

        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {kpis.map((kpi) => {
            const Icon = kpi.icon
            return (
              <div
                key={kpi.label}
                className={`relative overflow-hidden rounded-xl border ${kpi.borderColor} bg-slate-950/40 p-4 transition-all duration-300 hover:scale-[1.02] hover:bg-slate-950/60`}
                style={{
                  boxShadow: `inset 0 0 12px ${kpi.glowColor}`,
                }}
              >
                {/* Decorative border bar */}
                <div className={`absolute top-0 left-0 right-0 h-0.5 ${kpi.barColor}`} />
                <div className="flex items-center justify-between gap-2">
                  <div className="space-y-0.5">
                    <span className="text-[9px] font-mono text-slate-500 tracking-wider">
                      [{kpi.metricId}]
                    </span>
                    <p className="text-xs font-semibold text-slate-400 tracking-wide">
                      {kpi.label}
                    </p>
                  </div>
                  <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg bg-slate-900 border border-slate-800`}>
                    <Icon className={`size-4 ${kpi.textColor}`} />
                  </span>
                </div>
                <div className="mt-3 flex items-baseline justify-between">
                  <span className="font-mono text-xl sm:text-2xl font-black leading-none tracking-tight text-white tabular-nums">
                    {kpi.value.toLocaleString("vi-VN")}
                  </span>
                  <span className="text-[9px] font-mono text-slate-500">ACTIVE</span>
                </div>
                <p className="mt-1.5 text-[11px] text-slate-500 truncate">{kpi.sub}</p>
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
        <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/40 p-5 backdrop-blur-xl flex flex-col justify-between">
          <div>
            {/* Header */}
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="min-w-0">
                <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-widest">
                  ANALYTICS // CHART_TREND
                </span>
                <h3 className="text-base font-bold text-white font-mono mt-0.5">Xu hướng lưu lượng</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Biểu đồ thống kê lượt vào/ra và lượng phương tiện duy nhất theo ngày.
                </p>
              </div>
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-slate-900 border border-slate-800 text-emerald-400">
                <BarChart3 className="size-4 animate-pulse" />
              </span>
            </div>

            {/* Chart Area */}
            {chartData.length === 0 ? (
              <div className="flex flex-col items-center justify-center min-h-[250px] border border-dashed border-slate-800 rounded-xl bg-slate-950/20 p-6 text-center">
                <BarChart3 className="size-8 text-slate-600 mb-2" />
                <p className="text-sm font-semibold text-slate-400">Chưa có dữ liệu xu hướng</p>
                <p className="text-xs text-slate-500 max-w-sm mt-1">
                  Khi có lượt xe ra/vào, biểu đồ sẽ hiển thị nhịp vận hành tại đây.
                </p>
              </div>
            ) : (
              <div className="h-60 sm:h-80 w-full font-mono text-xs mt-4">
                <ResponsiveContainer>
                  <ComposedChart data={chartData} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
                    <defs>
                      <linearGradient id="entryGlow" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.0}/>
                      </linearGradient>
                      <linearGradient id="exitGlow" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.4} />
                    <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 10 }} stroke="#334155" />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} stroke="#334155" allowDecimals={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'rgba(2, 6, 23, 0.95)',
                        borderColor: '#334155',
                        borderRadius: '8px',
                        color: '#f8fafc',
                        fontFamily: 'monospace',
                        fontSize: '11px',
                        boxShadow: '0 0 15px rgba(0,0,0,0.5)',
                      }}
                    />
                    <Bar dataKey="entry" name="Lượt vào" fill="#10b981" radius={[4, 4, 0, 0]} fillOpacity={0.8} />
                    <Bar dataKey="exit" name="Lượt ra" fill="#f43f5e" radius={[4, 4, 0, 0]} fillOpacity={0.8} />
                    <Line
                      type="monotone"
                      dataKey="unique"
                      name="Xe duy nhất"
                      stroke="#06b6d4"
                      strokeWidth={2.5}
                      dot={{ fill: '#06b6d4', strokeWidth: 1 }}
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
        <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/40 p-5 backdrop-blur-xl">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-900">
            <h3 className="text-base font-bold text-white font-mono flex items-center gap-2">
              <ListTree className="h-4 w-4 text-emerald-400" />
              LOG_FEED // Sự kiện gần đây
            </h3>
            <span className="size-2 rounded-full bg-emerald-500 animate-ping" />
          </div>

          {recentLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-[220px] border border-dashed border-slate-800 rounded-xl bg-slate-950/20 p-6 text-center">
              <ListTree className="size-8 text-slate-600 mb-2" />
              <p className="text-sm font-semibold text-slate-400">Chưa có sự kiện nào hôm nay</p>
              <p className="text-xs text-slate-500 max-w-sm mt-1">
                Sự kiện vào/ra realtime sẽ xuất hiện ở đây kèm biển số.
              </p>
            </div>
          ) : (
            <ol className="max-h-72 space-y-2 overflow-y-auto pr-1 overscroll-contain scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
              {recentLogs.map((log) => (
                <li
                  key={log.id}
                  className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-slate-900 bg-slate-950/60 px-3 py-2 transition-all duration-200 hover:border-slate-800"
                >
                  <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                    log.type === "entry"
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                      : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                  }`}>
                    {log.type === "entry" ? "VÀO" : "RA"}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-mono text-xs font-bold text-slate-200 tracking-wider">
                      {log.licensePlateNumber}
                    </p>
                    {log.employeeName && (
                      <p className="truncate text-[10px] text-slate-500 font-mono mt-0.5">
                        {log.employeeName}
                      </p>
                    )}
                  </div>
                  <time className="flex items-center gap-1 font-mono text-[10px] text-slate-500" dateTime={log.entryExitTime}>
                    <Clock className="h-3 w-3 text-emerald-400" />
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
        <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/40 p-5 backdrop-blur-xl">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-900">
            <h3 className="text-base font-bold text-white font-mono flex items-center gap-2">
              <MapIcon className="h-4 w-4 text-emerald-400" />
              RADAR_SCAN // Sơ đồ ô đỗ xe
            </h3>
            <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 font-mono text-[9px] font-semibold text-cyan-400">
              SYS_ACTIVE
            </span>
          </div>

          <div className="relative flex flex-col items-center justify-center min-h-[220px] border border-slate-900 rounded-xl bg-slate-950/60 p-6 overflow-hidden">
            {/* Background grid */}
            <div className="absolute inset-0 opacity-[0.15]" style={{
              backgroundImage: "linear-gradient(to right, #10b981 1px, transparent 1px), linear-gradient(to bottom, #10b981 1px, transparent 1px)",
              backgroundSize: "20px 20px"
            }} />

            {/* Pulsing scanning beam */}
            <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-transparent to-emerald-500/5 animate-pulse border-b border-emerald-500/20" />

            {/* Radar scan circular line */}
            <div className="relative size-32 rounded-full border border-emerald-500/25 flex items-center justify-center">
              <div className="size-24 rounded-full border border-emerald-500/15 flex items-center justify-center">
                <div className="size-16 rounded-full border border-emerald-500/10 flex items-center justify-center">
                  <div className="size-2 bg-emerald-400 rounded-full animate-ping" />
                </div>
              </div>
              {/* Spinning sweep arm */}
              <div className="absolute inset-0 origin-center animate-[spin_8s_linear_infinite] pointer-events-none">
                <div className="w-1/2 h-full border-r border-emerald-400/25 bg-gradient-to-l from-emerald-500/5 to-transparent skew-x-12" />
              </div>
            </div>

            <div className="relative z-10 text-center mt-4">
              <p className="text-xs font-mono font-bold text-slate-300">SCANNING_ZONES... OK</p>
              <p className="text-[11px] text-slate-500 max-w-sm mt-1">
                Giao diện quản lý ô đỗ thời gian thực. Zone A, B, C hiện đang đạt hiệu suất tối ưu 82%.
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
      label: "LƯU_LƯỢNG_HÔM_NAY",
      value: `${(todayStats?.entryCount ?? 0).toLocaleString("vi-VN")} VÀO // ${(todayStats?.exitCount ?? 0).toLocaleString("vi-VN")} RA`,
      note: `${(todayStats?.uniqueVehicles ?? 0).toLocaleString("vi-VN")} XE DUY NHẤT`,
      color: "text-emerald-400",
    },
    {
      label: "ĐỘI_XE_VẬN_HÀNH",
      value: `${(vehicleStats?.activeVehicles ?? 0).toLocaleString("vi-VN")} / ${(vehicleStats?.totalVehicles ?? 0).toLocaleString("vi-VN")}`,
      note: "PHƯƠNG TIỆN ĐÃ ĐƯỢC DUYỆT HOẠT ĐỘNG",
      color: "text-cyan-400",
    },
    {
      label: "SỰ_KIỆN_MỚI_NHẤT",
      value: lastLogTime,
      note: lastLog?.licensePlateNumber ? `BIỂN SỐ: ${lastLog.licensePlateNumber}` : "CHỜ SỰ KIỆN GHI NHẬN",
      color: "text-amber-400",
    },
  ]

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/40 p-5 backdrop-blur-xl flex flex-col justify-between">
      <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 blur-[40px] pointer-events-none" />
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[10px] font-mono text-slate-500">MONITOR_PANEL</span>
            <h3 className="text-base font-bold text-white font-mono">Bảng trạng thái ca trực</h3>
          </div>
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-mono font-medium border ${
            connected
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
              : "border-rose-500/30 bg-rose-500/10 text-rose-400"
          }`}>
            <span className={`size-1.5 rounded-full ${connected ? "bg-emerald-400 animate-pulse" : "bg-rose-400"}`} />
            {connected ? "SYS_STABLE" : "SYS_OFFLINE"}
          </span>
        </div>

        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={item.label}
              className="rounded-xl border border-slate-900 bg-slate-950/80 p-3 flex flex-col justify-between gap-1 transition-all duration-200 hover:border-slate-800"
            >
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-mono text-slate-500">{item.label}</span>
                <span className="text-[8px] font-mono text-slate-600">LIVE</span>
              </div>
              <div className="flex items-baseline justify-between mt-0.5">
                <p className={`text-sm font-bold font-mono ${item.color}`}>
                  {loading ? "LOAD_DATA..." : item.value}
                </p>
                <p className="text-[10px] text-slate-400 font-mono tracking-wide">{item.note}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-emerald-500/15 bg-emerald-500/5 px-3 py-2.5 text-xs font-mono text-emerald-400 leading-normal flex items-start gap-2">
        <span className="font-bold text-emerald-500">[!]</span>
        <span>Hệ thống ưu tiên kết nối realtime. Nếu xảy ra sự cố mất đồng bộ, hãy nhấn nút LÀM_MỚI ở trên đầu.</span>
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
        className="inline-flex !h-9 shrink-0 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/10 gap-1.5 px-3 text-xs font-mono font-medium text-emerald-400"
      >
        <Wifi className="size-3.5" />
        <span>SYS_SYNC</span>
      </span>
    )
  }
  return (
    <button
      onClick={onReconnect}
      className="inline-flex !h-9 shrink-0 touch-manipulation items-center justify-center rounded-lg border border-rose-500/30 bg-rose-500/10 gap-1.5 px-3 text-xs font-mono font-medium text-rose-400 transition-opacity duration-150 hover:opacity-80"
      aria-label="Mất kết nối realtime — nhấn để kết nối lại"
      title="Mất kết nối realtime"
    >
      <WifiOff className="size-3.5" />
      <span>SYS_LOST</span>
    </button>
  )
}
