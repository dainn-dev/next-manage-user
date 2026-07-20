import { Activity, ArrowDownToLine, ArrowUpFromLine, Car, Radio } from "lucide-react"

import { DashboardMetricsSection } from "@/components/dashboard/dashboard-metrics-section"
import { Badge } from "@/components/ui/badge"
import type { VehicleLogStatistics } from "@/lib/api/vehicle-log-api"
import type { VehicleStatistics } from "@/lib/types"
import { cn } from "@/lib/utils"

interface CoreTodayMetricsProps {
  connected: boolean
  lastEventAt?: string | null
  loading?: boolean
  todayStats: VehicleLogStatistics | null
  vehicleStats: VehicleStatistics | null
}

export function CoreTodayMetrics({
  connected,
  lastEventAt,
  loading = false,
  todayStats,
  vehicleStats,
}: CoreTodayMetricsProps) {
  const metrics = [
    {
      label: "Tổng phương tiện",
      value: vehicleStats ? vehicleStats.totalVehicles.toLocaleString("vi-VN") : "—",
      note: "Phương tiện đã đăng ký",
      icon: Car,
      tone: "primary",
    },
    {
      label: "Đang hoạt động",
      value: vehicleStats ? vehicleStats.activeVehicles.toLocaleString("vi-VN") : "—",
      note: "Phương tiện đã được duyệt",
      icon: Activity,
      tone: "success",
    },
    {
      label: "Lượt vào hôm nay",
      value: todayStats ? todayStats.entryCount.toLocaleString("vi-VN") : "—",
      note: "Đã ghi nhận tại cổng",
      icon: ArrowDownToLine,
      tone: "serious",
    },
    {
      label: "Lượt ra hôm nay",
      value: todayStats ? todayStats.exitCount.toLocaleString("vi-VN") : "—",
      note: "Đã hoàn tất phiên đỗ",
      icon: ArrowUpFromLine,
      tone: "critical",
    },
  ] as const

  return (
    <DashboardMetricsSection
      id="dashboard-metrics-title"
      title="Chỉ số cốt lõi hôm nay"
      description="Tóm tắt đội xe đã đăng ký và lưu lượng được ghi nhận tại các cổng."
      action={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Badge
            variant="outline"
            className={cn(
              "gap-1.5",
              connected
                ? "border-[var(--color-success)]/25 bg-[var(--color-success-surface)] text-[var(--color-success)]"
                : "border-border bg-muted text-muted-foreground",
            )}
          >
            <Radio className={cn("size-3", connected && "animate-pulse")} aria-hidden="true" />
            {connected ? "Đang nhận realtime" : "Đang chờ realtime"}
          </Badge>
          {lastEventAt && (
            <span role="status" className="text-xs tabular-nums text-muted-foreground">
              Event gần nhất {new Date(lastEventAt).toLocaleTimeString("vi-VN")}
            </span>
          )}
        </div>
      }
      loading={loading}
      metrics={metrics}
    />
  )
}
