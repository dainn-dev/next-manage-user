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
      tone: "text-emerald-700",
      surface: "bg-emerald-50",
      border: "border-emerald-200/80",
    },
    {
      label: "Lượt ra",
      value: exitCount,
      icon: ArrowUpFromLine,
      tone: "text-rose-700",
      surface: "bg-rose-50",
      border: "border-rose-200/80",
    },
    {
      label: "Xe duy nhất",
      value: uniqueVehicles,
      icon: Users,
      tone: "text-sky-700",
      surface: "bg-sky-50",
      border: "border-sky-200/80",
    },
    {
      label: "Đang trong cổng",
      value: totalInside,
      icon: Car,
      tone: "text-teal-700",
      surface: "bg-teal-50",
      border: "border-teal-200/80",
    },
  ]

  return (
    <Card className="overflow-hidden gap-0 py-0">
      <div
        className={`h-1 w-full ${error ? "bg-[var(--color-critical)]" : "bg-[var(--color-success)]"}`}
        aria-hidden="true"
      />
      <CardHeader className="grid-cols-[minmax(0,1fr)_auto] gap-x-3 px-4 pb-0 pt-4 sm:px-5 sm:pt-5">
        <div className="min-w-0">
          <CardTitle className="flex min-w-0 items-center gap-2 text-sm sm:text-lg">
            <Car className="size-5 shrink-0 text-primary" />
            Cổng realtime hôm nay
            <span
              className={`inline-flex size-2.5 shrink-0 rounded-full ${
                error ? "bg-[var(--color-critical)]" : "bg-[var(--color-success)] animate-pulse"
              }`}
              aria-label={error ? "Mất kết nối dữ liệu" : "Cập nhật realtime"}
            />
          </CardTitle>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">
            Theo dõi lượt vào/ra, xe duy nhất và xe còn trong cổng theo thời gian thực.
          </p>
        </div>
        <CardAction>
          <Button
            variant="outline"
            size="icon"
            className="!h-8 !min-h-8 !w-8 shrink-0 rounded-lg !p-0 shadow-none sm:!h-10 sm:!min-h-10 sm:!w-auto sm:px-3"
            onClick={refresh}
            disabled={loading}
            aria-label="Làm mới cổng realtime"
            title="Làm mới"
          >
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
            <span className="sr-only sm:not-sr-only sm:ml-2">Làm mới</span>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-3 px-4 pb-4 pt-3 sm:px-5 sm:pb-5 sm:pt-4">
        {error && (
          <div className="rounded-xl border border-[var(--color-critical)] bg-[var(--color-critical-surface)] p-3 text-sm text-[var(--color-critical)]">{error}</div>
        )}

        <div className="grid grid-cols-2 gap-2.5 xl:grid-cols-4">
          {metrics.map((metric) => {
            const Icon = metric.icon
            return (
              <div key={metric.label} className={`min-w-0 rounded-xl border bg-background/80 p-2.5 text-left ${metric.border}`}>
                <div className={`mb-1.5 inline-flex max-w-full items-center gap-1.5 rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold ${metric.surface} ${metric.tone}`}>
                  <Icon className="h-3.5 w-3.5" />
                  <span className="truncate">{metric.label}</span>
                </div>
                <div className={`font-[family:var(--font-display)] text-xl font-bold leading-none tracking-[-0.025em] tabular-nums sm:text-3xl sm:tracking-[-0.03em] ${metric.tone}`}>
                  {metric.value.toLocaleString("vi-VN")}
                </div>
              </div>
            )
          })}
        </div>

        {overnight.length > 0 && (
          <div className="p-3 rounded-lg border border-amber-300 bg-amber-50">
            <div className="flex items-center gap-2 mb-2 text-amber-800">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm font-medium">
                Cảnh báo: {overnight.length} xe ở lại qua đêm (vào ngày trước, chưa ra)
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {overnight.map((v) => (
                <Badge key={v.id} variant="outline" className="bg-white border-amber-300">
                  {v.licensePlate}
                  {v.employeeName ? ` — ${v.employeeName}` : ""}
                </Badge>
              ))}
            </div>
            <p className="text-xs text-amber-700 mt-2">
              Bộ định giờ backend (VehicleSchedulerService) sẽ tự đặt lại thành &quot;đã ra&quot; lúc 1:00 sáng.
            </p>
          </div>
        )}

        {totalInside > 0 && overnight.length < totalInside && (
          <div>
            <p className="text-xs text-muted-foreground mb-2">
              Đang trong cổng (vào hôm nay): {insideToday.length}
            </p>
            <div className="flex flex-wrap gap-2">
              {insideToday.map((v) => (
                <Badge key={v.id} variant="secondary">
                  {v.licensePlate}
                  {v.employeeName ? ` — ${v.employeeName}` : ""}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {(totalInside === 0 || lastUpdated) && !error && (
          <div className="flex flex-col gap-1 rounded-lg border border-border/70 bg-muted/25 px-3 py-2 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            {totalInside === 0 && <span>Hiện không có xe nào đang trong cổng.</span>}
            {lastUpdated && <span className="shrink-0">Cập nhật {lastUpdated.toLocaleTimeString("vi-VN")}</span>}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
