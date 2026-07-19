"use client"

import * as React from "react"
import {
  AlertCircle,
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpFromLine,
  Camera,
  ExternalLink,
  Loader2,
  MapPin,
  RefreshCw,
  ScanLine,
  Wifi,
  WifiOff,
  Activity,
  Radio,
  Clock3,
  Calendar,
  Filter,
  Eye,
  type LucideIcon,
} from "lucide-react"

import { AdminEmptyState, AdminPage } from "@/components/layout/admin-page"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { DashboardEvent } from "@/lib/api/dashboard-api"
import { useDashboardData } from "@/lib/dashboard-data-context"
import { useDashboardScope } from "@/lib/dashboard-scope-context"

const FILTERS = ["ALL", "VEHICLE_ENTERED", "VEHICLE_RELOCATED", "VEHICLE_EXITED", "MOTION_DETECTED"] as const

const EVENT_META: Record<string, { label: string; icon: LucideIcon; tone: string; glow: string; border: string }> = {
  VEHICLE_ENTERED: {
    label: "Xe vào bãi",
    icon: ArrowDownToLine,
    tone: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    glow: "rgba(16,185,129,0.15)",
    border: "border-emerald-500/20",
  },
  VEHICLE_RELOCATED: {
    label: "Di chuyển ô đỗ",
    icon: ArrowLeftRight,
    tone: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
    glow: "rgba(6,182,212,0.15)",
    border: "border-cyan-500/20",
  },
  VEHICLE_EXITED: {
    label: "Xe rời bãi",
    icon: ArrowUpFromLine,
    tone: "bg-rose-500/10 text-rose-400 border-rose-500/20",
    glow: "rgba(244,63,94,0.15)",
    border: "border-rose-500/20",
  },
  MOTION_DETECTED: {
    label: "Phát hiện chuyển động",
    icon: ScanLine,
    tone: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    glow: "rgba(245,158,11,0.15)",
    border: "border-amber-500/20",
  },
}

