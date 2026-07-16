"use client"

import type { LucideIcon } from "lucide-react"
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  CarFront,
  Clock3,
  Gauge,
  ParkingSquare,
  RefreshCw,
  TriangleAlert,
  Video,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useDashboardData } from "@/lib/dashboard-data-context"
import { calculateOccupancyMetrics, formatDuration } from "@/lib/dashboard-metrics.mjs"
import { useDashboardScope } from "@/lib/dashboard-scope-context"

interface MetricCardProps {
  label: string
  value: string
  description: string
  icon: LucideIcon
  loading?: boolean
}

function MetricCard({ label, value, description, icon: Icon, loading = false }: MetricCardProps) {
  return (
    <Card aria-label={label}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{label}</CardTitle>
        <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="mb-2 h-8 w-24 animate-pulse rounded bg-muted" aria-label="Đang tải" />
        ) : (
          <p className="text-2xl font-semibold tabular-nums">{value}</p>
        )}
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  )
}

export default function StatisticsPage() {
  const {
    sites,
    zones,
    selectedSiteId,
    selectedZoneId,
    isLoading: scopeLoading,
    error: scopeError,
    retry,
  } = useDashboardScope()
  const {
    cameras,
    slots,
    analytics,
    status,
    error: dataError,
    realtime,
    realtimeError,
    lastUpdatedAt,
    refresh,
  } = useDashboardData()

  const selectedSite = sites.find((site) => site.id === selectedSiteId)
  const selectedZone = zones.find((zone) => zone.id === selectedZoneId)
  const metrics = calculateOccupancyMetrics(slots)
  const loading = scopeLoading || status === "idle" || status === "loading"
  const analyticsAvailable = analytics !== null
  const onlineCameras = cameras.filter((camera) => camera.status === "ONLINE").length
  const partialError = dataError || realtimeError

  if (!scopeLoading && !selectedSiteId) {
    return (
      <div className="admin-mobile-page">
        <Card className="mx-auto max-w-xl">
          <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
            <ParkingSquare className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
            <div>
              <h1 className="text-xl font-semibold">Chưa có khu vực để thống kê</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Tạo hoặc yêu cầu quyền truy cập một khu vực trước khi xem số liệu vận hành.
              </p>
            </div>
            {scopeError && (
              <Button variant="outline" onClick={retry}>
                <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
                Thử tải lại
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  const trafficValue = (value: number | undefined) =>
    analyticsAvailable && value !== undefined ? value.toLocaleString("vi-VN") : "—"

  return (
    <div className="admin-mobile-page space-y-6">
      <header className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold text-foreground">Thống kê vận hành</h1>
            <Badge variant="outline">{realtime === "live" ? "Realtime" : "Đang đồng bộ"}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {selectedSite?.name || "Khu vực đang chọn"}
            {selectedZone ? ` · ${selectedZone.name}` : " · Tất cả zone"}
          </p>
          {lastUpdatedAt && (
            <time className="mt-1 block text-xs text-muted-foreground" dateTime={lastUpdatedAt}>
              Cập nhật lúc {new Date(lastUpdatedAt).toLocaleTimeString("vi-VN")}
            </time>
          )}
        </div>
        <Button variant="outline" onClick={() => void refresh()} disabled={loading || !selectedSiteId}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
          Làm mới
        </Button>
      </header>

      {partialError && (
        <div
          className="flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4"
          role="status"
        >
          <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <div>
            <p className="text-sm font-medium">Một số số liệu chưa thể cập nhật</p>
            <p className="mt-1 text-xs text-muted-foreground">{partialError}</p>
          </div>
        </div>
      )}

      <section aria-labelledby="occupancy-statistics" className="space-y-3">
        <div>
          <h2 id="occupancy-statistics" className="text-lg font-semibold">Công suất hiện tại</h2>
          <p className="text-sm text-muted-foreground">
            {selectedZone ? "Số liệu ô đỗ theo zone đang chọn." : "Số liệu ô đỗ trên toàn site đang chọn."}
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Xe đang trong bãi"
            value={metrics.currentVehicles.toLocaleString("vi-VN")}
            description={`${metrics.occupiedSlots} ô đang có xe`}
            icon={CarFront}
            loading={loading}
          />
          <MetricCard
            label="Tỷ lệ lấp đầy"
            value={`${(metrics.fillRate * 100).toFixed(1)}%`}
            description={`${metrics.occupiedSlots}/${metrics.usableSlots} ô khả dụng đang được sử dụng`}
            icon={Gauge}
            loading={loading}
          />
          <MetricCard
            label="Ô còn trống"
            value={metrics.availableSlots.toLocaleString("vi-VN")}
            description={`${metrics.reservedSlots} ô đặt trước · ${metrics.unknownSlots} chưa xác định`}
            icon={ParkingSquare}
            loading={loading}
          />
          <MetricCard
            label="Tổng công suất"
            value={metrics.usableSlots.toLocaleString("vi-VN")}
            description={`${metrics.totalSlots} ô cấu hình · ${metrics.disabledSlots} ô tạm ngưng`}
            icon={ParkingSquare}
            loading={loading}
          />
        </div>
      </section>

      <section aria-labelledby="traffic-statistics" className="space-y-3">
        <div>
          <h2 id="traffic-statistics" className="text-lg font-semibold">Lưu lượng hôm nay</h2>
          <p className="text-sm text-muted-foreground">
            Số liệu ra/vào trên toàn site {selectedSite?.name || "đang chọn"}, không bị giới hạn bởi zone.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <MetricCard
            label="Lượt vào"
            value={trafficValue(analytics?.entries)}
            description="Số lượt xe qua cổng vào hôm nay"
            icon={ArrowDownToLine}
            loading={loading}
          />
          <MetricCard
            label="Lượt ra"
            value={trafficValue(analytics?.exits)}
            description="Số lượt xe qua cổng ra hôm nay"
            icon={ArrowUpFromLine}
            loading={loading}
          />
          <MetricCard
            label="Xe duy nhất"
            value={trafficValue(analytics?.uniqueVehicles)}
            description="Biển số khác nhau được ghi nhận hôm nay"
            icon={CarFront}
            loading={loading}
          />
        </div>
      </section>

      <section aria-labelledby="system-statistics" className="space-y-3">
        <div>
          <h2 id="system-statistics" className="text-lg font-semibold">Thiết bị và thời gian đỗ</h2>
          <p className="text-sm text-muted-foreground">
            Camera theo scope đang chọn; dwell tính trên các lượt đỗ hoàn tất trong 7 ngày gần nhất của site.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <MetricCard
            label="Camera trực tuyến"
            value={`${onlineCameras}/${cameras.length}`}
            description="Camera online trên tổng camera trong scope"
            icon={Video}
            loading={loading}
          />
          <MetricCard
            label="Thời gian đỗ trung bình"
            value={
              analyticsAvailable
                ? analytics.completedDwellSessions
                  ? formatDuration(analytics.averageDwellSeconds)
                  : "Chưa đủ dữ liệu"
                : "—"
            }
            description={
              analyticsAvailable
                ? `${analytics.completedDwellSessions} lượt đỗ hoàn tất trong mẫu`
                : "Không thể tải dữ liệu dwell"
            }
            icon={Clock3}
            loading={loading}
          />
        </div>
      </section>
    </div>
  )
}
