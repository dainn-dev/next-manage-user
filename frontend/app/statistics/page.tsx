"use client"

import * as React from "react"
import type { LucideIcon } from "lucide-react"
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  CarFront,
  Clock3,
  Gauge,
  Loader2,
  ParkingSquare,
  RefreshCw,
  TriangleAlert,
  Video,
} from "lucide-react"
import { DashboardMetricsSection } from "@/components/dashboard/dashboard-metrics-section"
import { AdminPage, AdminPageHeader } from "@/components/layout/admin-page"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useDashboardData } from "@/lib/dashboard-data-context"
import { calculateOccupancyMetrics, formatDuration } from "@/lib/dashboard-metrics.mjs"
import { useDashboardScope } from "@/lib/dashboard-scope-context"

interface MetricCardProps {
  label: string
  value: string
  description: string
  icon: LucideIcon
  loading?: boolean
  progress?: number
}

function MetricCard({ label, value, description, icon: Icon, loading = false, progress }: MetricCardProps) {
  const safeProgress = progress === undefined ? undefined : Math.min(100, Math.max(0, progress))

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="min-w-0">
          <CardTitle className="text-sm">{label}</CardTitle>
          <CardDescription className="mt-1 leading-5">{description}</CardDescription>
        </div>
        <div className="grid size-10 shrink-0 place-items-center rounded-full bg-primary-container text-on-primary-container">
          <Icon className="size-5" aria-hidden="true" />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="space-y-2" aria-label="Đang tải">
            <div className="h-7 w-24 animate-pulse rounded bg-muted" />
            <div className="h-3 w-full max-w-48 animate-pulse rounded bg-muted" />
          </div>
        ) : (
          <>
            <p className="text-xl font-semibold tracking-tight text-foreground">{value}</p>
            {safeProgress !== undefined && (
              <div className="space-y-1.5" aria-label={`${label}: ${safeProgress.toFixed(1)}%`}>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-[width] duration-500"
                    style={{ width: `${safeProgress}%` }}
                  />
                </div>
                <p className="text-right text-xs text-muted-foreground">{safeProgress.toFixed(1)}%</p>
              </div>
            )}
          </>
        )}
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
      <AdminPage size="narrow" className="justify-center">
        <Card>
          <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
            <div className="grid size-14 place-items-center rounded-full bg-primary-container text-on-primary-container">
              <ParkingSquare className="size-7" aria-hidden="true" />
            </div>
            <div>
              <h1 className="font-semibold text-foreground">Chưa chọn khu vực</h1>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Vui lòng chọn khu vực bãi đỗ hoặc yêu cầu quyền truy cập trước khi xem thông số vận hành.
              </p>
            </div>
            {scopeError && (
              <p className="w-full rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-left text-sm text-destructive">
                {scopeError}
              </p>
            )}
            <Button variant="outline" onClick={retry}>
              <RefreshCw />
              Thử lại
            </Button>
          </CardContent>
        </Card>
      </AdminPage>
    )
  }

  const trafficValue = (value: number | undefined) =>
    analyticsAvailable && value !== undefined ? value.toLocaleString("vi-VN") : "—"
  const occupancyMetrics = [
    {
      label: "Xe đang trong bãi",
      value: metrics.currentVehicles.toLocaleString("vi-VN"),
      note: `${metrics.occupiedSlots.toLocaleString("vi-VN")} ô đang có xe nhận diện`,
      icon: CarFront,
      tone: "primary",
    },
    {
      label: "Tỷ lệ lấp đầy",
      value: `${(metrics.fillRate * 100).toFixed(1)}%`,
      note: `${metrics.occupiedSlots}/${metrics.usableSlots} ô khả dụng đang vận hành`,
      icon: Gauge,
      tone: metrics.fillRate >= 0.9 ? "critical" : metrics.fillRate >= 0.75 ? "serious" : "warning",
    },
    {
      label: "Ô còn trống",
      value: metrics.availableSlots.toLocaleString("vi-VN"),
      note: `${metrics.reservedSlots} ô đặt trước · ${metrics.unknownSlots} chưa xác định`,
      icon: ParkingSquare,
      tone: "success",
    },
    {
      label: "Tổng công suất",
      value: metrics.usableSlots.toLocaleString("vi-VN"),
      note: `${metrics.totalSlots} ô cấu hình · ${metrics.disabledSlots} ô tạm ngưng`,
      icon: ParkingSquare,
      tone: "primary",
    },
  ] as const
  const trafficMetrics = [
    {
      label: "Lượt xe vào",
      value: trafficValue(analytics?.entries),
      note: "Số lượt xe qua cổng vào trong ngày hôm nay.",
      icon: ArrowDownToLine,
      tone: "success",
    },
    {
      label: "Lượt xe ra",
      value: trafficValue(analytics?.exits),
      note: "Số lượt xe qua cổng ra trong ngày hôm nay.",
      icon: ArrowUpFromLine,
      tone: "critical",
    },
    {
      label: "Xe duy nhất",
      value: trafficValue(analytics?.uniqueVehicles),
      note: "Biển số xe khác nhau được ghi nhận hôm nay.",
      icon: CarFront,
      tone: "primary",
    },
  ] as const

  const scopeDescription = (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <span>{selectedSite?.name || "Khu vực đang chọn"}</span>
      <span aria-hidden="true">·</span>
      <span>{selectedZone ? selectedZone.name : "Tất cả khu vực con"}</span>
      {lastUpdatedAt && (
        <>
          <span aria-hidden="true">·</span>
          <time dateTime={lastUpdatedAt}>Cập nhật {new Date(lastUpdatedAt).toLocaleTimeString("vi-VN")}</time>
        </>
      )}
    </span>
  )

  return (
    <AdminPage>
      <AdminPageHeader
        eyebrow="Phân tích vận hành"
        title="Thống kê bãi đỗ"
        description={scopeDescription}
        actions={
          <>
            <Badge variant={realtime === "live" ? "default" : "secondary"} className="h-10 px-3">
              <span className="size-2 rounded-full bg-current" aria-hidden="true" />
              {realtime === "live" ? "Đang cập nhật" : "Đang đồng bộ"}
            </Badge>
            <Button
              variant="outline"
              size="icon"
              onClick={() => void refresh()}
              disabled={loading || !selectedSiteId}
              aria-label="Làm mới"
              title="Làm mới"
            >
              <RefreshCw className={loading ? "animate-spin" : undefined} />
            </Button>
          </>
        }
      />

      {partialError && (
        <Card className="border-destructive/30 bg-destructive/10">
          <CardContent className="flex items-start gap-3">
            <TriangleAlert className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden="true" />
            <div>
              <p className="font-medium text-foreground">Một số chỉ số chưa thể đồng bộ</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{partialError}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <DashboardMetricsSection
        id="occupancy-statistics"
        title="Công suất hiện tại"
        description="Khả năng đáp ứng của khu vực đang được chọn."
        badge={(
          <Badge
            variant="outline"
            className={realtime === "live"
              ? "gap-1.5 border-[var(--color-success)]/25 bg-[var(--color-success-surface)] text-[var(--color-success)]"
              : "gap-1.5 border-[var(--color-warning)]/25 bg-[var(--color-warning-surface)] text-[var(--color-serious)]"}
          >
            <span className={`size-1.5 rounded-full bg-current ${realtime === "live" ? "animate-pulse" : ""}`} aria-hidden="true" />
            {realtime === "live" ? "Đang nhận realtime" : "Đồng bộ định kỳ"}
          </Badge>
        )}
        meta={lastUpdatedAt ? (
          <time className="text-xs text-muted-foreground" dateTime={lastUpdatedAt}>
            Cập nhật {new Date(lastUpdatedAt).toLocaleTimeString("vi-VN")}
          </time>
        ) : undefined}
        loading={loading}
        metrics={occupancyMetrics}
      />

      <DashboardMetricsSection
        id="traffic-statistics"
        title="Lưu lượng hôm nay"
        description="Dữ liệu qua cổng kiểm soát trong ngày hiện tại."
        badge={<Badge variant="outline" className="border-primary/30 bg-primary-container text-on-primary-container">Theo dữ liệu cổng</Badge>}
        loading={loading}
        metricGridClassName="sm:grid-cols-3"
        metrics={trafficMetrics}
      />

      <section className="space-y-4" aria-labelledby="system-statistics">
        <div>
          <h2 className="text-base font-semibold text-foreground" id="system-statistics">Thiết bị và thời gian đỗ</h2>
          <p className="mt-1 text-sm text-muted-foreground">Thông tin sức khỏe thiết bị và hành vi đỗ xe.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <MetricCard
            label="Camera trực tuyến"
            value={`${onlineCameras}/${cameras.length}`}
            description="Số camera đang hoạt động trong phạm vi lựa chọn."
            icon={Video}
            loading={loading}
            progress={cameras.length > 0 ? (onlineCameras / cameras.length) * 100 : 0}
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
                ? `${analytics.completedDwellSessions} lượt đỗ hoàn thành trong chu kỳ mẫu 7 ngày.`
                : "Không thể trích xuất dữ liệu trung bình lúc này."
            }
            icon={Clock3}
            loading={loading}
          />
        </div>
      </section>
    </AdminPage>
  )
}
