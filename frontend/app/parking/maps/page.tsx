"use client"

import * as React from "react"
import {
  AlertCircle,
  Car,
  CircleParking,
  RefreshCw,
  SquareParking,
  Radio,
  Activity,
  MapPin,
  Clock3,
  Wifi,
  WifiOff,
  Loader2,
} from "lucide-react"

import { ParkingMap } from "@/components/dashboard/parking-map"
import { AdminEmptyState, AdminPage } from "@/components/layout/admin-page"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { useDashboardData } from "@/lib/dashboard-data-context"
import { useDashboardScope } from "@/lib/dashboard-scope-context"
import { cn } from "@/lib/utils"

export default function ParkingMapPage() {
  const { slots, status, error, refresh, realtime } = useDashboardData()
  const { selectedSiteId, selectedZoneId } = useDashboardScope()
  
  const occupied = slots.filter((slot) => slot.status === "OCCUPIED").length
  const available = slots.filter((slot) => slot.status === "AVAILABLE").length
  const scopeLabel = selectedZoneId ? "zone đang chọn" : "site đang chọn"
  const realtimeLabel = realtime === "live" ? "Realtime" : "Đồng bộ định kỳ"

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
                {"MAP_SURVEILLANCE // SPATIAL_FLOW"}
              </span>
              <span className="text-slate-700 font-mono text-[10px]">|</span>
              <span className="text-slate-400 font-mono text-[9px] tracking-wider uppercase">
                {selectedZoneId ? `ZONE: ${selectedZoneId.slice(0, 8)}` : "ALL_ZONES"}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white font-mono uppercase">
              SƠ ĐỒ BÃI XE <span className="text-cyan-400">{"// PARKING_MAP"}</span>
            </h1>
            <p className="text-xs text-slate-400 max-w-2xl">
              Theo dõi trực quan phân bổ ô đỗ theo {scopeLabel}, hiển thị trạng thái lấp đầy, thông tin phương tiện hiện hữu trong thời gian thực.
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

            <Button
              variant="outline"
              size="sm"
              onClick={() => void refresh()}
              disabled={loading}
              className="h-10 px-3.5 rounded-lg border border-slate-800 bg-slate-950 hover:bg-slate-900 text-slate-300 font-mono text-xs hover:border-cyan-500/20"
              title="Làm mới"
            >
              <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", loading && "animate-spin text-cyan-400")} />
              <span>NẠP LẠI</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Cyber stats widgets */}
      <section className="grid min-w-0 grid-cols-3 gap-3" aria-label="Thông số ô đỗ">
        {[
          { 
            label: "TỔNG SỐ Ô ĐỖ", 
            value: loading && slots.length === 0 ? "..." : slots.length, 
            icon: SquareParking, 
            id: "TOTAL_SLOTS", 
            color: "text-cyan-400", 
            glow: "rgba(6,182,212,0.08)", 
            border: "border-cyan-500/15" 
          },
          { 
            label: "CÒN TRỐNG", 
            value: loading && slots.length === 0 ? "..." : available, 
            icon: CircleParking, 
            id: "AVAILABLE_SLOTS", 
            color: "text-emerald-400", 
            glow: "rgba(16,185,129,0.08)", 
            border: "border-emerald-500/15" 
          },
          { 
            label: "ĐANG CÓ XE", 
            value: loading && slots.length === 0 ? "..." : occupied, 
            icon: Car, 
            id: "OCCUPIED_SLOTS", 
            color: "text-rose-400", 
            glow: "rgba(244,63,94,0.08)", 
            border: "border-rose-500/15" 
          },
        ].map(({ label, value, icon: Icon, id, color, glow, border }) => (
          <div
            key={label}
            className={cn(
              "relative overflow-hidden rounded-xl border bg-slate-950/40 p-3 sm:p-4 transition-all duration-300 hover:scale-[1.01] hover:bg-slate-950/60"
            )}
            style={{
              boxShadow: `inset 0 0 12px ${glow}`,
            }}
          >
            <div className="flex items-center justify-between">
              <span className="text-[8px] font-mono text-slate-500">[{id}]</span>
              <span className="text-[8px] font-mono text-slate-600">ACTIVE</span>
            </div>
            <div className="flex items-center gap-3 mt-2">
              <span className="flex size-8 sm:size-9 shrink-0 items-center justify-center rounded-lg bg-slate-900 border border-slate-800">
                <Icon className={`size-4 sm:size-4.5 ${color}`} />
              </span>
              <div className="min-w-0">
                <p className="text-[9px] sm:text-[10px] font-mono text-slate-400 uppercase tracking-wide truncate">
                  {label}
                </p>
                <p className={`font-mono text-base sm:text-2xl font-black leading-none tracking-tight mt-1 ${color}`}>
                  {value}
                </p>
              </div>
            </div>
          </div>
        ))}
      </section>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs font-mono text-rose-300">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-rose-400" />
          <div className="min-w-0">
            <span className="text-[9px] block text-rose-400 mb-1">{"[ERROR_OCCURRED]"}</span>
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Main Map Visualization Area */}
      {!selectedSiteId ? (
        <EmptySite />
      ) : loading ? (
        <div className="flex min-h-[22rem] flex-col items-center justify-center rounded-xl border border-dashed border-slate-800 bg-slate-950/20 py-20 gap-4 font-mono text-xs text-slate-500">
          <Loader2 className="size-8 animate-spin text-cyan-400" />
          <span className="animate-pulse">DECRYPTING_SPATIAL_GEOMETRY...</span>
        </div>
      ) : slots.length === 0 ? (
        <EmptySite
          title="Site hoặc zone chưa có ô đỗ"
          description="Hãy thiết kế và publish bản đồ từ Map Designer để hiển thị sơ đồ trạng thái các ô đỗ tại đây."
        />
      ) : (
        <div className="relative overflow-hidden rounded-xl border border-slate-800 bg-slate-950/40 p-4 sm:p-6 backdrop-blur-xl shadow-[0_4px_24px_rgba(0,0,0,0.5)]">
          {/* Cyber accents */}
          <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-cyan-500/30" />
          <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-cyan-500/30" />
          <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-cyan-500/30" />
          <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-cyan-500/30" />
          
          <ParkingMap slots={slots} />
        </div>
      )}
    </AdminPage>
  )
}

function EmptySite({
  title = "Chưa có site để hiển thị",
  description = "Vui lòng chọn site ở thanh điều hướng phía trên để xem sơ đồ bãi xe và trạng thái từng ô đỗ.",
}: {
  title?: string
  description?: string
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center font-mono text-slate-500 border border-slate-900 rounded-xl bg-slate-950/20 min-h-[18rem]">
      <span className="grid size-12 place-items-center rounded-xl bg-slate-900 border border-slate-800 text-slate-600 mb-3">
        <SquareParking className="size-6 text-cyan-400" />
      </span>
      <p className="text-xs font-bold text-slate-400 uppercase">{title}</p>
      <p className="text-[10px] mt-1 text-slate-600 max-w-sm mx-auto leading-relaxed">
        {description}
      </p>
    </div>
  )
}
