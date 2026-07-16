"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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

  return (
    <Card className="gap-0 py-0">
      <CardHeader className="flex min-w-0 flex-row items-center justify-between gap-2 px-4 pb-0 pt-4 sm:px-6 sm:pt-6">
        <CardTitle className="flex min-w-0 items-center gap-2 text-base">
          <Car className="size-5 shrink-0 text-primary" />
          Cổng realtime hôm nay
          <span
            className={`inline-flex size-2.5 shrink-0 rounded-full ${
              error ? "bg-[var(--color-critical)]" : "bg-[var(--color-success)] animate-pulse"
            }`}
            aria-label={error ? "Mất kết nối dữ liệu" : "Cập nhật realtime"}
          />
        </CardTitle>
        <Button variant="outline" className="min-h-11 shrink-0 touch-manipulation" onClick={refresh} disabled={loading}>
          <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
          Làm mới
        </Button>
      </CardHeader>
      <CardContent className="space-y-4 px-4 pb-4 pt-4 sm:px-6 sm:pb-6">
        {error && (
          <div className="text-sm text-[var(--color-critical)]">{error}</div>
        )}

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-md border bg-background p-3 text-left">
            <div className="mb-2 flex items-center gap-1 text-[var(--color-success)]">
              <ArrowDownToLine className="h-4 w-4" />
              <span className="text-xs font-medium">Lượt vào</span>
            </div>
            <div className="text-2xl font-bold text-[var(--color-success)]">{entryCount}</div>
          </div>
          <div className="rounded-md border bg-background p-3 text-left">
            <div className="mb-2 flex items-center gap-1 text-[var(--color-critical)]">
              <ArrowUpFromLine className="h-4 w-4" />
              <span className="text-xs font-medium">Lượt ra</span>
            </div>
            <div className="text-2xl font-bold text-[var(--color-critical)]">{exitCount}</div>
          </div>
          <div className="rounded-md border bg-background p-3 text-left">
            <div className="mb-2 flex items-center gap-1 text-[var(--color-signal)]">
              <Users className="h-4 w-4" />
              <span className="text-xs font-medium">Xe duy nhất</span>
            </div>
            <div className="text-2xl font-bold text-[var(--color-signal)]">{uniqueVehicles}</div>
          </div>
          <div className="rounded-md border bg-background p-3 text-left">
            <div className="mb-2 flex items-center gap-1 text-[var(--color-accent)]">
              <Car className="h-4 w-4" />
              <span className="text-xs font-medium">Đang trong cổng</span>
            </div>
            <div className="text-2xl font-bold text-[var(--color-accent)]">{totalInside}</div>
          </div>
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

        {totalInside === 0 && !error && (
          <p className="text-xs text-muted-foreground">
            Hiện không có xe nào đang trong cổng.
          </p>
        )}

        {lastUpdated && (
          <p className="text-xs text-muted-foreground">
            Cập nhật lúc: {lastUpdated.toLocaleTimeString("vi-VN")}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
