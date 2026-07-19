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
import { useDashboardData } from "@/lib/dashboard-data-context"
import { useDashboardScope } from "@/lib/dashboard-scope-context"
import { AdminPage, AdminPageHeader, AdminEmptyState } from "@/components/layout/admin-page"
import { Button } from "@/components/ui/button"

export default function LiveCamerasPage() {
  const { cameras, status, error, refresh, realtime, lastUpdatedAt } = useDashboardData()
  const { selectedSiteId, selectedZoneId } = useDashboardScope()

  const [currentTime, setCurrentTime] = React.useState<string>("")

  // Realtime clock
  React.useEffect(() => {
    if (typeof window !== "undefined") {
      setCurrentTime(new Date().toLocaleTimeString("vi-VN"))
      const interval = setInterval(() => {
        setCurrentTime(new Date().toLocaleTimeString("vi-VN"))
      }, 1000)
      return () => clearInterval(interval)
    }
  }, [])

  const onlineCount = React.useMemo(() => {
    return cameras.filter((c) => c.status === "ONLINE" || c.status === "ACTIVE").length
  }, [cameras])

  const offlineCount = React.useMemo(() => {
    return cameras.length - onlineCount
  }, [cameras, onlineCount])

  const loading = status === "loading" || status === "idle"

  return (
    <AdminPage className="space-y-6">
      {/* Page Header */}
      <AdminPageHeader
        eyebrow="Giám sát bãi xe"
        title="Camera trực tuyến"
        description="Giám sát trực tiếp các camera an ninh AI tại bãi xe. Chỉ hiển thị camera thuộc site và zone đang được chọn."
        actions={
          <div className="flex flex-wrap items-center gap-3">
            {/* Live real-time clock */}
            <div className="flex flex-col items-end px-3 py-1 rounded-xl border border-border bg-card font-mono text-xs shadow-sm min-w-[120px]">
              <span className="text-muted-foreground text-[8px] uppercase tracking-wider font-semibold">Giờ hệ thống</span>
              <span className="text-primary font-bold tabular-nums">
                {currentTime || "00:00:00"}
              </span>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => void refresh()}
              disabled={loading}
              className="h-10 px-3.5 rounded-xl border border-border bg-card hover:bg-muted text-foreground transition-all flex items-center gap-1.5"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin text-primary" : ""}`} />
              <span>Nạp lại API</span>
            </Button>
          </div>
        }
      />

      {/* Stats Cards */}
      <section className="grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-3" aria-label="Thông số camera">
        {[
          {
            label: "TỔNG SỐ CAMERA",
            value: loading && cameras.length === 0 ? "..." : cameras.length,
            icon: Camera,
            color: "text-blue-500 dark:text-blue-400 bg-blue-500/10 border-blue-500/20",
          },
          {
            label: "CAMERA ONLINE",
            value: loading && cameras.length === 0 ? "..." : onlineCount,
            icon: Radio,
            color: "text-emerald-500 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
          },
          {
            label: "CAMERA OFFLINE",
            value: loading && cameras.length === 0 ? "..." : offlineCount,
            icon: WifiOff,
            color: "text-rose-500 dark:text-rose-400 bg-rose-500/10 border-rose-500/20",
            className: "col-span-2 sm:col-span-1",
          },
        ].map(({ label, value, icon: Icon, color, className }) => (
          <div
            key={label}
            className={`relative overflow-hidden rounded-xl border border-border bg-card p-4 transition-all duration-300 hover:scale-[1.01] shadow-[var(--shadow-card)] ${className ?? ""}`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
              <span className="flex h-1.5 w-1.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary/40 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary"></span>
              </span>
            </div>
            <div className="flex items-center gap-3 mt-3">
              <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl border ${color}`}>
                <Icon className="size-5" />
              </span>
              <div>
                <p className="text-xl sm:text-2xl font-bold tracking-tight text-foreground font-mono">
                  {value}
                </p>
              </div>
            </div>
          </div>
        ))}
      </section>

      {/* Connection fallback status */}
      {realtime !== "live" && (
        <div className="flex flex-col gap-2 rounded-xl border border-primary/20 bg-primary/5 p-3.5 text-xs text-primary sm:flex-row sm:items-center shadow-sm font-medium">
          <div className="flex min-w-0 items-start gap-2">
            <Activity className="mt-0.5 size-4 shrink-0 text-primary animate-pulse" />
            <span className="min-w-0 uppercase text-[10px] tracking-wide leading-relaxed">
              Đồng bộ camera định kỳ: Đang tự động cập nhật trạng thái kết nối camera định kỳ từ Gateway.
            </span>
          </div>
          {lastUpdatedAt && (
            <span className="shrink-0 text-[10px] text-primary/80 sm:ml-auto">
              ĐỒNG BỘ CUỐI: {new Date(lastUpdatedAt).toLocaleTimeString("vi-VN")}
            </span>
          )}
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-500/20 bg-rose-500/5 p-3.5 text-xs text-rose-600 dark:text-rose-400 shadow-sm font-medium">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-rose-500" />
          <div className="min-w-0">
            <span className="text-[9px] font-mono block text-rose-500 font-bold mb-1">SYSTEM_ERROR</span>
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Main Grid View */}
      {!selectedSiteId ? (
        <AdminEmptyState
          icon={<Camera className="size-6 text-muted-foreground" />}
          title="Chưa chọn phân khu bãi xe"
          description="Vui lòng chọn một phân khu (site) ở bộ điều phối phía trên để xem luồng truyền hình ảnh camera tương ứng."
        />
      ) : loading && cameras.length === 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="relative aspect-video rounded-xl border border-border bg-muted/30 overflow-hidden shadow-sm"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-muted/40 to-transparent animate-pulse" />
              <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground font-mono">
                <Loader2 className="size-4 animate-spin mr-2 text-primary" />
                CONNECTING_CHANNEL_{index}...
              </div>
            </div>
          ))}
        </div>
      ) : cameras.length === 0 ? (
        <AdminEmptyState
          icon={<Camera className="size-6 text-muted-foreground" />}
          title="Không tìm thấy camera"
          description={selectedZoneId ? "Khu vực đang chọn chưa có nguồn camera giám sát nào." : "Phân khu đang chọn chưa thiết lập nguồn camera giám sát nào."}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {cameras.map((camera) => (
            <CameraTile key={camera.id} camera={camera} />
          ))}
        </div>
      )}
    </AdminPage>
  )
}
