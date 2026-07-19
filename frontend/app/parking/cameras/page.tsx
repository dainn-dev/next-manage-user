"use client"

import * as React from "react"
import {
  AlertCircle,
  Camera,
  RefreshCw,
  Radio,
  Activity,
  Clock3,
  Wifi,
  WifiOff,
  Loader2,
} from "lucide-react"

import { CameraTile } from "@/components/dashboard/camera-tile"
import { useDashboardData } from "@/lib/dashboard-data-context"
import { useDashboardScope } from "@/lib/dashboard-scope-context"
import { AdminPage } from "@/components/layout/admin-page"
import { Button } from "@/components/ui/button"

export default function LiveCamerasPage() {
  const { cameras, status, error, refresh, realtime, lastUpdatedAt } = useDashboardData()
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

  const onlineCount = React.useMemo(() => {
    return cameras.filter((c) => c.status === "ONLINE" || c.status === "ACTIVE").length
  }, [cameras])

  const offlineCount = React.useMemo(() => {
    return cameras.length - onlineCount
  }, [cameras, onlineCount])

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
                {"VIDEO_STREAM // MULTI_CAM_SURVEILLANCE"}
              </span>
              <span className="text-slate-700 font-mono text-[10px]">|</span>
              <span className="text-slate-400 font-mono text-[9px] tracking-wider uppercase">
                {selectedZoneId ? `ZONE: ${selectedZoneId.slice(0, 8)}` : "ALL_ZONES"}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white font-mono uppercase">
              CAMERA TRỰC TIẾP <span className="text-cyan-400">{"// LIVE_FEED"}</span>
            </h1>
            <p className="text-xs text-slate-400 max-w-2xl">
              Giám sát trực tiếp các camera an ninh tại bãi xe. Chỉ hiển thị camera thuộc site và zone đang được chọn ở thanh điều phối.
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
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin text-cyan-400" : ""}`} />
              <span>NẠP LẠI</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Cyber stats widgets */}
      <section className="grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-3" aria-label="Thông số camera">
        {[
          {
            label: "TỔNG SỐ CAMERA",
            value: loading && cameras.length === 0 ? "..." : cameras.length,
            icon: Camera,
            id: "TOTAL_CAMERAS",
            color: "text-cyan-400",
            glow: "rgba(6,182,212,0.08)",
            border: "border-cyan-500/15",
          },
          {
            label: "TRỰC TUYẾN",
            value: loading && cameras.length === 0 ? "..." : onlineCount,
            icon: Radio,
            id: "ONLINE_FEED",
            color: "text-emerald-400",
            glow: "rgba(16,185,129,0.08)",
            border: "border-emerald-500/15",
          },
          {
            label: "NGOẠI TUYẾN",
            value: loading && cameras.length === 0 ? "..." : offlineCount,
            icon: WifiOff,
            id: "OFFLINE_FEED",
            color: "text-rose-400",
            glow: "rgba(244,63,94,0.08)",
            border: "border-rose-500/15",
            className: "col-span-2 sm:col-span-1",
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
              <span className="text-[8px] font-mono text-slate-600">ACTIVE</span>
            </div>
            <div className="flex items-center gap-3 mt-2">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-slate-900 border border-slate-800">
                <Icon className={`size-4.5 ${color}`} />
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wide truncate">
                  {label}
                </p>
                <p className={`font-mono text-sm sm:text-lg font-black leading-none tracking-tight mt-1 ${color}`}>
                  {value}
                </p>
              </div>
            </div>
          </div>
        ))}
      </section>

      {/* Mode fallback notifications */}
      {realtime !== "live" && (
        <div className="flex flex-col gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs font-mono text-amber-200 sm:flex-row sm:items-center">
          <div className="flex min-w-0 items-start gap-2">
            <WifiOff className="mt-0.5 size-4 shrink-0 text-amber-400" />
            <span className="min-w-0">
              CHẾ ĐỘ REALTID_OFFLINE: Đang đồng bộ trạng thái camera định kỳ thay vì kết nối Socket liên tục.
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
          <div className="min-w-0">
            <span className="text-[9px] block text-rose-400 mb-1">{"[ERROR_OCCURRED]"}</span>
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Main Grid View */}
      {!selectedSiteId ? (
        <EmptyState title="CHƯA CÓ SITE ĐỂ HIỂN THỊ" description="Vui lòng cấu hình hoặc chọn một site để truy xuất dòng truyền camera tương ứng." />
      ) : loading && cameras.length === 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="relative aspect-video rounded-xl border border-slate-900 bg-slate-950/40 overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-slate-900/40 to-transparent animate-pulse" />
              <div className="absolute inset-0 flex items-center justify-center font-mono text-[10px] text-slate-700">
                <Loader2 className="size-4 animate-spin mr-2 text-cyan-500/50" />
                CONNECTING_CHANNEL_{index}...
              </div>
            </div>
          ))}
        </div>
      ) : cameras.length === 0 ? (
        <EmptyState
          title="KHÔNG CÓ CAMERA ĐƯỢC THIẾT LẬP"
          description={selectedZoneId ? "Zone hiện tại chưa được gán nguồn camera nào." : "Site hiện tại chưa thiết lập camera giám sát nào."}
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

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center font-mono text-slate-500 border border-slate-900 rounded-xl bg-slate-950/20 min-h-[18rem]">
      <span className="grid size-12 place-items-center rounded-xl bg-slate-900 border border-slate-800 text-slate-600 mb-3">
        <Camera className="size-6 text-cyan-400 animate-pulse" />
      </span>
      <p className="text-xs font-bold text-slate-400 uppercase">{title}</p>
      <p className="text-[10px] mt-1 text-slate-600 max-w-sm mx-auto leading-relaxed">
        {description}
      </p>
    </div>
  )
}
