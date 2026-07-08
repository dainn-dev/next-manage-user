"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  CheckCircle2,
  XCircle,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
  ChevronLeft,
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
    <div className="min-h-screen w-full bg-slate-950 text-white flex flex-col">
      {/* Top bar */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
        <div className="flex items-center gap-4">
          <Link
            href="/gate"
            className="flex items-center gap-1 text-slate-400 hover:text-white transition-colors"
            title="Danh sách cổng"
          >
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{gateLabel}</h1>
            {gate?.location && (
              <p className="text-sm text-slate-400">{gate.location}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right font-mono">
            <div className="text-2xl font-bold">
              {clock.toLocaleTimeString("vi-VN")}
            </div>
            <div className="text-xs text-slate-400">
              {clock.toLocaleDateString("vi-VN", {
                weekday: "long",
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
              })}
            </div>
          </div>

          <button
            onClick={toggleSound}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              soundEnabled
                ? "bg-emerald-600 hover:bg-emerald-500"
                : "bg-slate-800 hover:bg-slate-700 text-slate-300"
            }`}
            title={
              isSpeechSupported()
                ? "Bật/tắt đọc thông báo"
                : "Trình duyệt không hỗ trợ đọc thông báo"
            }
            disabled={!isSpeechSupported()}
          >
            {soundEnabled ? (
              <Volume2 className="h-4 w-4" />
            ) : (
              <VolumeX className="h-4 w-4" />
            )}
            {soundEnabled ? "Âm thanh" : "Bật âm thanh"}
          </button>

          <div
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium cursor-pointer ${
              isConnected
                ? "bg-emerald-600/20 text-emerald-400"
                : "bg-red-600/20 text-red-400 hover:bg-red-600/30"
            }`}
            onClick={!isConnected ? reconnect : undefined}
            title={connectionError || (isConnected ? "Đang kết nối" : "Kết nối lại")}
          >
            {isConnected ? (
              <Wifi className="h-4 w-4" />
            ) : (
              <WifiOff className="h-4 w-4" />
            )}
            {isConnected ? "Trực tuyến" : "Mất kết nối"}
          </div>
        </div>
      </header>

      {/* Disconnect / replay banners */}
      {!isConnected && (
        <div className="bg-red-600/90 text-white text-center py-2 text-sm font-medium">
          Mất kết nối máy chủ — đang tự động kết nối lại. Sự kiện bỏ lỡ sẽ được tải
          lại khi kết nối phục hồi.
        </div>
      )}
      {replayError && (
        <div className="bg-amber-500/90 text-black text-center py-2 text-sm font-medium">
          {replayError}
        </div>
      )}

      {/* Main event display */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-8">
        {latest ? (
          <div
            key={latest.key}
            className={`w-full max-w-4xl rounded-3xl border-4 p-10 text-center transition-all ${
              latest.approved
                ? "border-emerald-500 bg-emerald-500/10"
                : "border-red-500 bg-red-500/10"
            }`}
          >
            <div className="flex items-center justify-center gap-4 mb-6">
              {latest.approved ? (
                <CheckCircle2 className="h-20 w-20 text-emerald-400" />
              ) : (
                <XCircle className="h-20 w-20 text-red-400" />
              )}
              <span
                className={`text-5xl font-black ${
                  latest.approved ? "text-emerald-400" : "text-red-400"
                }`}
              >
                {latest.approved ? "ĐƯỢC PHÉP" : "TỪ CHỐI"}
              </span>
            </div>

            <div className="text-8xl font-black tracking-widest mb-6 break-all">
              {latest.licensePlate}
            </div>

            <div className="flex items-center justify-center gap-3 mb-6">
              {latest.type === "entry" ? (
                <span className="inline-flex items-center gap-2 text-2xl font-bold text-emerald-300">
                  <ArrowDownToLine className="h-7 w-7" /> VÀO CỔNG
                </span>
              ) : latest.type === "exit" ? (
                <span className="inline-flex items-center gap-2 text-2xl font-bold text-sky-300">
                  <ArrowUpFromLine className="h-7 w-7" /> RA CỔNG
                </span>
              ) : (
                <span className="text-2xl font-bold text-slate-300">KIỂM TRA</span>
              )}
            </div>

            {(latest.driverName || latest.unit) && (
              <div className="text-3xl text-white/90 space-y-1">
                {latest.driverName && (
                  <div className="font-semibold">{latest.driverName}</div>
                )}
                {latest.unit && (
                  <div className="text-xl text-slate-300">{latest.unit}</div>
                )}
              </div>
            )}

            {!latest.approved && latest.message && (
              <p className="mt-4 text-lg text-red-200">{latest.message}</p>
            )}

            <div className="mt-8 text-slate-400 text-lg">
              {new Date(latest.timestamp).toLocaleString("vi-VN")}
            </div>
          </div>
        ) : (
          <div className="text-center text-slate-500">
            <div className="text-3xl font-semibold mb-2">Đang chờ sự kiện…</div>
            <p className="text-lg">
              Kiosk sẽ hiển thị biển số và kết quả ngay khi có xe qua cổng.
            </p>
          </div>
        )}
      </main>

      {/* Recent events strip */}
      {events.length > 1 && (
        <footer className="border-t border-slate-800 px-6 py-4">
          <div className="flex gap-3 overflow-x-auto">
            {events.slice(1, 12).map((e) => (
              <div
                key={e.key}
                className={`flex-shrink-0 w-44 rounded-xl border p-3 ${
                  e.approved
                    ? "border-emerald-700 bg-emerald-900/20"
                    : "border-red-800 bg-red-900/20"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-lg truncate">{e.licensePlate}</span>
                  {e.approved ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-400 flex-shrink-0" />
                  )}
                </div>
                <div className="text-xs text-slate-400 flex items-center justify-between">
                  <span>
                    {e.type === "entry" ? "Vào" : e.type === "exit" ? "Ra" : "—"}
                  </span>
                  <span>{new Date(e.timestamp).toLocaleTimeString("vi-VN")}</span>
                </div>
              </div>
            ))}
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
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
        Cổng không hợp lệ.
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <GateKiosk gateId={gateId} />
    </ErrorBoundary>
  )
}
