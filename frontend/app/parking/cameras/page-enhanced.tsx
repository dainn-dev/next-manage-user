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
import { CameraStatusBadge } from "@/components/cameras/camera-status-badge"
import { useCameraHealthSubscription } from "@/hooks/use-camera-health-subscription"
import { type Camera as CameraType } from "@/lib/api/camera-api"

export default function LiveCamerasPage() {
  const { cameras: initialCameras, status, error, refresh, realtime, lastUpdatedAt } = useDashboardData()
  const { selectedSiteId, selectedZoneId } = useDashboardScope()
  const [currentTime, setCurrentTime] = React.useState<string>("")
  const [cameras, setCameras] = React.useState<CameraType[]>(initialCameras)

  // Update local cameras state when initial data changes
  React.useEffect(() => {
    setCameras(initialCameras)
  }, [initialCameras])

  // Subscribe to camera health updates
  const { connected: healthConnected } = useCameraHealthSubscription(
    selectedSiteId,
    React.useCallback((event) => {
      setCameras((prev) =>
        prev.map((cam) => {
          if (cam.id !== event.cameraId) return cam

          // Update camera with new runtime health
          return {
            ...cam,
            status: event.status === 'online' ? 'online' : 'offline',
            runtimeHealth: {
              cameraId: event.cameraId,
              agentId: event.agentId,
              connectionState: event.connectionState,
              lastFrameAt: event.lastFrameAt,
              fps: event.fps,
              errorCode: event.errorCode,
              updatedAt: event.occurredAt,
            },
          }
        })
      )
    }, [])
  )

  React.useEffect(() => {
    setCurrentTime(new Date().toLocaleTimeString("vi-VN"))
    const interval = window.setInterval(() => setCurrentTime(new Date().toLocaleTimeString("vi-VN")), 1000)
    return () => window.clearInterval(interval)
  }, [])

  const onlineCount = React.useMemo(
    () => cameras.filter((camera) => camera.status === "online").length,
    [cameras],
  )
  const errorCount = React.useMemo(
    () => cameras.filter((camera) => camera.runtimeHealth?.errorCode).length,
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
      note: healthConnected ? "Cập nhật realtime" : "Polling mỗi 10s",
      icon: Radio,
      tone: "success",
    },
    {
      label: "Ngoại tuyến",
      value: offlineCount.toLocaleString("vi-VN"),
      note: errorCount > 0 ? `${errorCount} camera có lỗi` : "Cần kiểm tra kết nối",
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
              className="rounded-full min-h-11 border-border shadow-sm"
            >
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              {loading ? "Đang tải" : "Làm mới"}
            </Button>
          </div>
        }
      />

      {healthConnected && (
        <div className="flex items-center gap-2 text-sm">
          <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-muted-foreground">Đang nhận cập nhật realtime</span>
        </div>
      )}

      <DashboardMetricsSection metrics={metrics} loading={loading} />

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            <span>Không thể tải dữ liệu camera: {error}</span>
          </div>
        </div>
      )}

      {!loading && cameras.length === 0 ? (
        <AdminEmptyState
          icon={<Camera className="h-12 w-12" />}
          title="Chưa có camera nào"
          description="Vui lòng thêm camera để bắt đầu theo dõi"
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cameras.map((camera) => (
            <Card key={camera.id} className="overflow-hidden">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <h3 className="font-semibold">{camera.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {camera.role === 'ANPR_GATE' ? 'Cổng ra vào' : 'Tổng quan'}
                      {camera.panelType && ` • ${camera.panelType === 'entry' ? 'Vào' : 'Ra'}`}
                    </p>
                  </div>
                  <CameraStatusBadge camera={camera} />
                </div>

                {camera.agentName && (
                  <div className="text-xs text-muted-foreground">
                    <span className="font-medium">Máy:</span> {camera.agentName}
                  </div>
                )}

                {camera.runtimeHealth?.errorCode && (
                  <div className="p-2 rounded bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800">
                    <p className="text-xs text-red-600 dark:text-red-400 font-medium">
                      {camera.runtimeHealth.errorCode}
                    </p>
                    {camera.runtimeHealth.errorMessageSafe && (
                      <p className="text-xs text-red-600/80 dark:text-red-400/80 mt-1">
                        {camera.runtimeHealth.errorMessageSafe}
                      </p>
                    )}
                  </div>
                )}

                {camera.runtimeHealth && !camera.runtimeHealth.errorCode && (
                  <div className="flex gap-4 text-xs text-muted-foreground">
                    {camera.runtimeHealth.fps && (
                      <div>
                        <span className="font-medium">FPS:</span> {camera.runtimeHealth.fps.toFixed(1)}
                      </div>
                    )}
                    {camera.runtimeHealth.queueDepth !== undefined && camera.runtimeHealth.queueDepth > 0 && (
                      <div className="text-amber-600">
                        <span className="font-medium">Queue:</span> {camera.runtimeHealth.queueDepth}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </AdminPage>
  )
}
