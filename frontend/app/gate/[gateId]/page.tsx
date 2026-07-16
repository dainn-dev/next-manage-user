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
      <header className="flex flex-col gap-3 border-b border-slate-800 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-4">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <Link
            href="/gate"
            className="flex items-center gap-1 text-slate-400 hover:text-white transition-colors"
            title="Danh sách cổng"
          >
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold tracking-tight sm:text-2xl">{gateLabel}</h1>
            {gate?.location && (
              <p className="text-sm text-slate-400">{gate.location}</p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-4">
          <div className="min-w-0 font-mono sm:text-right">
            <div className="text-xl font-bold sm:text-2xl">
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

          <button
            type="button"
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium cursor-pointer ${
              isConnected
                ? "bg-emerald-600/20 text-emerald-400"
                : "bg-red-600/20 text-red-400 hover:bg-red-600/30"
            }`}
            onClick={!isConnected ? reconnect : undefined}
            disabled={isConnected}
            aria-label={isConnected ? "Kết nối máy chủ đang hoạt động" : "Kết nối lại máy chủ"}
            title={connectionError || (isConnected ? "Đang kết nối" : "Kết nối lại")}
          >
            {isConnected ? (
              <Wifi className="h-4 w-4" />
            ) : (
              <WifiOff className="h-4 w-4" />
            )}
            {isConnected ? "Trực tuyến" : "Mất kết nối"}
          </button>
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
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-6 sm:px-6 sm:py-8">
        {latest ? (
          <div
            key={latest.key}
            className={`w-full max-w-4xl rounded-3xl border-4 p-5 text-center transition-all sm:p-10 ${
              latest.pending
                ? "border-amber-500 bg-amber-500/10"
                : latest.approved
                ? "border-emerald-500 bg-emerald-500/10"
                : "border-red-500 bg-red-500/10"
            }`}
          >
            <div className="flex flex-col items-center justify-center gap-3 mb-6 sm:flex-row sm:gap-4">
              {latest.pending ? (
                <Clock className="h-20 w-20 text-amber-400" />
              ) : latest.approved ? (
                <CheckCircle2 className="h-20 w-20 text-emerald-400" />
              ) : (
                <XCircle className="h-20 w-20 text-red-400" />
              )}
              <span
                className={`text-3xl font-black sm:text-5xl ${
                  latest.pending
                    ? "text-amber-400"
                    : latest.approved
                    ? "text-emerald-400"
                    : "text-red-400"
                }`}
              >
                {latest.pending ? "CHỜ PHÊ DUYỆT" : latest.approved ? "ĐƯỢC PHÉP" : "TỪ CHỐI"}
              </span>
            </div>

            <div className="mb-6 break-all text-4xl font-black tracking-[0.12em] sm:text-8xl sm:tracking-widest">
              {latest.licensePlate}
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 mb-6">
              {latest.type === "entry" ? (
                <span className="inline-flex items-center gap-2 text-lg font-bold text-emerald-300 sm:text-2xl">
                  <ArrowDownToLine className="h-7 w-7" /> VÀO CỔNG
                </span>
              ) : latest.type === "exit" ? (
                <span className="inline-flex items-center gap-2 text-lg font-bold text-sky-300 sm:text-2xl">
                  <ArrowUpFromLine className="h-7 w-7" /> RA CỔNG
                </span>
              ) : (
                <span className="text-lg font-bold text-slate-300 sm:text-2xl">KIỂM TRA</span>
              )}
            </div>

            {(latest.driverName || latest.unit) && (
              <div className="space-y-1 text-xl text-white/90 sm:text-3xl">
                {latest.driverName && (
                  <div className="font-semibold">{latest.driverName}</div>
                )}
                {latest.unit && (
                  <div className="text-base text-slate-300 sm:text-xl">{latest.unit}</div>
                )}
              </div>
            )}

            {!latest.approved && latest.message && (
              <p className={`mt-4 text-lg ${latest.pending ? "text-amber-200" : "text-red-200"}`}>
                {latest.message}
              </p>
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
      <footer className="border-t border-slate-800 px-4 py-4 sm:px-6">
        <div className="grid gap-3 sm:flex sm:overflow-x-auto">
            {events.slice(1, 12).map((e) => (
              <div
                key={e.key}
                className={`min-w-0 rounded-xl border p-3 sm:w-44 sm:shrink-0 ${
                  e.pending
                    ? "border-amber-700 bg-amber-900/20"
                    : e.approved
                    ? "border-emerald-700 bg-emerald-900/20"
                    : "border-red-800 bg-red-900/20"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-lg truncate">{e.licensePlate}</span>
                  {e.pending ? (
                    <Clock className="h-4 w-4 text-amber-400 flex-shrink-0" />
                  ) : e.approved ? (
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
