"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  CheckCircle2,
  XCircle,
  Clock,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
  ChevronLeft,
  DoorOpen,
  MapPin,
  Clock3,
  Volume1,
  ShieldCheck,
  ShieldAlert,
  Loader2
} from "lucide-react"
import {
  useWebSocket,
  gateCheckTopic,
  type EmployeeVehicleCheckMessage,
  type VehicleCheckMessage,
} from "@/hooks/use-websocket"
import { gateApi, type Gate } from "@/lib/api/gate-api"
import {
  normalizeWsEvent,
  normalizeLog,
  speakEvent,
  unlockSpeech,
  isSpeechSupported,
  type KioskEvent,
} from "@/lib/gate-kiosk"
import { ErrorBoundary } from "@/components/error-boundary"

const MAX_EVENTS = 30

// Server-local ISO string (no timezone suffix) matching the backend's
// LocalDateTime binding on GET /api/gates/{id}/recent-checks?since=.
function toLocalIso(date: Date): string {
  const p = (n: number, len = 2) => String(n).padStart(len, "0")
  return (
    `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}` +
    `T${p(date.getHours())}:${p(date.getMinutes())}:${p(date.getSeconds())}`
  )
}

function eventSignature(e: KioskEvent): string {
  return `${e.licensePlate}|${e.type}|${e.timestamp}`
}

