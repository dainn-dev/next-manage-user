"use client"

import * as React from "react"
import {
  AlertCircle,
  Car,
  CircleParking,
  RefreshCw,
  SquareParking,
  Activity,
  Loader2,
} from "lucide-react"

import { ParkingMap } from "@/components/dashboard/parking-map"
import { AdminEmptyState, AdminPage, AdminPageHeader } from "@/components/layout/admin-page"
import { Button } from "@/components/ui/button"
import { useDashboardData } from "@/lib/dashboard-data-context"
import { useDashboardScope } from "@/lib/dashboard-scope-context"
import { cn } from "@/lib/utils"

export default function ParkingMapPage() {
  const { slots, status, error, refresh, realtime, lastUpdatedAt } = useDashboardData()
  const { selectedSiteId, selectedZoneId } = useDashboardScope()
  
  const occupied = slots.filter((slot) => slot.status === "OCCUPIED").length
  const available = slots.filter((slot) => slot.status === "AVAILABLE").length
  const scopeLabel = selectedZoneId ? "khu vực đang chọn" : "phân khu đang chọn"

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

  const loading = status === "loading" || status === "idle"

  return (
    <AdminPage className="space-y-6">
      {/* Page Header */}
      <AdminPageHeader
        eyebrow="Giám sát bãi xe"
        title="Sơ đồ bãi xe"
        description={`Theo dõi trực quan phân bổ ô đỗ theo ${scopeLabel}, hiển thị trạng thái lấp đầy, thông tin phương tiện hiện hữu trong thời gian thực.`}
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
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin text-primary")} />
              <span>Nạp lại API</span>
            </Button>
          </div>
        }
      />

      {/* Stats Cards */}
      <section className="grid min-w-0 grid-cols-3 gap-3" aria-label="Thông số ô đỗ">
        {[
          { 
            label: "TỔNG SỐ Ô ĐỖ", 
            value: loading && slots.length === 0 ? "..." : slots.length, 
            icon: SquareParking, 
            color: "text-blue-500 dark:text-blue-400 bg-blue-500/10 border-blue-500/20" 
          },
          { 
            label: "CÒN TRỐNG", 
            value: loading && slots.length === 0 ? "..." : available, 
            icon: CircleParking, 
            color: "text-emerald-500 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20" 
          },
          { 
            label: "ĐANG CÓ XE", 
            value: loading && slots.length === 0 ? "..." : occupied, 
            icon: Car, 
            color: "text-rose-500 dark:text-rose-400 bg-rose-500/10 border-rose-500/20" 
          },
        ].map(({ label, value, icon: Icon, color }) => (
          <div
            key={label}
            className="relative overflow-hidden rounded-xl border border-border bg-card p-3 sm:p-4 transition-all duration-300 hover:scale-[1.01] shadow-[var(--shadow-card)]"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
              <span className="flex h-1.5 w-1.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary/40 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary"></span>
              </span>
            </div>
            <div className="flex items-center gap-3 mt-3">
              <span className={`flex size-8 sm:size-9 shrink-0 items-center justify-center rounded-xl border ${color}`}>
                <Icon className="size-4 sm:size-4.5" />
              </span>
              <div>
                <p className="text-lg sm:text-2xl font-bold tracking-tight text-foreground font-mono">
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
              Đồng bộ bản đồ định kỳ: Đang tự động cập nhật trạng thái bản đồ định kỳ từ Gateway.
            </span>
          </div>
          {lastUpdatedAt && (
            <span className="shrink-0 text-[10px] text-primary/80 sm:ml-auto font-mono">
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

      {/* Main Map Visualization Area */}
      {!selectedSiteId ? (
        <AdminEmptyState
          icon={<SquareParking className="size-6 text-muted-foreground" />}
          title="Chưa chọn phân khu bãi xe"
          description="Vui lòng chọn một phân khu (site) ở bộ điều phối phía trên để xem sơ đồ bãi xe và trạng thái từng ô đỗ."
        />
      ) : loading ? (
        <div className="flex min-h-[22rem] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card p-10 gap-4 text-xs text-muted-foreground">
          <Loader2 className="size-8 animate-spin text-primary" />
          <span className="font-semibold uppercase tracking-wider">Đang tải cấu trúc hình học sơ đồ...</span>
        </div>
      ) : slots.length === 0 ? (
        <AdminEmptyState
          icon={<SquareParking className="size-6 text-muted-foreground" />}
          title="Sơ đồ chưa có dữ liệu ô đỗ"
          description="Hãy thiết kế và xuất bản bản đồ từ Map Designer để hiển thị sơ đồ và trạng thái các ô đỗ tại đây."
        />
      ) : (
        <div className="relative overflow-hidden rounded-xl border border-border bg-card p-4 sm:p-6 shadow-sm">
          <ParkingMap slots={slots} />
        </div>
      )}
    </AdminPage>
  )
}
