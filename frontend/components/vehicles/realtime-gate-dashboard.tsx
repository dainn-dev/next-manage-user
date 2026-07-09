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
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Car className="h-5 w-5 text-blue-600" />
          Cổng realtime hôm nay
          <span
            className={`ml-2 inline-flex h-2.5 w-2.5 rounded-full ${
              error ? "bg-red-500" : "bg-green-500 animate-pulse"
            }`}
            title={error ? "Mất kết nối dữ liệu" : "Cập nhật realtime"}
          />
        </CardTitle>
        <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
          Làm mới
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="text-sm text-red-600">{error}</div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="text-center p-3 border rounded-lg">
            <div className="flex items-center justify-center gap-1 mb-1 text-green-600">
              <ArrowDownToLine className="h-4 w-4" />
              <span className="text-xs font-medium">Lượt vào</span>
            </div>
            <div className="text-2xl font-bold text-green-600">{entryCount}</div>
          </div>
          <div className="text-center p-3 border rounded-lg">
            <div className="flex items-center justify-center gap-1 mb-1 text-red-600">
              <ArrowUpFromLine className="h-4 w-4" />
              <span className="text-xs font-medium">Lượt ra</span>
            </div>
            <div className="text-2xl font-bold text-red-600">{exitCount}</div>
          </div>
          <div className="text-center p-3 border rounded-lg">
            <div className="flex items-center justify-center gap-1 mb-1 text-blue-600">
              <Users className="h-4 w-4" />
              <span className="text-xs font-medium">Xe duy nhất</span>
            </div>
            <div className="text-2xl font-bold text-blue-600">{uniqueVehicles}</div>
          </div>
          <div className="text-center p-3 border rounded-lg">
            <div className="flex items-center justify-center gap-1 mb-1 text-purple-600">
              <Car className="h-4 w-4" />
              <span className="text-xs font-medium">Đang trong cổng</span>
            </div>
            <div className="text-2xl font-bold text-purple-600">{totalInside}</div>
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