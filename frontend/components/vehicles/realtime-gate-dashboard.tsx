"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { DashboardMetricsSection } from "@/components/dashboard/dashboard-metrics-section"
import { ArrowDownToLine, ArrowUpFromLine, Car, AlertTriangle, Users } from "lucide-react"
import { vehicleLogApi } from "@/lib/api/vehicle-log-api"
import { vehicleApi } from "@/lib/api/vehicle-api"
import type { Vehicle } from "@/lib/types"

interface RealtimeGateDashboardProps {
  pulse?: number
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
      for (const log of todayLogs?.content ?? []) {
        if (log.type === "entry" && log.licensePlateNumber) plates.add(log.licensePlateNumber)
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

  useEffect(() => { void refresh() }, [refresh])
  useEffect(() => {
    if (pulse !== undefined) void refresh()
    // A WebSocket event is the sole trigger for this effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pulse])
  useEffect(() => {
    const id = window.setInterval(() => void refresh(), REFRESH_INTERVAL_MS)
    return () => window.clearInterval(id)
  }, [refresh])

  const { insideToday, overnight } = useMemo(() => {
    const today: Vehicle[] = []
    const night: Vehicle[] = []
    for (const vehicle of insideVehicles) {
      if (todayEntryPlates.has(vehicle.licensePlate)) today.push(vehicle)
      else night.push(vehicle)
    }
    return { insideToday: today, overnight: night }
  }, [insideVehicles, todayEntryPlates])

  const totalInside = insideVehicles.length
  const metrics = [
    { label: "Lượt vào", value: entryCount.toLocaleString("vi-VN"), note: "Từ đầu ngày", icon: ArrowDownToLine, tone: "success" },
    { label: "Lượt ra", value: exitCount.toLocaleString("vi-VN"), note: "Đã hoàn tất phiên", icon: ArrowUpFromLine, tone: "critical" },
    { label: "Xe duy nhất", value: uniqueVehicles.toLocaleString("vi-VN"), note: "Biển số khác nhau", icon: Users, tone: "primary" },
    { label: "Đang trong bãi", value: totalInside.toLocaleString("vi-VN"), note: "Trạng thái đã vào", icon: Car, tone: "warning" },
  ] as const

  return (
    <DashboardMetricsSection
      id="realtime-gate-title"
      title="Cổng hôm nay"
      description="Theo dõi lượt ra vào, số xe duy nhất và các phương tiện đang có trong bãi."
      badge={
        <Badge variant="outline" className="gap-1.5 border-primary/30 bg-primary-container text-on-primary-container">
          Dữ liệu cổng realtime
        </Badge>
      }
      meta={lastUpdated && (
        <span role="status" className="text-xs tabular-nums text-muted-foreground">
          Cập nhật {lastUpdated.toLocaleTimeString("vi-VN")}
        </span>
      )}
      notice={error && (
        <p role="alert" className="rounded-[var(--radius-input)] border border-destructive/30 bg-[var(--color-critical-surface)] p-3 text-sm text-[var(--color-on-critical)]">
          {error}
        </p>
      )}
      loading={loading}
      metrics={metrics}
    >
      {overnight.length > 0 && (
          <section aria-label="Xe đỗ qua đêm" className="rounded-[var(--radius-input)] border border-destructive/30 bg-[var(--color-critical-surface)] p-4">
            <div className="flex items-start gap-2 text-sm font-semibold text-[var(--color-on-critical)]"><AlertTriangle className="mt-0.5 size-5 shrink-0" /><p>{overnight.length} xe đỗ qua đêm</p></div>
            <div className="mt-3 flex flex-wrap gap-2">{overnight.map((vehicle) => <Badge key={vehicle.id} variant="outline" className="border-destructive/30 bg-card text-foreground">{vehicle.licensePlate}{vehicle.employeeName ? ` — ${vehicle.employeeName}` : ""}</Badge>)}</div>
            <p className="mt-3 text-xs leading-5 text-[var(--color-on-critical)]">Hệ thống sẽ tự chuyển trạng thái xe thành “đã ra” lúc 01:00 mỗi ngày.</p>
          </section>
        )}

      {insideToday.length > 0 && (
          <section aria-label="Xe đã vào hôm nay" className="grid gap-2">
            <p className="text-sm font-medium text-foreground">Xe đang trong bãi hôm nay ({insideToday.length})</p>
            <div className="flex flex-wrap gap-2">{insideToday.map((vehicle) => <Badge key={vehicle.id} variant="secondary">{vehicle.licensePlate}{vehicle.employeeName ? ` — ${vehicle.employeeName}` : ""}</Badge>)}</div>
          </section>
        )}

      {!error && (
        <p role="status" className="rounded-[var(--radius-input)] bg-muted px-3 py-2 text-xs leading-5 text-muted-foreground">
          {totalInside === 0 ? "Hiện không có xe nào trong bãi." : "Dữ liệu cổng đang được đồng bộ theo thời gian thực."}
        </p>
      )}
    </DashboardMetricsSection>
  )
}