export default function EventsPage() {
  const [filter, setFilter] = React.useState<(typeof FILTERS)[number]>("ALL")
  const {
    cameras,
    error,
    events,
    eventsHasMore,
    eventsLoadingMore,
    lastUpdatedAt,
    loadMoreEvents,
    realtime,
    realtimeError,
    refresh,
    setEventFilter,
    slots,
    status,
  } = useDashboardData()
  const { selectedSiteId, selectedZoneId } = useDashboardScope()
  const [currentTime, setCurrentTime] = React.useState<string>("")

  // Realtime clock for high-tech header
  React.useEffect(() => {
    if (typeof window !== "undefined") {
      setCurrentTime(new Date().toLocaleTimeString("vi-VN"))
      const interval = setInterval(() => {
        setCurrentTime(new Date().toLocaleTimeString("vi-VN"))
      }, 1000)
      return () => clearInterval(interval)
    }
  }, [])

  React.useEffect(() => {
    setEventFilter(filter)
    return () => setEventFilter("ALL")
  }, [filter, setEventFilter])

  const scoped = React.useMemo(
    () =>
      events.filter((event) => {
        if (event.siteId !== selectedSiteId) return false
        if (selectedZoneId && event.zoneId && event.zoneId !== selectedZoneId) return false
        if (selectedZoneId && !event.zoneId) {
          const camera = cameras.find((item) => item.id === event.cameraId)
          const slot = slots.find((item) => item.id === event.slotId)
          if (camera?.zoneId !== selectedZoneId && slot?.zoneId !== selectedZoneId) return false
        }
        return true
      }),
    [events, selectedSiteId, selectedZoneId, cameras, slots],
  )

  const loading = status === "loading" || status === "idle"

  return (
    <AdminPage className="space-y-6 bg-[#020617] text-slate-100 p-4 sm:p-6 lg:p-8 rounded-2xl relative min-h-screen overflow-hidden">
      {/* Grid tech background decorations */}
      <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: "radial-gradient(circle, #06b6d4 1.2px, transparent 1.2px)",
            backgroundSize: "24px 24px",
          }}
        />
        <div className="absolute top-1/4 right-1/4 w-[350px] h-[350px] rounded-full bg-cyan-500/5 blur-[120px]" />
        <div className="absolute bottom-1/3 left-10 w-[300px] h-[300px] rounded-full bg-emerald-500/5 blur-[100px]" />
      </div>

      {/* Cybernetic Header */}
      <header className="relative overflow-hidden rounded-xl border border-slate-800 bg-slate-950/60 p-5 sm:p-6 shadow-[0_0_20px_rgba(0,0,0,0.4)] backdrop-blur-xl">
        <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-cyan-500/40" />
        <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-cyan-500/40" />
        <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-cyan-500/40" />
        <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-cyan-500/40" />

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-0.5 text-[9px] font-mono font-medium text-cyan-400">
                <span className="size-1.5 rounded-full bg-cyan-500 animate-pulse" />
                {"TELEMETRY_STREAM // SYSTEM_OPERATIONS"}
              </span>
              <span className="text-slate-700 font-mono text-[10px]">|</span>
              <span className="text-slate-400 font-mono text-[9px] tracking-wider uppercase">ARCHIVE_ACCESS: ALL_SITES</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white font-mono uppercase">
              DÒNG SỰ KIỆN VẬN HÀNH <span className="text-cyan-400">{"// TIMELINE"}</span>
            </h1>
            <p className="text-xs text-slate-400 max-w-2xl">
              Sự kiện mới nhất trong khu vực được định vị, ghi nhận chính xác theo thời gian thực về phương tiện, camera giám sát và ô đỗ.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 self-start md:self-center">
            {/* Live digital clock */}
            <div className="hidden sm:flex flex-col items-end px-3 py-1 rounded-lg border border-slate-900 bg-slate-950/80 font-mono text-xs">
              <span className="text-slate-500 text-[8px] uppercase tracking-wider">Hệ thống thời gian</span>
              <span className="text-cyan-400 font-bold tabular-nums">
                {currentTime || "00:00:00"}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Cyber stats widget section */}
      <section className="grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-3" aria-label="Thông số thời gian thực">
        {[
          { 
            label: "SỰ KIỆN KHU VỰC", 
            value: loading ? "..." : scoped.length, 
            icon: Radio, 
            id: "SCOPED_EVENTS", 
            color: "text-cyan-400", 
            glow: "rgba(6,182,212,0.08)", 
            border: "border-cyan-500/15" 
          },
          { 
            label: "TRẠNG THÁI KẾT NỐI", 
            value: realtime === "live" ? "TRỰC TUYẾN" : "POLLED_OK", 
            icon: realtime === "live" ? Wifi : Activity, 
            id: "CONNECTION_MODE", 
            color: realtime === "live" ? "text-emerald-400" : "text-amber-400", 
            glow: realtime === "live" ? "rgba(16,185,129,0.08)" : "rgba(245,158,11,0.08)", 
            border: realtime === "live" ? "border-emerald-500/15" : "border-amber-500/15" 
          },
          { 
            label: "SITE HIỆN TẠI", 
            value: selectedSiteId ? `ID: ${selectedSiteId.slice(0, 8)}` : "CHƯA CHỌN", 
            icon: MapPin, 
            id: "SITE_CONTEXT", 
            color: selectedSiteId ? "text-indigo-400" : "text-slate-500", 
            glow: "rgba(99,102,241,0.08)", 
            border: "border-indigo-500/15",
            className: "col-span-2 sm:col-span-1" 
          },
        ].map(({ label, value, icon: Icon, id, color, glow, border, className }) => (
          <div
            key={label}
            className={`relative overflow-hidden rounded-xl border ${border} bg-slate-950/40 p-4 transition-all duration-300 hover:scale-[1.01] hover:bg-slate-950/60 ${className ?? ""}`}
            style={{
              boxShadow: `inset 0 0 12px ${glow}`,
            }}
          >
            <div className="flex items-center justify-between">
              <span className="text-[8px] font-mono text-slate-500">[{id}]</span>
              <span className="text-[8px] font-mono text-slate-600">ONLINE</span>
            </div>
            <div className="flex items-center gap-3 mt-2">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-slate-900 border border-slate-800">
                <Icon className={`size-4.5 ${color}`} />
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wide truncate">
                  {label}
                </p>
                <p className={`font-mono text-xs sm:text-sm font-black leading-none tracking-tight mt-1.5 truncate ${color}`}>
                  {value}
                </p>
              </div>
            </div>
          </div>
        ))}
      </section>

      {/* Modern High-Tech Toolbar */}
      <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950/60 p-4 backdrop-blur-xl shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="grid min-w-0 flex-1 gap-1.5">
            <label className="text-[9px] font-mono font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5" htmlFor="event-filter-trigger">
              <Filter className="size-3 text-cyan-400" />
              Lọc theo loại sự kiện
            </label>
            <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
              <Select value={filter} onValueChange={(value) => setFilter(value as typeof filter)}>
                <SelectTrigger id="event-filter-trigger" className="h-10 rounded-lg border-slate-900 bg-slate-950 text-xs font-mono text-slate-300 focus:border-cyan-500/30">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-slate-800 bg-slate-950 text-slate-300 font-mono text-xs">
                  {FILTERS.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type === "ALL" ? "TẤT CẢ SỰ KIỆN" : EVENT_META[type]?.label?.toUpperCase() || type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Button
                className="h-10 px-4 rounded-lg border border-slate-800 bg-slate-950 hover:bg-slate-900 text-slate-300 font-mono text-xs hover:border-cyan-500/20"
                variant="outline"
                onClick={() => void refresh()}
                disabled={loading}
              >
                <RefreshCw className={`size-3.5 mr-1.5 ${loading ? "animate-spin text-cyan-400" : ""}`} />
                NẠP_LẠI
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Realtime / Polling system notifications */}
      {realtime !== "live" && (
        <div className="flex flex-col gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs font-mono text-amber-200 sm:flex-row sm:items-center">
          <div className="flex min-w-0 items-start gap-2">
            <WifiOff className="mt-0.5 size-4 shrink-0 text-amber-400" />
            <span className="min-w-0">
              {realtimeError || "CHẾ ĐỘ REALTID_OFFLINE: timeline đang áp dụng cơ chế tự động Polling Fallback."}
            </span>
          </div>
          {lastUpdatedAt && (
            <span className="shrink-0 text-[10px] text-amber-400/70 sm:ml-auto">
              ĐỒNG BỘ CUỐI: {new Date(lastUpdatedAt).toLocaleTimeString("vi-VN")}
            </span>
          )}
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs font-mono text-rose-300">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-rose-400" />
          <span className="min-w-0">{error}</span>
        </div>
      )}

      {/* Content Section */}
      {!selectedSiteId ? (
        <EmptyState title="CHƯA CÓ SITE ĐỂ HIỂN THỊ" />
      ) : loading ? (
        <div className="flex min-h-[18rem] flex-col items-center justify-center rounded-xl border border-dashed border-slate-800 bg-slate-950/20 py-20 gap-4 font-mono text-xs text-slate-500">
          <Loader2 className="size-8 animate-spin text-cyan-400" />
          <span className="animate-pulse">DECRYPTING_EVENT_STREAM...</span>
        </div>
      ) : scoped.length === 0 ? (
        <EmptyState title={filter === "ALL" ? "CHƯA CÓ SỰ KIỆN VẬN HÀNH" : "KHÔNG CÓ SỰ KIỆN PHÙ HỢP"} />
      ) : (
        <section className="space-y-6" aria-label="Timeline sự kiện">
          {/* Main timeline tracker */}
          <div className="relative space-y-4 pl-8 before:absolute before:bottom-4 before:left-3 before:top-4 before:w-[2px] before:bg-slate-900 sm:pl-10 sm:before:left-5">
            {/* Soft glowing line behind nodes */}
            <div className="absolute top-4 bottom-4 left-3 sm:left-5 w-[2px] bg-gradient-to-b from-cyan-500/20 via-emerald-500/20 to-transparent pointer-events-none" />

            {scoped.map((event) => (
              <TimelineItem
                key={event.id}
                event={event}
                cameraName={cameras.find((item) => item.id === event.cameraId)?.name}
                slotCode={slots.find((item) => item.id === event.slotId)?.code}
              />
            ))}
          </div>

          {eventsHasMore && (
            <div className="grid sm:flex sm:justify-center pt-4">
              <Button 
                className="w-full sm:w-auto h-10 px-6 font-mono text-xs font-bold tracking-wider uppercase border border-slate-800 bg-slate-950/80 hover:bg-cyan-500/10 hover:text-cyan-400 hover:border-cyan-500/30 rounded-lg transition-all duration-200" 
                variant="outline" 
                disabled={eventsLoadingMore} 
                onClick={() => void loadMoreEvents()}
              >
                {eventsLoadingMore && <Loader2 className="size-3.5 mr-2 animate-spin text-cyan-400" />}
                TẢI THÊM SỰ KIỆN {"// DISCOVER"}
              </Button>
            </div>
          )}
        </section>
      )}
    </AdminPage>
  )
}

