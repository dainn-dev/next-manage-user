"use client"

import { Car, Clock3, Gauge, Radio, SquareParking } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { DashboardMetricsSection } from "@/components/dashboard/dashboard-metrics-section"
import type { DashboardAnalytics, DashboardSlot } from "@/lib/api/dashboard-api"
import type { RealtimeState } from "@/hooks/use-dashboard-realtime"
import { calculateOccupancyMetrics, formatDuration } from "@/lib/dashboard-metrics.mjs"
import { cn } from "@/lib/utils"

interface ParkingSituationProps {
  analytics: DashboardAnalytics | null
  error?: string | null
  lastUpdatedAt: string | null
  loading?: boolean
  realtime: RealtimeState
  scopeLabel: string
  slots: DashboardSlot[]
}

const realtimeCopy: Record<RealtimeState, { label: string; className: string }> = {
  live: {
    label: "Đang nhận realtime",
    className: "border-[var(--color-success)]/25 bg-[var(--color-success-surface)] text-[var(--color-success)]",
  },
  connecting: {
    label: "Đang kết nối dữ liệu",
    className: "border-primary/30 bg-primary-container text-on-primary-container",
  },
  polling: {
    label: "Đang cập nhật định kỳ",
    className: "border-[var(--color-warning)]/30 bg-[var(--color-warning-surface)] text-[var(--color-serious)]",
  },
  disconnected: {
    label: "Chưa có kết nối trực tiếp",
    className: "border-border bg-muted text-muted-foreground",
  },
}

export function ParkingSituation({
  analytics,
  error,
  lastUpdatedAt,
  loading = false,
  realtime,
  scopeLabel,
  slots,
}: ParkingSituationProps) {
  const metrics = calculateOccupancyMetrics(slots)
  const realtimeStatus = realtimeCopy[realtime]
  const fillPercent = Math.round(metrics.fillRate * 100)
  const hasCapacity = metrics.usableSlots > 0

  const cards = [
    {
      label: "Đang đỗ",
      value: metrics.currentVehicles.toLocaleString("vi-VN"),
      note: hasCapacity ? `trên ${metrics.usableSlots.toLocaleString("vi-VN")} ô khả dụng` : "chưa có ô khả dụng",
      icon: Car,
      tone: "primary",
    },
    {
      label: "Còn trống",
      value: metrics.availableSlots.toLocaleString("vi-VN"),
      note: hasCapacity ? `trên ${metrics.usableSlots.toLocaleString("vi-VN")} ô khả dụng` : "chưa có dữ liệu ô đỗ",
      icon: SquareParking,
      tone: "success",
    },
    {
      label: "Tỷ lệ lấp đầy",
      value: hasCapacity ? `${fillPercent}%` : "—",
      note: hasCapacity ? `${metrics.occupiedSlots.toLocaleString("vi-VN")} ô đã sử dụng` : "cần cấu hình ô đỗ",
      icon: Gauge,
      tone: fillPercent >= 90 ? "critical" : fillPercent >= 75 ? "warning" : "success",
    },
    {
      label: "Thời gian đỗ TB",
      value: analytics?.completedDwellSessions ? formatDuration(analytics.averageDwellSeconds) : "—",
      note: analytics?.completedDwellSessions
        ? `${analytics.completedDwellSessions.toLocaleString("vi-VN")} lượt hoàn tất / 7 ngày`
        : "chưa đủ lượt hoàn tất",
      icon: Clock3,
      tone: "warning",
    },
  ] as const

  return (
    <DashboardMetricsSection
      id="parking-situation-title"
      title="Tình hình bãi đỗ"
      description={`${scopeLabel}. Theo dõi công suất và tình trạng ô đỗ theo dữ liệu mới nhất.`}
      badge={
        <Badge variant="outline" className={cn("gap-1.5", realtimeStatus.className)}>
          <Radio className={cn("size-3", realtime === "live" && "animate-pulse")} aria-hidden="true" />
          {realtimeStatus.label}
        </Badge>
      }
      // meta={lastUpdatedAt && (
      //   <span role="status" className="text-xs tabular-nums text-muted-foreground">
      //     Cập nhật {new Date(lastUpdatedAt).toLocaleTimeString("vi-VN")}
      //   </span>
      // )}
      notice={error && (
        <p role="alert" className="rounded-[var(--radius-input)] border border-destructive/30 bg-[var(--color-critical-surface)] px-3 py-2 text-sm leading-6 text-[var(--color-on-critical)]">
          Một phần dữ liệu bãi đỗ chưa thể đồng bộ. Các số liệu hiển thị có thể chưa mới nhất.
        </p>
      )}
      metricGridClassName="grid-cols-2 lg:grid-cols-4"
      loading={loading}
      metrics={cards}
    >
      {hasCapacity ? (
        <div className="grid gap-1 rounded-[var(--radius-input)] border border-border bg-muted/35 p-2">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm">
            <p className="font-medium text-foreground">Công suất hiện tại</p>
            <p className="tabular-nums text-muted-foreground">{metrics.occupiedSlots}/{metrics.usableSlots} ô đã sử dụng</p>
          </div>
          <div
            role="progressbar"
            aria-label="Tỷ lệ lấp đầy bãi đỗ"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={fillPercent}
            className="h-1.5 overflow-hidden rounded-full bg-background"
          >
            <div
              className={cn(
                "h-full rounded-full transition-[width] duration-300",
                fillPercent >= 90 ? "bg-destructive" : fillPercent >= 75 ? "bg-[var(--color-serious)]" : "bg-[var(--color-success)]",
              )}
              style={{ width: `${fillPercent}%` }}
            />
          </div>
          <p className="text-xs leading-4 text-muted-foreground">
            {metrics.reservedSlots > 0 && `${metrics.reservedSlots} ô đã đặt trước. `}
            {metrics.disabledSlots > 0 && `${metrics.disabledSlots} ô đang tạm ngưng. `}
            {metrics.unknownSlots > 0 && `${metrics.unknownSlots} ô chưa xác định trạng thái.`}
            {!metrics.reservedSlots && !metrics.disabledSlots && !metrics.unknownSlots && "Tất cả ô đỗ đang có trạng thái xác định."}
          </p>
        </div>
      ) : !loading ? (
        <p className="rounded-[var(--radius-input)] border border-dashed border-border bg-muted/30 px-3 py-2 text-sm leading-6 text-muted-foreground">
          Chưa có ô đỗ khả dụng trong phạm vi đang chọn. Hãy cấu hình và xuất bản sơ đồ bãi đỗ để theo dõi công suất.
        </p>
      ) : null}
    </DashboardMetricsSection>
  )
}