function GateKiosk({ gateId }: { gateId: string }) {
  const [gate, setGate] = useState<Gate | null>(null)
  const [events, setEvents] = useState<KioskEvent[]>([])
  const [soundEnabled, setSoundEnabled] = useState(false)
  const [clock, setClock] = useState(() => new Date())
  const [replayError, setReplayError] = useState<string | null>(null)

  const seenRef = useRef<Set<string>>(new Set())
  // Raw timestamp string of the newest event we hold; drives the replay `since`.
  const lastSeenRef = useRef<string | null>(null)
  const soundEnabledRef = useRef(soundEnabled)

  useEffect(() => {
    soundEnabledRef.current = soundEnabled
  }, [soundEnabled])

  // Live clock.
  useEffect(() => {
    const id = setInterval(() => setClock(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  // Best-effort gate metadata (name/location). Requires an ADMIN JWT; a non-admin
  // operator still gets a working kiosk keyed by id.
  useEffect(() => {
    let cancelled = false
    gateApi
      .getGate(gateId)
      .then((g) => {
        if (!cancelled) setGate(g)
      })
      .catch(() => {
        /* fall back to the id in the header */
      })
    return () => {
      cancelled = true
    }
  }, [gateId])

  // Insert events, newest-first, de-duplicated by content signature. Returns the
  // events that were actually new (for optional side effects like TTS).
  const addEvents = useCallback((incoming: KioskEvent[]): KioskEvent[] => {
    const fresh: KioskEvent[] = []
    for (const e of incoming) {
      const sig = eventSignature(e)
      if (seenRef.current.has(sig)) continue
      seenRef.current.add(sig)
      fresh.push(e)
    }
    if (fresh.length === 0) return []

    setEvents((prev) => {
      const merged = [...fresh, ...prev].sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      )
      return merged.slice(0, MAX_EVENTS)
    })

    // Track the newest timestamp we have for the next replay window.
    for (const e of fresh) {
      if (!lastSeenRef.current || new Date(e.timestamp) > new Date(lastSeenRef.current)) {
        lastSeenRef.current = e.timestamp
      }
    }
    return fresh
  }, [])

  const handleMessage = useCallback(
    (msg: VehicleCheckMessage | EmployeeVehicleCheckMessage) => {
      const event = normalizeWsEvent(msg)
      const fresh = addEvents([event])
      if (fresh.length > 0 && soundEnabledRef.current) {
        speakEvent(fresh[0])
      }
    },
    [addEvents],
  )

  // Reliable-delivery replay: on every (re)connect, pull the checks created since
  // the last event we saw so nothing is lost across a dropped connection.
  const replayMissed = useCallback(async () => {
    try {
      const since = lastSeenRef.current
        ? toLocalIso(new Date(new Date(lastSeenRef.current).getTime() - 5000))
        : undefined
      const logs = await gateApi.getRecentChecks(gateId, since)
      addEvents(logs.map(normalizeLog))
      setReplayError(null)
    } catch {
      setReplayError("Không thể tải lại sự kiện đã bỏ lỡ")
    }
  }, [gateId, addEvents])

  const wsOptions = useMemo(
    () => ({ topic: gateCheckTopic(gateId), onConnect: replayMissed }),
    [gateId, replayMissed],
  )

  const { isConnected, connectionError, reconnect } = useWebSocket(handleMessage, wsOptions)

  const toggleSound = () => {
    setSoundEnabled((prev) => {
      const next = !prev
      if (next) unlockSpeech()
      return next
    })
  }

  const latest = events[0]
  const gateLabel = gate?.name || `Cổng ${gateId.slice(0, 8)}`

  return (
    <div className="min-h-screen w-full bg-[#020617] text-slate-100 flex flex-col relative overflow-hidden">
      {/* Visual background decorations matching Monitoring & Entry-Exit Pages */}
      <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: "radial-gradient(circle, #06b6d4 1.2px, transparent 1.2px)",
            backgroundSize: "24px 24px",
          }}
        />
        <div className="absolute top-1/4 right-1/4 w-[400px] h-[400px] rounded-full bg-cyan-500/5 blur-[130px]" />
        <div className="absolute bottom-1/4 left-1/4 w-[350px] h-[350px] rounded-full bg-emerald-500/5 blur-[120px]" />
      </div>

      {/* Top cybernetic header bar */}
      <header className="relative overflow-hidden border-b border-slate-800 bg-slate-950/60 px-4 py-3 sm:px-6 sm:py-4 backdrop-blur-xl shadow-[0_4px_20px_rgba(0,0,0,0.4)]">
        <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent" />
        
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href="/gate"
              className="flex size-9 items-center justify-center rounded-lg border border-slate-800 bg-slate-900/60 text-slate-400 hover:text-cyan-400 hover:border-cyan-500/30 transition-all duration-200"
              title="Danh sách cổng"
            >
              <ChevronLeft className="h-5 w-5" />
            </Link>
            <div className="min-w-0">
              <span className="text-[8px] font-mono text-cyan-400 block tracking-wider uppercase">{"KIOSK_STREAM // ACTIVE_NODE"}</span>
              <h1 className="truncate text-lg sm:text-xl font-black text-white font-mono uppercase tracking-tight leading-none mt-0.5">
                {gateLabel}
              </h1>
              {gate?.location && (
                <p className="text-xs text-slate-400 mt-1 flex items-center gap-1 font-mono">
                  <MapPin className="h-3.5 w-3.5 text-cyan-500 shrink-0" />
                  <span className="truncate">{gate.location}</span>
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Live digital clock */}
            <div className="min-w-0 font-mono text-left sm:text-right px-3 py-1.5 rounded-lg border border-slate-900 bg-slate-950/80">
              <div className="text-base sm:text-lg font-black text-cyan-400 tabular-nums leading-none">
                {clock.toLocaleTimeString("vi-VN")}
              </div>
              <div className="text-[9px] text-slate-500 uppercase tracking-wider mt-1">
                {clock.toLocaleDateString("vi-VN", {
                  weekday: "short",
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                })}
              </div>
            </div>

            {/* Sound button capsule */}
            <button
              onClick={toggleSound}
              className={`flex items-center h-10 gap-2 px-3.5 rounded-lg text-xs font-mono font-bold uppercase tracking-wider transition-all duration-200 border ${
                soundEnabled
                  ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.15)]"
                  : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700"
              }`}
              title={
                isSpeechSupported()
                  ? "Bật/tắt đọc thông báo"
                  : "Trình duyệt không hỗ trợ đọc thông báo"
              }
              disabled={!isSpeechSupported()}
            >
              {soundEnabled ? (
                <Volume2 className="h-4 w-4 animate-bounce" />
              ) : (
                <VolumeX className="h-4 w-4" />
              )}
              <span>{soundEnabled ? "Mở Loa" : "Tắt Loa"}</span>
            </button>

            {/* Connection state capsule */}
            <button
              type="button"
              className={`flex items-center h-10 gap-2 px-3.5 rounded-lg text-xs font-mono font-bold uppercase tracking-wider transition-all duration-200 border ${
                isConnected
                  ? "bg-cyan-500/10 border-cyan-500/40 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.15)]"
                  : "bg-rose-500/10 border-rose-500/40 text-rose-400 hover:bg-rose-500/20"
              }`}
              onClick={!isConnected ? reconnect : undefined}
              disabled={isConnected}
              aria-label={isConnected ? "Kết nối hoạt động" : "Kết nối lại"}
              title={connectionError || (isConnected ? "Trực tuyến" : "Mất kết nối")}
            >
              {isConnected ? (
                <Wifi className="h-4 w-4 text-cyan-400" />
              ) : (
                <WifiOff className="h-4 w-4 text-rose-400 animate-pulse" />
              )}
              <span>{isConnected ? "CONNECTED" : "DISCONNECT"}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Connection Loss Banner */}
      {!isConnected && (
        <div className="bg-rose-500/20 border-b border-rose-500/30 text-rose-300 text-center py-2.5 text-xs font-mono uppercase tracking-widest animate-pulse relative z-10">
          ⚠️ MẤT KẾT NỐI MÁY CHỦ — ĐANG KHÔI PHỤC ĐƯỜNG TRUYỀN TỰ ĐỘNG...
        </div>
      )}
      {replayError && (
        <div className="bg-amber-500/20 border-b border-amber-500/30 text-amber-300 text-center py-2.5 text-xs font-mono uppercase tracking-widest relative z-10">
          ⚠️ {replayError}
        </div>
      )}

      {/* Main event kiosk displays */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8 relative">
        {latest ? (
          <div
            key={latest.key}
            className={`w-full max-w-4xl rounded-3xl border-2 p-6 sm:p-10 text-center transition-all duration-500 relative backdrop-blur-xl shadow-[0_0_40px_rgba(0,0,0,0.6)] ${
              latest.pending
                ? "border-amber-500/30 bg-amber-500/[0.04] shadow-[0_0_30px_rgba(245,158,11,0.1)]"
                : latest.approved
                ? "border-emerald-500/30 bg-emerald-500/[0.04] shadow-[0_0_30px_rgba(16,185,129,0.1)]"
                : "border-rose-500/30 bg-rose-500/[0.04] shadow-[0_0_30px_rgba(244,63,94,0.1)]"
            }`}
          >
            {/* Visual tech corners */}
            <div className={`absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 rounded-tl-3xl ${
              latest.pending ? "border-amber-400/60" : latest.approved ? "border-emerald-400/60" : "border-rose-400/60"
            }`} />
            <div className={`absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 rounded-tr-3xl ${
              latest.pending ? "border-amber-400/60" : latest.approved ? "border-emerald-400/60" : "border-rose-400/60"
            }`} />
            <div className={`absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 rounded-bl-3xl ${
              latest.pending ? "border-amber-400/60" : latest.approved ? "border-emerald-400/60" : "border-rose-400/60"
            }`} />
            <div className={`absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 rounded-br-3xl ${
              latest.pending ? "border-amber-400/60" : latest.approved ? "border-emerald-400/60" : "border-rose-400/60"
            }`} />

            {/* Glowing Scan Bar Line Animation for visual style */}
            <div className={`absolute left-0 right-0 h-[2px] opacity-40 pointer-events-none animate-[scan_3s_ease-in-out_infinite] ${
              latest.pending ? "bg-amber-400" : latest.approved ? "bg-emerald-400" : "bg-rose-400"
            }`} />

            <style jsx global>{`
              @keyframes scan {
                0%, 100% { top: 10%; }
                50% { top: 90%; }
              }
            `}</style>

            <div className="flex flex-col items-center justify-center gap-3 mb-6 sm:flex-row sm:gap-4">
              {latest.pending ? (
                <div className="relative">
                  <Clock className="h-14 w-14 sm:h-16 sm:w-16 text-amber-400 animate-pulse" />
                  <span className="absolute inset-0 rounded-full bg-amber-400/10 blur-xl animate-ping" />
                </div>
              ) : latest.approved ? (
                <div className="relative">
                  <CheckCircle2 className="h-14 w-14 sm:h-16 sm:w-16 text-emerald-400" />
                  <span className="absolute inset-0 rounded-full bg-emerald-400/10 blur-xl" />
                </div>
              ) : (
                <div className="relative">
                  <XCircle className="h-14 w-14 sm:h-16 sm:w-16 text-rose-400" />
                  <span className="absolute inset-0 rounded-full bg-rose-400/10 blur-xl" />
                </div>
              )}
              
              <span
                className={`text-2xl sm:text-4xl font-black font-mono uppercase tracking-wider ${
                  latest.pending
                    ? "text-amber-400 text-shadow-[0_0_15px_rgba(245,158,11,0.4)]"
                    : latest.approved
                    ? "text-emerald-400 text-shadow-[0_0_15px_rgba(16,185,129,0.4)]"
                    : "text-rose-400 text-shadow-[0_0_15px_rgba(244,63,94,0.4)]"
                }`}
              >
                {latest.pending ? "ĐANG PHÊ DUYỆT" : latest.approved ? "CHO PHÉP THÔNG QUA" : "TỪ CHỐI TRUY CẬP"}
              </span>
            </div>

            {/* High-Tech Plate Plate Display Card */}
            <div className="mb-6 relative inline-block mx-auto">
              <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-slate-800 to-slate-900 opacity-30 blur-md" />
              <div className="relative bg-slate-950 border-4 border-slate-700 text-white rounded-2xl py-4 px-6 sm:py-8 sm:px-12 shadow-2xl tracking-[0.1em] font-mono font-black text-4xl sm:text-7xl md:text-8xl select-all select-none">
                {/* Visual screws matching license plate aesthetics */}
                <div className="absolute top-2 left-1/2 -translate-x-1/2 size-2 rounded-full bg-slate-600 border border-slate-500 shadow-inner" />
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 size-2 rounded-full bg-slate-600 border border-slate-500 shadow-inner" />
                
                {latest.licensePlate}
              </div>
            </div>

            {/* Movement type Badge */}
            <div className="flex flex-wrap items-center justify-center gap-3 mb-6">
              {latest.type === "entry" ? (
                <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-1.5 text-sm sm:text-lg font-mono font-bold text-emerald-400">
                  <ArrowDownToLine className="h-5 w-5 animate-bounce" /> VÀO CỔNG {"[ENTRY]"}
                </span>
              ) : latest.type === "exit" ? (
                <span className="inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-4 py-1.5 text-sm sm:text-lg font-mono font-bold text-cyan-400">
                  <ArrowUpFromLine className="h-5 w-5 animate-bounce" /> RA CỔNG {"[EXIT]"}
                </span>
              ) : (
                <span className="inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900 px-4 py-1.5 text-sm sm:text-lg font-mono font-bold text-slate-400">
                  <Clock3 className="h-5 w-5" /> KIỂM TRA TRUY CẬP
                </span>
              )}
            </div>

            {/* Detailed Metadata Card */}
            {(latest.driverName || latest.unit) && (
              <div className="max-w-xl mx-auto rounded-2xl border border-slate-900 bg-slate-950/60 p-4 sm:p-5 text-left font-mono space-y-3 shadow-inner">
                {latest.driverName && (
                  <div className="flex items-center justify-between border-b border-slate-900 pb-2">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wide">Người điều khiển</span>
                    <span className="text-sm sm:text-base font-black text-slate-200">{latest.driverName}</span>
                  </div>
                )}
                {latest.unit && (
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wide">Đơn vị / Phòng ban</span>
                    <span className="text-xs sm:text-sm font-bold text-cyan-400">{latest.unit}</span>
                  </div>
                )}
              </div>
            )}

            {/* Rejection / Status reason */}
            {!latest.approved && latest.message && (
              <div className={`mt-5 max-w-xl mx-auto rounded-xl p-3.5 border text-xs font-mono flex items-start gap-2.5 text-left ${
                latest.pending 
                  ? "border-amber-500/20 bg-amber-500/10 text-amber-200" 
                  : "border-rose-500/20 bg-rose-500/10 text-rose-200"
              }`}>
                {latest.pending ? <Loader2 className="size-4 shrink-0 text-amber-400 animate-spin mt-0.5" /> : <ShieldAlert className="size-4 shrink-0 text-rose-400 mt-0.5" />}
                <div>
                  <span className="font-bold uppercase block text-[9px] tracking-wider mb-0.5">
                    {latest.pending ? "ĐANG TRA CỨU HỒ SƠ" : "CẢNH BÁO HỆ THỐNG"}
                  </span>
                  <p>{latest.message}</p>
                </div>
              </div>
            )}

            {/* Event Timestamp */}
            <div className="mt-8 flex items-center justify-center gap-1.5 text-slate-500 text-xs font-mono">
              <Clock3 className="size-3.5 text-slate-600" />
              <span>Ghi nhận: {new Date(latest.timestamp).toLocaleString("vi-VN")}</span>
            </div>
          </div>
        ) : (
          /* Empty / Waiting Events screen */
          <div className="text-center font-mono py-12">
            <div className="relative inline-block mb-6">
              <div className="size-20 rounded-full border-4 border-dashed border-cyan-500/30 animate-[spin_10s_linear_infinite] flex items-center justify-center">
                <DoorOpen className="h-8 w-8 text-cyan-500/50" />
              </div>
              <span className="absolute inset-0 rounded-full bg-cyan-500/5 blur-lg" />
            </div>
            <h3 className="text-xl sm:text-2xl font-black text-white uppercase tracking-wider">ĐANG CHỜ SỰ KIỆN...</h3>
            <p className="text-slate-500 text-xs mt-2 max-w-md mx-auto">
              Hệ thống Kiosk đang lắng nghe dữ liệu từ cảm biến AI Camera. Biển số xe và thông tin chi tiết sẽ hiển thị tự động khi có chuyển động qua cổng.
            </p>
          </div>
        )}
      </main>

      {/* Recent events strip */}
      {events.length > 1 && (
        <footer className="relative overflow-hidden border-t border-slate-800 bg-slate-950/40 px-4 py-4 sm:px-6 backdrop-blur-md shadow-[0_-4px_24px_rgba(0,0,0,0.3)]">
          <div className="mb-2 flex items-center gap-2 font-mono text-[9px] text-slate-400 tracking-wider uppercase">
            <span className="size-1.5 rounded-full bg-cyan-400 animate-ping" />
            Lịch sử thông qua gần đây {"// RECENT_HISTORY"}
          </div>
          
          <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
            {events.slice(1, 12).map((e) => {
              const isApproved = e.approved
              const isPending = e.pending
              return (
                <div
                  key={e.key}
                  className={`min-w-[11rem] w-44 shrink-0 rounded-xl border p-3 font-mono transition-all duration-200 hover:border-slate-700/60 hover:bg-slate-950 bg-slate-950/60 ${
                    isPending
                      ? "border-amber-500/20"
                      : isApproved
                      ? "border-emerald-500/20"
                      : "border-rose-500/20"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-black text-xs text-white tracking-wider truncate">{e.licensePlate}</span>
                    {isPending ? (
                      <Clock className="h-3.5 w-3.5 text-amber-400 flex-shrink-0" />
                    ) : isApproved ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0" />
                    ) : (
                      <XCircle className="h-3.5 w-3.5 text-rose-400 flex-shrink-0" />
                    )}
                  </div>
                  
                  <div className="text-[10px] text-slate-400 flex items-center justify-between mt-1 border-t border-slate-900 pt-1.5">
                    <span className={`font-bold uppercase text-[9px] ${
                      e.type === "entry" ? "text-emerald-400" : e.type === "exit" ? "text-cyan-400" : "text-slate-400"
                    }`}>
                      {e.type === "entry" ? "VÀO" : e.type === "exit" ? "RA" : "KT"}
                    </span>
                    <span className="text-slate-500 text-[9px]">{new Date(e.timestamp).toLocaleTimeString("vi-VN")}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </footer>
      )}
    </div>
  )
}

export default function GateKioskPage() {
  const params = useParams<{ gateId: string }>()
  const gateId = params?.gateId

  if (!gateId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#020617] text-slate-400 font-mono text-sm">
        ⚠️ Cổng định vị không hợp lệ.
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <GateKiosk gateId={gateId} />
    </ErrorBoundary>
  )
}