function TimelineItem({
  cameraName,
  event,
  slotCode,
}: {
  event: DashboardEvent
  cameraName?: string
  slotCode?: string
}) {
  const meta = EVENT_META[event.type] || {
    label: event.type.replaceAll("_", " "),
    icon: Camera,
    tone: "bg-slate-850 text-slate-300 border-slate-800",
    glow: "rgba(255,255,255,0.05)",
    border: "border-slate-800",
  }
  const Icon = meta.icon

  return (
    <Card 
      className="relative overflow-visible border border-slate-900 bg-slate-950/60 p-0 transition-all duration-300 hover:scale-[1.005] hover:border-slate-800 hover:bg-slate-950 shadow-[0_4px_12px_rgba(0,0,0,0.5)] group"
    >
      {/* High-tech corners decoration on hover */}
      <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-transparent group-hover:border-cyan-500/40 rounded-tl-lg transition-colors" />
      <div className="absolute top-0 right-0 w-3 h-3 border-t border-r border-transparent group-hover:border-cyan-500/40 rounded-tr-lg transition-colors" />
      <div className="absolute bottom-0 left-0 w-3 h-3 border-b border-l border-transparent group-hover:border-cyan-500/40 rounded-bl-lg transition-colors" />
      <div className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-transparent group-hover:border-cyan-500/40 rounded-br-lg transition-colors" />

      {/* Timeline Node Icon Circle */}
      <div
        className={`absolute -left-[2.15rem] top-5 z-10 flex size-8 items-center justify-center rounded-full border ring-4 ring-[#020617] sm:-left-[2.35rem] transition-all duration-300 ${meta.tone}`}
        style={{
          boxShadow: `0 0 10px ${meta.glow}`,
        }}
        aria-hidden="true"
      >
        <Icon className="size-4" />
      </div>

      <CardContent className="space-y-4 p-4 sm:p-5">
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="font-mono text-xs font-black uppercase text-white tracking-wider">
              {meta.label}
            </span>
            {event.plate && (
              <Badge 
                variant="outline" 
                className="max-w-full truncate font-mono text-[10px] font-black border-slate-700 bg-slate-950 text-cyan-400 tracking-wider px-2 py-0.5"
              >
                {event.plate}
              </Badge>
            )}
          </div>
          <time className="shrink-0 text-xs font-mono text-slate-500" dateTime={event.occurredAt}>
            {new Date(event.occurredAt).toLocaleString("vi-VN")}
          </time>
        </div>

        {/* Info badges and tags */}
        <div className="flex min-w-0 flex-col gap-2 text-xs font-mono text-slate-400 sm:flex-row sm:flex-wrap sm:gap-x-5">
          {cameraName && (
            <span className="flex min-w-0 items-center gap-1.5 text-slate-300">
              <Camera className="size-3.5 shrink-0 text-cyan-400" />
              <span className="truncate">{cameraName}</span>
            </span>
          )}
          {slotCode && (
            <span className="flex min-w-0 items-center gap-1.5 text-slate-300">
              <MapPin className="size-3.5 shrink-0 text-indigo-400" />
              <span className="truncate">Ô {slotCode}</span>
            </span>
          )}
          {event.cameraId && !cameraName && (
            <span className="break-all text-slate-500">
              CAMERA: {event.cameraId.slice(0, 8).toUpperCase()}
            </span>
          )}
          {event.slotId && !slotCode && (
            <span className="break-all text-slate-500">
              SLOT: {event.slotId.slice(0, 8).toUpperCase()}
            </span>
          )}
        </div>

        {/* Snapshot trigger block */}
        {event.snapshotUrl && (
          <div className="border-t border-slate-900 pt-3">
            <a
              href={event.snapshotUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-950/80 px-3.5 text-xs font-mono font-bold text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/5 hover:border-cyan-500/30 transition-all duration-200"
            >
              <Eye className="size-3.5" />
              <span>XEM_SNAPSHOT</span>
              <ExternalLink className="size-3" />
            </a>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function EmptyState({ title }: { title: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center font-mono text-slate-500 border border-slate-900 rounded-xl bg-slate-950/20">
      <span className="grid size-12 place-items-center rounded-xl bg-slate-900 border border-slate-800 text-slate-600 mb-3">
        <ScanLine className="size-6 text-cyan-400" />
      </span>
      <p className="text-xs font-bold text-slate-400 uppercase">{title}</p>
      <p className="text-[10px] mt-1 text-slate-600 max-w-sm mx-auto">
        Sự kiện mới sẽ xuất hiện tự động khi hệ thống nhận được dữ liệu từ camera hoặc cảm biến cổng.
      </p>
    </div>
  )
}
