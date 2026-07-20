"use client"

import * as React from "react"
import {
  AlertCircle,
  Camera,
  RefreshCw,
  Radio,
  Activity,
  WifiOff,
  Loader2,
} from "lucide-react"

import { CameraTile } from "@/components/dashboard/camera-tile"
import { DashboardMetricsSection } from "@/components/dashboard/dashboard-metrics-section"
import { useDashboardData } from "@/lib/dashboard-data-context"
import { useDashboardScope } from "@/lib/dashboard-scope-context"
import { AdminPage, AdminPageHeader, AdminEmptyState } from "@/components/layout/admin-page"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

export default function LiveCamerasPage() {
  const { cameras, status, error, refresh, realtime, lastUpdatedAt } = useDashboardData()
  const { selectedSiteId, selectedZoneId } = useDashboardScope()
  const [currentTime, setCurrentTime] = React.useState<string>("")

  React.useEffect(() => {
    setCurrentTime(new Date().toLocaleTimeString("vi-VN"))
    const interval = window.setInterval(() => setCurrentTime(new Date().toLocaleTimeString("vi-VN")), 1000)
    return () => window.clearInterval(interval)
  }, [])

  const onlineCount = React.useMemo(
    () => cameras.filter((camera) => camera.status === "ONLINE" || camera.status === "ACTIVE").length,
    [cameras],
  )
  const offlineCount = cameras.length - onlineCount
  const loading = status === "loading" || status === "idle"
  const scopeLabel = selectedZoneId ? "khu vực đang chọn" : "site đang chọn"

  const metrics = [
    {
      label: "Tổng camera",
      value: cameras.length.toLocaleString("vi-VN"),
      note: `Trong ${scopeLabel}`,
      icon: Camera,
      tone: "primary",
    },
    {
      label: "Đang trực tuyến",
      value: onlineCount.toLocaleString("vi-VN"),
      note: "Sẵn sàng truyền hình ảnh",
      icon: Radio,
      tone: "success",
    },
    {
      label: "Ngoại tuyến",
      value: offlineCount.toLocaleString("vi-VN"),
      note: "Cần kiểm tra kết nối",
      icon: WifiOff,
      tone: "critical",
    },
  ] as const

  return (
    <AdminPage className="space-y-5">
      <AdminPageHeader
        eyebrow="Vận hành bãi xe"
        title="Camera trực tuyến"
        description="Theo dõi nguồn hình ảnh thuộc site và khu vực đang chọn với dữ liệu được cập nhật tự động."
        actions={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <div className="flex min-h-11 items-center justify-between gap-3 rounded-2xl border border-border bg-card px-3 text-sm shadow-sm sm:min-w-36">
              <span className="text-muted-foreground">Giờ hệ thống</span>
              <span className="font-semibold tabular-nums text-foreground">{currentTime || "00:00:00"}</span>
            </div>
            <Button
              variant="outline"
              onClick={() => void refresh()}
              disabled={loading}
              className="min-h-11 rounded-2xl border-border bg-card px-4 text-foreground hover:bg-muted"
            >
              <RefreshCw className={`mr-2 size-4 ${loading ? "animate-spin text-primary" : ""}`} />
              Làm mới
            </Button>
          </div>
        }
      />

      <DashboardMetricsSection
        id="camera-metrics-title"
        title="Thông số camera"
        description={`Tổng quan trạng thái kết nối camera trong ${scopeLabel}.`}
        badge={(
          <Badge
            variant="outline"
            className={realtime === "live"
              ? "gap-1.5 border-[var(--color-success)]/25 bg-[var(--color-success-surface)] text-[var(--color-success)]"
              : "gap-1.5 border-[var(--color-warning)]/25 bg-[var(--color-warning-surface)] text-[var(--color-serious)]"}
          >
            <Activity className={`size-3 ${realtime === "live" ? "animate-pulse" : ""}`} aria-hidden="true" />
            {realtime === "live" ? "Đang nhận realtime" : "Đồng bộ định kỳ"}
          </Badge>
        )}
        loading={loading && cameras.length === 0}
        metricGridClassName="sm:grid-cols-3"
        metrics={metrics}
      />

      {realtime !== "live" && (
        <Card className="border-primary/20 bg-primary/5 shadow-none">
          <CardContent className="flex flex-col gap-2 p-4 text-sm text-foreground sm:flex-row sm:items-center">
            <div className="flex min-w-0 items-start gap-2">
              <Activity className="mt-0.5 size-4 shrink-0 text-primary" />
              <span>Đang đồng bộ định kỳ trạng thái kết nối camera từ Gateway.</span>
            </div>
            {lastUpdatedAt && <Badge variant="secondary" className="w-fit sm:ml-auto">Cập nhật {new Date(lastUpdatedAt).toLocaleTimeString("vi-VN")}</Badge>}
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="border-rose-200 bg-rose-50 shadow-none">
          <CardContent className="flex items-start gap-2 p-4 text-sm text-rose-800">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <div><p className="font-medium">Không thể tải camera</p><p className="mt-1 text-rose-700">{error}</p></div>
          </CardContent>
        </Card>
      )}

      {!selectedSiteId ? (
        <AdminEmptyState
          icon={<Camera className="size-6 text-muted-foreground" />}
          title="Chưa chọn site"
          description="Chọn một site ở bộ điều phối phía trên để xem các camera tương ứng."
        />
      ) : loading && cameras.length === 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Card key={index} className="overflow-hidden border-border bg-card shadow-sm">
              <CardContent className="flex aspect-video items-center justify-center gap-2 bg-muted/40 p-4 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin text-primary" /> Đang tải camera
              </CardContent>
            </Card>
          ))}
        </div>
      ) : cameras.length === 0 ? (
        <AdminEmptyState
          icon={<Camera className="size-6 text-muted-foreground" />}
          title="Không tìm thấy camera"
          description={selectedZoneId ? "Khu vực đang chọn chưa có nguồn camera giám sát." : "Site đang chọn chưa thiết lập nguồn camera giám sát."}
        />
      ) : (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Danh sách camera trực tuyến">
          {cameras.map((camera) => <CameraTile key={camera.id} camera={camera} />)}
        </section>
      )}
    </AdminPage>
  )
}
