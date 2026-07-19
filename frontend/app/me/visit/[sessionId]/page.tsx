"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { memberApi, type MemberParkingSession } from "@/lib/api/member-api"
import { useToast } from "@/hooks/use-toast"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  ArrowLeft,
  MapPin,
  Building2,
  CalendarDays,
  Cpu,
  Layers,
  Loader2,
  Navigation,
  Activity,
  History
} from "lucide-react"

export default function MemberVisitDetailPage() {
  const params = useParams()
  const sessionId = String(params.sessionId || "")
  const [session, setSession] = useState<MemberParkingSession | null>(null)
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    if (!sessionId) return
    let cancelled = false
    ;(async () => {
      try {
        const data = await memberApi.getSession(sessionId)
        if (!cancelled) setSession(data)
      } catch (e) {
        toast({
          title: "Không tải được phiên",
          description: e instanceof Error ? e.message : "Lỗi không xác định",
          variant: "destructive",
        })
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [sessionId, toast])

  return (
    <div className="space-y-6">
      {/* Sci-Fi Navigation Back & Page Header */}
      <div className="border-b border-slate-900 pb-5">
        <div className="mb-3">
          <Link
            href="/me/visit"
            className="inline-flex items-center gap-1.5 font-mono text-[10px] text-cyan-400 uppercase tracking-widest hover:text-cyan-300 transition-colors"
          >
            <ArrowLeft className="h-3 w-3 text-cyan-500" />
            {"RETURN // GO_BACK_TO_GATEWAY"}
          </Link>
        </div>

        <div className="space-y-1">
          <span className="flex items-center gap-1.5 font-mono text-[10px] font-bold text-cyan-400 uppercase tracking-widest">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-500 animate-pulse" />
            TELEMETRY // VEHICLE_LIVE_LOCATOR
          </span>
          <h1 className="text-2xl font-bold tracking-wider text-white font-mono uppercase">
            {"XE ĐANG Ở ĐÂU?"}
          </h1>
          <p className="text-xs font-mono text-slate-400 uppercase leading-relaxed max-w-xl">
            {"Hệ thống phân tích vị trí thực của phương tiện trong bãi đỗ dựa trên cảm biến hồng ngoại và luồng nhận diện camera AI."}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex min-h-[35vh] items-center justify-center bg-slate-950/20 rounded-xl border border-slate-900">
          <div className="flex flex-col items-center gap-2 font-mono text-xs text-cyan-400">
            <Loader2 className="h-5 w-5 animate-spin text-cyan-500" />
            <span className="animate-pulse tracking-widest text-[10px] uppercase mt-1">
              {"SCANNING_AIRSPACE_FOR_VEHICLE..."}
            </span>
          </div>
        </div>
      ) : !session ? (
        <div className="border border-slate-850 bg-slate-950/20 rounded-xl p-8 text-center relative overflow-hidden backdrop-blur-xl">
          {/* Tech ticks */}
          <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-slate-800" />
          <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-slate-800" />
          <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-slate-800" />
          <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-slate-800" />
          
          <p className="font-mono text-xs text-rose-400 uppercase tracking-wider">
            {"[!] ERROR_SESSION_NOT_FOUND"}
          </p>
          <p className="text-[11px] font-mono text-slate-500 uppercase mt-2 max-w-md mx-auto leading-relaxed">
            {"Không tìm thấy thông tin phiên gửi xe này. Vui lòng kiểm tra lại ID hoặc liên hệ với bộ phận kỹ thuật."}
          </p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-3 items-start">
          {/* Main Visual Telemetry Block */}
          <div className="border border-slate-800 bg-slate-950/40 text-slate-100 shadow-xl rounded-xl p-6 relative overflow-hidden backdrop-blur-xl md:col-span-2 group">
            {/* Tech corner ticks */}
            <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-slate-850 group-hover:border-cyan-500/30 transition-colors" />
            <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-slate-850 group-hover:border-cyan-500/30 transition-colors" />
            <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-slate-850 group-hover:border-cyan-500/30 transition-colors" />
            <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-slate-850 group-hover:border-cyan-500/30 transition-colors" />

            <div className="flex items-center justify-between gap-2 border-b border-slate-900/60 pb-3 mb-5">
              <span className="font-mono text-[10px] tracking-widest text-slate-500 uppercase">
                {"SESSION_METADATA_STREAM"}
              </span>
              <span className="flex items-center gap-1.5 font-mono text-[9px] text-emerald-400 uppercase">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {"TRANSCEIVER_ONLINE"}
              </span>
            </div>

            <div className="space-y-6">
              {/* Big license plate box */}
              <div>
                <span className="block font-mono text-[9px] tracking-widest text-slate-500 uppercase mb-1">
                  {"TRACKED_TARGET_LICENSE // BIỂN SỐ PHƯƠNG TIỆN"}
                </span>
                <span className="font-mono text-3xl tracking-widest font-bold text-white bg-slate-950 border border-slate-900 py-2.5 px-6 rounded-xl inline-block shadow-[inset_0_1px_4px_rgba(0,0,0,0.6)]">
                  {session.licensePlate}
                </span>
              </div>

              {/* High-Tech Row stats */}
              <div className="grid gap-4 sm:grid-cols-2 pt-4 border-t border-slate-900/40">
                <div className="space-y-1">
                  <span className="font-mono text-[9px] tracking-widest text-slate-500 uppercase block">
                    {"LOCATION_NODE // BÃI / TỔ CHỨC"}
                  </span>
                  <div className="flex items-center gap-2 text-xs font-mono font-bold text-white uppercase">
                    <Building2 className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
                    <span>{session.tenantName || session.tenantId || "CHƯA XÁC ĐỊNH"}</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="font-mono text-[9px] tracking-widest text-slate-500 uppercase block">
                    {"SESSION_STATUS // TRẠNG THÁI PHIÊN"}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "h-1.5 w-1.5 rounded-full animate-pulse",
                      session.status === "active" || session.status === "ACTIVE" ? "bg-emerald-500" : "bg-slate-500"
                    )} />
                    <span className={cn(
                      "text-xs font-mono font-bold uppercase",
                      session.status === "active" || session.status === "ACTIVE" ? "text-emerald-400" : "text-slate-400"
                    )}>
                      {session.status || "UNKNOWN"}
                    </span>
                  </div>
                </div>

                <div className="space-y-1 sm:col-span-2 pt-2">
                  <span className="font-mono text-[9px] tracking-widest text-slate-500 uppercase block">
                    {"TIMESTAMP_STARTED // THỜI GIAN VÀO BÃI"}
                  </span>
                  <div className="flex items-center gap-2 text-xs font-mono text-slate-300">
                    <CalendarDays className="h-3.5 w-3.5 text-cyan-500/80 shrink-0" />
                    <span>
                      {session.startedAt ? new Date(session.startedAt).toLocaleString("vi-VN") : "—"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Location details card with compass map feeling */}
          <div className="border border-slate-850 bg-slate-950/20 text-slate-100 shadow-xl rounded-xl p-5 relative overflow-hidden backdrop-blur-xl flex flex-col justify-between min-h-[220px]">
            {/* Tech grid */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.003)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.003)_1px,transparent_1px)] bg-[size:15px_15px] pointer-events-none opacity-20" />

            <div className="relative z-10 space-y-3">
              <div className="flex items-center gap-1.5 text-cyan-400 border-b border-slate-900 pb-2">
                <Navigation className="h-4 w-4 shrink-0 text-cyan-500 animate-pulse" />
                <h3 className="font-mono text-[11px] font-bold uppercase tracking-wider">
                  {"COORDINATE_RESOLVER"}
                </h3>
              </div>

              <div className="space-y-1 pt-1">
                <span className="font-mono text-[9px] tracking-widest text-slate-500 uppercase block">
                  {"ASSIGNED_PARKING_SLOT // Ô ĐỖ XE HIỆN TẠI"}
                </span>
                <p className="text-sm font-mono font-bold text-white uppercase leading-relaxed">
                  {session.locationLabel ? (
                    <span className="text-cyan-400 bg-cyan-950/20 border border-cyan-500/30 py-1 px-2 rounded inline-block shadow-[0_0_10px_rgba(6,182,212,0.1)]">
                      {session.locationLabel}
                    </span>
                  ) : (
                    <span className="text-slate-400 text-xs italic">
                      {"Đã vào bãi — đang định vị ô (camera bãi đang dò quét)"}
                    </span>
                  )}
                </p>
              </div>
            </div>

            <div className="relative z-10 border-t border-slate-950 pt-3 text-[9px] font-mono text-slate-500 uppercase tracking-wider">
              {"LATITUDE / LONGITUDE RESOLVED BY CLOUD_GPS_AGENT"}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
