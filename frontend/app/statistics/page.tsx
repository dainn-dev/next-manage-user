"use client"

import * as React from "react"
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
  Activity,
  Cpu,
  Server,
  Database
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AdminPage, AdminPageHeader } from "@/components/layout/admin-page"
import { useDashboardData } from "@/lib/dashboard-data-context"
import { calculateOccupancyMetrics, formatDuration } from "@/lib/dashboard-metrics.mjs"
import { useDashboardScope } from "@/lib/dashboard-scope-context"
import { cn } from "@/lib/utils"

interface MetricCardProps {
  label: string
  code: string
  value: string
  description: string
  icon: LucideIcon
  loading?: boolean
  progress?: number
  color?: "cyan" | "emerald" | "amber" | "slate"
}

function MetricCard({
  label,
  code,
  value,
  description,
  icon: Icon,
  loading = false,
  progress,
  color = "cyan"
}: MetricCardProps) {
  const colorMap = {
    cyan: {
      text: "text-cyan-400",
      border: "border-cyan-500/20 hover:border-cyan-500/40",
      bg: "bg-cyan-950/10",
      bar: "bg-cyan-500",
      pulse: "bg-cyan-500",
      glow: "shadow-[0_0_15px_rgba(6,182,212,0.15)]"
    },
    emerald: {
      text: "text-emerald-400",
      border: "border-emerald-500/20 hover:border-emerald-500/40",
      bg: "bg-emerald-950/10",
      bar: "bg-emerald-500",
      pulse: "bg-emerald-500",
      glow: "shadow-[0_0_15px_rgba(16,185,129,0.15)]"
    },
    amber: {
      text: "text-amber-400",
      border: "border-amber-500/20 hover:border-amber-500/40",
      bg: "bg-amber-950/10",
      bar: "bg-amber-500",
      pulse: "bg-amber-500",
      glow: "shadow-[0_0_15px_rgba(245,158,11,0.15)]"
    },
    slate: {
      text: "text-slate-400",
      border: "border-slate-800 hover:border-slate-700",
      bg: "bg-slate-950/10",
      bar: "bg-slate-600",
      pulse: "bg-slate-500",
      glow: ""
    }
  }

  const activeColor = colorMap[color]

  return (
    <Card
      aria-label={label}
      className={cn(
        "border bg-slate-950/40 text-slate-100 shadow-xl relative overflow-hidden backdrop-blur-xl transition-all duration-300 group",
        activeColor.border
      )}
    >
      {/* Sci-fi tech corner ticks */}
      <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-slate-800 group-hover:border-slate-500 transition-colors" />
      <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-slate-800 group-hover:border-slate-500 transition-colors" />
      <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-slate-800 group-hover:border-slate-500 transition-colors" />
      <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-slate-800 group-hover:border-slate-500 transition-colors" />

      {/* Cyber grid overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.01)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.01)_1px,transparent_1px)] bg-[size:16px_16px] pointer-events-none opacity-20" />

      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 border-b border-slate-900/60">
        <div className="space-y-0.5">
          <p className="font-mono text-[9px] tracking-widest text-slate-500 uppercase">{code}</p>
          <CardTitle className="text-xs font-mono tracking-wide text-slate-300 uppercase">{label}</CardTitle>
        </div>
        <div className={cn("p-2 rounded-lg bg-slate-950/85 border border-slate-900", activeColor.text, activeColor.glow)}>
          <Icon className="h-4 w-4" aria-hidden="true" />
        </div>
      </CardHeader>
      
      <CardContent className="pt-5 space-y-3 p-5">
        {loading ? (
          <div className="space-y-2.5">
            <div className="h-8 w-28 animate-pulse rounded bg-slate-900" aria-label="Đang tải" />
            <div className="h-3 w-40 animate-pulse rounded bg-slate-900" />
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-2xl font-mono font-bold tracking-tight text-white select-all">{value}</p>
            
            {progress !== undefined && (
              <div className="space-y-1">
                <div className="h-1 w-full bg-slate-900 rounded-full overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all duration-500", activeColor.bar)}
                    style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                  />
                </div>
                <div className="flex justify-between items-center text-[9px] font-mono text-slate-500">
                  <span>RATIO_CAPACITY</span>
                  <span>{progress.toFixed(1)}%</span>
                </div>
              </div>
            )}

            <p className="text-[10px] font-mono text-slate-400 uppercase leading-relaxed tracking-wider">
              {description}
            </p>
          </div>
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
      <AdminPage size="narrow" className="justify-center min-h-dvh flex items-center">
        <Card className="mx-auto max-w-lg border border-slate-800 bg-slate-950/40 text-slate-100 shadow-2xl relative overflow-hidden backdrop-blur-xl">
          {/* Cyber ticks */}
          <div className="absolute top-0 left-0 w-2.5 h-2.5 border-t-2 border-l-2 border-cyan-500/30" />
          <div className="absolute top-0 right-0 w-2.5 h-2.5 border-t-2 border-r-2 border-cyan-500/30" />
          <div className="absolute bottom-0 left-0 w-2.5 h-2.5 border-b-2 border-l-2 border-cyan-500/30" />
          <div className="absolute bottom-0 right-0 w-2.5 h-2.5 border-b-2 border-r-2 border-cyan-500/30" />

          <CardContent className="flex flex-col items-center gap-5 p-8 text-center relative z-10">
            <div className="p-4 rounded-full bg-slate-950/80 border border-slate-900 text-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.15)] animate-pulse">
              <ParkingSquare className="h-8 w-8" aria-hidden="true" />
            </div>
            <div className="space-y-2">
              <h1 className="text-sm font-mono tracking-widest text-cyan-400 uppercase">
                NO_ACTIVE_SITE_SELECTED // CHƯA CHỌN PHÂN KHU
              </h1>
              <p className="text-xs font-mono text-slate-400 uppercase leading-relaxed max-w-sm">
                Vui lòng cấu hình phân khu bãi đỗ xe hoặc yêu cầu quyền truy cập hệ thống trước khi bắt đầu xem thông số thống kê chi tiết.
              </p>
            </div>
            {scopeError && (
              <div className="rounded-lg border border-rose-500/20 bg-rose-950/15 p-3.5 text-left font-mono text-[10px] text-rose-400 w-full mb-2">
                <span className="font-bold uppercase block mb-1">[SYS_ERROR_LOG]</span>
                {scopeError}
              </div>
            )}
            <Button
              variant="outline"
              onClick={retry}
              className="border-slate-800 bg-slate-950/60 hover:bg-slate-900 text-slate-300 hover:text-white font-mono text-xs uppercase h-10 px-5 rounded-lg transition-all"
            >
              <RefreshCw className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
              RETRY_SYSTEM_INITIALIZE
            </Button>
          </CardContent>
        </Card>
      </AdminPage>
    )
  }

  const trafficValue = (value: number | undefined) =>
    analyticsAvailable && value !== undefined ? value.toLocaleString("vi-VN") : "—"

  return (
    <AdminPage className="min-h-dvh">
      <AdminPageHeader
        eyebrow="MODULE // PHÂN TÍCH"
        title="THỐNG KÊ VẬN HÀNH"
        className="grid-cols-[minmax(0,1fr)_auto] items-start"
        description={
          <span className="font-mono text-xs tracking-wider text-slate-400 uppercase flex items-center gap-1.5 flex-wrap">
            <span className="text-slate-500">[SITE]</span>
            <span className="text-cyan-400 font-bold">{selectedSite?.name || "Khu vực đang chọn"}</span>
            <span className="text-slate-600">·</span>
            <span className="text-slate-500">[ZONE]</span>
            <span className="text-slate-300">{selectedZone ? selectedZone.name : "Tất cả zone"}</span>
            {lastUpdatedAt && (
              <>
                <span className="text-slate-600">·</span>
                <span className="text-slate-500">[LAST_SYNC]</span>
                <time className="text-slate-400 font-bold" dateTime={lastUpdatedAt}>
                  {new Date(lastUpdatedAt).toLocaleTimeString("vi-VN")}
                </time>
              </>
            )}
          </span>
        }
        actions={
          <div className="flex shrink-0 items-start justify-end gap-2.5">
            <Badge
              variant="outline"
              className="inline-flex h-9 sm:h-10 border-slate-800 bg-slate-950/50 text-cyan-400 font-mono text-[10px] uppercase font-bold tracking-wider px-3.5 rounded-xl gap-2"
              aria-label={realtime === "live" ? "Realtime" : "Đang đồng bộ"}
              title={realtime === "live" ? "Realtime" : "Đang đồng bộ"}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-500 animate-ping shrink-0" />
              <span>{realtime === "live" ? "LIVE_STATE" : "SYNCING"}</span>
            </Badge>
            <Button
              variant="outline"
              size="icon"
              onClick={() => void refresh()}
              disabled={loading || !selectedSiteId}
              className="h-9 w-9 sm:h-10 sm:w-10 border-slate-800 bg-slate-950/40 text-slate-300 hover:text-white hover:bg-slate-900 rounded-xl p-0 transition-all shadow-none shrink-0"
              aria-label="Làm mới"
              title="Làm mới"
            >
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} aria-hidden="true" />
            </Button>
          </div>
        }
      />

      <div className="space-y-8 mt-4">
        {partialError && (
          <div
            className="flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 font-mono text-xs text-amber-300"
            role="status"
          >
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-400 animate-pulse" aria-hidden="true" />
            <div className="space-y-1">
              <p className="font-bold uppercase">[WARNING] MỘT SỐ CHỈ SỐ CHƯA THỂ ĐỒNG BỘ</p>
              <p className="text-[11px] text-amber-400/80 leading-relaxed uppercase">{partialError}</p>
            </div>
          </div>
        )}

        {/* Section 1: Current Occupancy Rate */}
        <section aria-labelledby="occupancy-statistics" className="space-y-4">
          <div className="flex items-center gap-3 border-b border-slate-900/60 pb-2">
            <span className="flex items-center gap-1.5 font-mono text-[11px] font-bold text-cyan-400 uppercase tracking-widest">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-500 animate-pulse shrink-0" />
              01 // CÔNG SUẤT HIỆN TẠI (CURRENT OCCUPANCY)
            </span>
            <div className="h-[1px] flex-1 bg-slate-900/50" />
            <span className="font-mono text-[9px] text-slate-500 uppercase tracking-wider hidden sm:inline">
              {selectedZone ? "ZONE_SPECIFIC_OCCUPANCY" : "SITE_WIDE_OCCUPANCY"}
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Xe đang trong bãi"
              code="SYS_ACTIVE_VEHICLES"
              value={metrics.currentVehicles.toLocaleString("vi-VN")}
              description={`${metrics.occupiedSlots} ô đang được lấp đầy bởi xe nhận diện`}
              icon={CarFront}
              loading={loading}
              progress={metrics.usableSlots > 0 ? (metrics.occupiedSlots / metrics.usableSlots) * 100 : 0}
              color="cyan"
            />
            <MetricCard
              label="Tỷ lệ lấp đầy"
              code="OCCUPANCY_RATE"
              value={`${(metrics.fillRate * 100).toFixed(1)}%`}
              description={`${metrics.occupiedSlots}/${metrics.usableSlots} ô khả dụng đang vận hành`}
              icon={Gauge}
              loading={loading}
              progress={metrics.fillRate * 100}
              color={metrics.fillRate > 0.85 ? "amber" : "emerald"}
            />
            <MetricCard
              label="Ô còn trống"
              code="AVAILABLE_SLOTS"
              value={metrics.availableSlots.toLocaleString("vi-VN")}
              description={`${metrics.reservedSlots} ô đặt trước · ${metrics.unknownSlots} chưa xác định`}
              icon={ParkingSquare}
              loading={loading}
              progress={metrics.usableSlots > 0 ? (metrics.availableSlots / metrics.usableSlots) * 100 : 0}
              color="emerald"
            />
            <MetricCard
              label="Tổng công suất"
              code="TOTAL_CAPACITY"
              value={metrics.usableSlots.toLocaleString("vi-VN")}
              description={`${metrics.totalSlots} ô cấu hình · ${metrics.disabledSlots} ô đang tạm ngưng`}
              icon={ParkingSquare}
              loading={loading}
              color="slate"
            />
          </div>
        </section>

        {/* Section 2: Traffic Statistics */}
        <section aria-labelledby="traffic-statistics" className="space-y-4">
          <div className="flex items-center gap-3 border-b border-slate-900/60 pb-2">
            <span className="flex items-center gap-1.5 font-mono text-[11px] font-bold text-cyan-400 uppercase tracking-widest">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-500 animate-pulse shrink-0" />
              02 // LƯU LƯỢNG HÔM NAY (DAILY TRAFFIC LOGS)
            </span>
            <div className="h-[1px] flex-1 bg-slate-900/50" />
            <span className="font-mono text-[9px] text-slate-500 uppercase tracking-wider hidden sm:inline">
              GATEWAY_INTEGRATED_METRICS
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <MetricCard
              label="Lượt xe vào"
              code="VEHICLES_ENTRY_STREAM"
              value={trafficValue(analytics?.entries)}
              description="Số lượt xe qua cổng kiểm soát vào trong ngày hôm nay"
              icon={ArrowDownToLine}
              loading={loading}
              color="cyan"
            />
            <MetricCard
              label="Lượt xe ra"
              code="VEHICLES_EXIT_STREAM"
              value={trafficValue(analytics?.exits)}
              description="Số lượt xe qua cổng kiểm soát ra ngoài trong ngày hôm nay"
              icon={ArrowUpFromLine}
              loading={loading}
              color="emerald"
            />
            <MetricCard
              label="Xe duy nhất"
              code="UNIQUE_TARGETS_LOGGED"
              value={trafficValue(analytics?.uniqueVehicles)}
              description="Biển số xe khác nhau được hệ thống lưu vết hôm nay"
              icon={CarFront}
              loading={loading}
              color="amber"
            />
          </div>
        </section>

        {/* Section 3: Hardware & Performance */}
        <section aria-labelledby="system-statistics" className="space-y-4">
          <div className="flex items-center gap-3 border-b border-slate-900/60 pb-2">
            <span className="flex items-center gap-1.5 font-mono text-[11px] font-bold text-cyan-400 uppercase tracking-widest">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-500 animate-pulse shrink-0" />
              03 // ĐỒNG BỘ THIẾT BỊ & THỜI GIAN ĐỖ (SYSTEM HEALTH)
            </span>
            <div className="h-[1px] flex-1 bg-slate-900/50" />
            <span className="font-mono text-[9px] text-slate-500 uppercase tracking-wider hidden sm:inline">
              HARDWARE_AND_DWELL_METRIC
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <MetricCard
              label="Camera trực tuyến"
              code="DEVICE_ONLINE_RATIO"
              value={`${onlineCameras}/${cameras.length}`}
              description="Số lượng camera đang live trên tổng số camera trong phạm vi lựa chọn"
              icon={Video}
              loading={loading}
              progress={cameras.length > 0 ? (onlineCameras / cameras.length) * 100 : 0}
              color="emerald"
            />
            <MetricCard
              label="Thời gian đỗ trung bình"
              code="AVERAGE_DWELL_TIME"
              value={
                analyticsAvailable
                  ? analytics.completedDwellSessions
                    ? formatDuration(analytics.averageDwellSeconds)
                    : "Chưa đủ dữ liệu"
                  : "—"
              }
              description={
                analyticsAvailable
                  ? `${analytics.completedDwellSessions} lượt đỗ hoàn thành trong chu kỳ mẫu 7 ngày`
                  : "Không thể trích xuất dữ liệu trung bình lúc này"
              }
              icon={Clock3}
              loading={loading}
              color="cyan"
            />
          </div>
        </section>
      </div>
    </AdminPage>
  )
}
