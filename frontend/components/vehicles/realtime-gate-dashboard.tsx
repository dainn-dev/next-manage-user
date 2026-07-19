"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ArrowDownToLine, ArrowUpFromLine, Car, AlertTriangle, RefreshCw, Users } from "lucide-react"
import { vehicleLogApi } from "@/lib/api/vehicle-log-api"
import { vehicleApi } from "@/lib/api/vehicle-api"
import type { Vehicle } from "@/lib/types"

interface RealtimeGateDashboardProps {
  // Increment this value (e.g. on each WebSocket vehicle-check message) to
  // trigger an immediate refresh of the realtime counters.
  pulse?: number
  // Optional callback so the parent can react to a failed load (e.g. toast).
  onError?: (message: string) => void
}

const REFRESH_INTERVAL_MS = 30000

export function RealtimeGateDashboard({ pulse, onError }: RealtimeGateDashboardProps) {
  const [entryCount, setEntryCount] = useState(0)
  const [exitCount, setExitCount] = useState(0)
  const [uniqueVehicles, setUniqueVehicles] = useState(0)
  const [insideVehicles, setInsideVehicles] = useState<Vehicle[]>([])
  const [todayEntryPlates, setTodayEntryPlates] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const [stats, entered, todayLogs] = await Promise.all([
        vehicleLogApi.getTodayStatistics().catch(() => null),
        vehicleApi.getVehiclesByStatus("entered").catch(() => [] as Vehicle[]),
        vehicleLogApi.getTodayLogs(0, 500).catch(() => null),
      ])

      if (stats) {
        setEntryCount(stats.entryCount)
        setExitCount(stats.exitCount)
        setUniqueVehicles(stats.uniqueVehicles)
      }
      setInsideVehicles(entered)

      const plates = new Set<string>()
      if (todayLogs) {
        for (const log of todayLogs.content) {
          if (log.type === "entry" && log.licensePlateNumber) {
            plates.add(log.licensePlateNumber)
          }
        }
      }
      setTodayEntryPlates(plates)

      setError(null)
      setLastUpdated(new Date())
    } catch {
      const message = "Không thể tải dữ liệu cổng realtime"
      setError(message)
      onError?.(message)
    } finally {
      setLoading(false)
    }
  }, [onError])

  // Initial load.
  useEffect(() => {
    refresh()
  }, [refresh])

  // Refresh whenever the parent reports a new WebSocket vehicle-check event.
  useEffect(() => {
    if (pulse === undefined) return
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pulse])

  // Polling fallback (keeps counters fresh even without WebSocket events).
  useEffect(() => {
    const id = setInterval(() => refresh(), REFRESH_INTERVAL_MS)
    return () => clearInterval(id)
  }, [refresh])

  // A vehicle that is currently `entered` but has no entry log today must have
  // entered on a previous day → it stayed overnight. The backend
  // VehicleSchedulerService.resetEnteredVehicleStatuses resets these to `exited`
  // at 1 AM, so this list only populates before the daily reset runs.
  const { insideToday, overnight } = useMemo(() => {
    const today: Vehicle[] = []
    const night: Vehicle[] = []
    for (const v of insideVehicles) {
      if (todayEntryPlates.has(v.licensePlate)) {
        today.push(v)
      } else {
        night.push(v)
      }
    }
    return { insideToday: today, overnight: night }
  }, [insideVehicles, todayEntryPlates])

  const totalInside = insideVehicles.length

  const metrics = [
    {
      label: "Lượt vào",
      value: entryCount,
      icon: ArrowDownToLine,
      id: "GATE_IN_COUNT",
      color: "text-emerald-600",
      glow: "rgba(16,185,129,0.04)",
      border: "border-emerald-100",
      bg: "bg-emerald-50/20",
    },
    {
      label: "Lượt ra",
      value: exitCount,
      icon: ArrowUpFromLine,
      id: "GATE_OUT_COUNT",
      color: "text-rose-600",
      glow: "rgba(244,63,94,0.04)",
      border: "border-rose-100",
      bg: "bg-rose-50/20",
    },
    {
      label: "Xe duy nhất",
      value: uniqueVehicles,
      icon: Users,
      id: "UNIQUE_VEH_COUNT",
      color: "text-cyan-600",
      glow: "rgba(6,182,212,0.04)",
      border: "border-cyan-100",
      bg: "bg-cyan-50/20",
    },
    {
      label: "Đang trong cổng",
      value: totalInside,
      icon: Car,
      id: "CURRENT_ACTIVE_IN",
      color: "text-amber-600",
      glow: "rgba(245,158,11,0.04)",
      border: "border-amber-100",
      bg: "bg-amber-50/20",
    },
  ]

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
      {/* Decorative pulse glow in the top-right */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 blur-[50px] pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4 mb-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-emerald-600 uppercase tracking-widest font-semibold">
              LIVE_FEED // MONITORING
            </span>
            <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
          </div>
          <h3 className="text-base font-bold text-foreground font-mono flex items-center gap-2 mt-0.5">
            <Car className="size-4 text-emerald-600" />
            Cổng realtime hôm nay
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Theo dõi thời gian thực lượt ra vào, tổng xe duy nhất và các phương tiện đang trong cổng.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          className="h-8 shrink-0 self-start sm:self-center border-border bg-background text-muted-foreground font-mono text-xs hover:border-emerald-500/30 hover:text-emerald-600 hover:bg-emerald-50"
          onClick={refresh}
          disabled={loading}
        >
          <RefreshCw className={`size-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
          LÀM_MỚI
        </Button>
      </div>

      <div className="space-y-4">
        {error && (
          <div className="rounded-xl border border-rose-100 bg-rose-50/50 p-3 text-xs font-mono text-rose-600">
            ● ERROR_API_FEED: {error}
          </div>
        )}

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {metrics.map((metric) => {
            const Icon = metric.icon
            return (
              <div
                key={metric.label}
                className={`min-w-0 rounded-xl border ${metric.border} ${metric.bg} p-3 flex flex-col justify-between transition-all duration-300 hover:scale-[1.01]`}
                style={{
                  boxShadow: `inset 0 0 10px ${metric.glow}`,
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[8px] font-mono text-muted-foreground/80">[{metric.id}]</span>
                  <span className="text-[8px] font-mono text-muted-foreground/60">ACTIVE</span>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <span className={`grid size-8 shrink-0 place-items-center rounded-lg bg-white border border-slate-100`}>
                    <Icon className={`size-4 ${metric.color}`} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-mono text-slate-500 uppercase tracking-wide truncate">
                      {metric.label}
                    </p>
                    <p className={`font-mono text-lg sm:text-xl font-bold leading-none mt-1 ${metric.color}`}>
                      {metric.value.toLocaleString("vi-VN")}
                    </p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Overnight Warning */}
        {overnight.length > 0 && (
          <div className="p-3.5 rounded-xl border border-rose-100 bg-rose-50/30 space-y-2">
            <div className="flex items-center gap-2 text-rose-600 font-mono text-xs font-semibold">
              <AlertTriangle className="h-4 w-4 animate-bounce" />
              <span>[!] WARNING // OVERNIGHT_DETECTION: {overnight.length} xe đỗ qua đêm</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {overnight.map((v) => (
                <Badge
                  key={v.id}
                  variant="outline"
                  className="bg-white text-slate-700 border-rose-200 font-mono text-[10px] py-0.5 px-2"
                >
                  {v.licensePlate}
                  {v.employeeName ? ` — ${v.employeeName}` : ""}
                </Badge>
              ))}
            </div>
            <p className="text-[10px] text-slate-400 font-mono">
              VehicleSchedulerService sẽ tự động chuyển trạng thái thành &quot;đã ra&quot; lúc 01:00 AM mỗi ngày.
            </p>
          </div>
        )}

        {/* Active Lot Section */}
        {totalInside > 0 && overnight.length < totalInside && (
          <div className="space-y-2">
            <p className="text-[10px] text-slate-500 font-mono">
              &gt; VEHICLES_INSIDE_GATE: {insideToday.length}
            </p>
            <div className="flex flex-wrap gap-2">
              {insideToday.map((v) => (
                <Badge
                  key={v.id}
                  variant="secondary"
                  className="bg-slate-100 text-slate-700 border border-slate-200 font-mono text-[10px] py-0.5 px-2 hover:bg-slate-200/80"
                >
                  {v.licensePlate}
                  {v.employeeName ? ` — ${v.employeeName}` : ""}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Footer info bar */}
        {(totalInside === 0 || lastUpdated) && !error && (
          <div className="flex flex-col gap-1 rounded-xl border border-border bg-slate-50/50 px-3 py-2 text-[10px] font-mono text-slate-500 sm:flex-row sm:items-center sm:justify-between">
            {totalInside === 0 ? (
              <span>● NO_VEHICLES_PRESENT // Không có xe nào đang đỗ trong cổng.</span>
            ) : (
              <span>● STREAM_SYNC_ACTIVE // Cổng kết nối thời gian thực ổn định.</span>
            )}
            {lastUpdated && (
              <span className="shrink-0">ĐỒNG_BỘ: {lastUpdated.toLocaleTimeString("vi-VN")}</span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
