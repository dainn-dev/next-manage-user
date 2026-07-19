"use client"

import * as React from "react"
import { Camera, Clock, Loader2, Radio, RefreshCw, TriangleAlert, WifiOff } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { DashboardCamera } from "@/lib/api/dashboard-api"

function lastUpdate(value: string | null): string {
  if (!value) return "Chưa nhận heartbeat"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Không rõ"
  return new Intl.DateTimeFormat("vi-VN", {
    timeStyle: "medium",
  }).format(date)
}

export function CameraTile({ camera }: { camera: DashboardCamera }) {
  const videoRef = React.useRef<HTMLVideoElement>(null)
  const [streamFailed, setStreamFailed] = React.useState(false)
  const [snapshotFailed, setSnapshotFailed] = React.useState(false)
  const [loading, setLoading] = React.useState(true)
  const [snapshotRevision, setSnapshotRevision] = React.useState(0)
  const online = camera.status === "ONLINE" || camera.status === "ACTIVE"
  const expired = !!camera.streamExpiresAt && new Date(camera.streamExpiresAt).getTime() <= Date.now()
  const browserPlayable = ["HLS", "MJPEG", "MP4"].includes(camera.streamKind || "")
  const canStream = online && browserPlayable && !!camera.streamUrl && !expired && !streamFailed
  const canSnapshot = online && !!camera.snapshotUrl && !snapshotFailed
  const snapshotUrl = camera.snapshotUrl
    ? `${camera.snapshotUrl}${camera.snapshotUrl.includes("?") ? "&" : "?"}pv=${snapshotRevision}`
    : null

  React.useEffect(() => {
    setStreamFailed(false)
    setSnapshotFailed(false)
    setLoading(true)
    setSnapshotRevision(0)
  }, [camera.id, camera.streamUrl, camera.snapshotUrl])

  React.useEffect(() => {
    if (!online || !camera.snapshotUrl) return
    const interval = window.setInterval(() => setSnapshotRevision((value) => value + 1), 10000)
    return () => window.clearInterval(interval)
  }, [online, camera.snapshotUrl])

  React.useEffect(() => {
    const video = videoRef.current
    if (!video || !canStream || camera.streamKind !== "HLS" || !camera.streamUrl) return
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = camera.streamUrl
      return () => {
        video.removeAttribute("src")
        video.load()
      }
    }
    let cancelled = false
    let destroy = () => undefined
    void import("hls.js")
      .then(({ default: Hls }) => {
        if (cancelled) return
        if (!Hls.isSupported()) {
          setStreamFailed(true)
          return
        }
        const hls = new Hls({ lowLatencyMode: true, backBufferLength: 30 })
        destroy = () => hls.destroy()
        hls.loadSource(camera.streamUrl!)
        hls.attachMedia(video)
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          void video.play().catch(() => undefined)
        })
        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (data.fatal) setStreamFailed(true)
        })
      })
      .catch(() => setStreamFailed(true))
    return () => {
      cancelled = true
      destroy()
    }
  }, [camera.streamKind, camera.streamUrl, canStream])

  const retry = () => {
    setStreamFailed(false)
    setSnapshotFailed(false)
    setLoading(true)
    setSnapshotRevision((value) => value + 1)
  }

  return (
    <div className="relative overflow-hidden rounded-xl border border-slate-800 bg-slate-950/40 hover:bg-slate-950/80 transition-all duration-300 hover:scale-[1.01] hover:border-slate-700/50 shadow-[0_4px_12px_rgba(0,0,0,0.5)] group">
      {/* High-tech top indicator strip */}
      <div
        className={`absolute top-0 left-0 right-0 h-[2px] transition-all duration-300 z-10 ${
          online ? "bg-emerald-500/50 group-hover:bg-emerald-400" : "bg-rose-500/50 group-hover:bg-rose-400"
        }`}
      />

      {/* Cyber corners decorations */}
      <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-slate-700/50 group-hover:border-cyan-500/40 z-10" />
      <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-slate-700/50 group-hover:border-cyan-500/40 z-10" />
      <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-slate-700/50 group-hover:border-cyan-500/40 z-10" />
      <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-slate-700/50 group-hover:border-cyan-500/40 z-10" />

      {/* Camera Video / Snapshot Feed Frame */}
      <div className="relative aspect-video overflow-hidden bg-slate-950 border-b border-slate-900">
        {canStream ? (
          camera.streamKind === "MJPEG" ? (
            <img
              src={camera.streamUrl!}
              alt={`Camera trực tiếp ${camera.name}`}
              className="h-full w-full object-cover"
              onLoad={() => setLoading(false)}
              onError={() => setStreamFailed(true)}
            />
          ) : (
            <video
              ref={videoRef}
              src={camera.streamKind === "MP4" ? camera.streamUrl! : undefined}
              poster={snapshotUrl || undefined}
              className="h-full w-full object-cover"
              autoPlay
              muted
              playsInline
              controls
              onPlaying={() => setLoading(false)}
              onError={() => setStreamFailed(true)}
            />
          )
        ) : canSnapshot ? (
          <img
            src={snapshotUrl!}
            alt={`Ảnh mới nhất từ ${camera.name}`}
            className="h-full w-full object-cover"
            onLoad={() => setLoading(false)}
            onError={() => setSnapshotFailed(true)}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center text-slate-500 font-mono">
            {online ? (
              <TriangleAlert className="h-8 w-8 text-amber-500/70" />
            ) : (
              <WifiOff className="h-8 w-8 text-rose-500/70" />
            )}
            <p className="text-[10px] max-w-xs uppercase tracking-wide leading-relaxed">
              {online
                ? expired
                  ? "STREAM_EXPIRED // LIÊN KẾT HẾT HẠN"
                  : "ERR_STREAM_LOAD // KHÔNG THỂ TẢI STREAM"
                : "FEED_OFFLINE // CAMERA NGOẠI TUYẾN"}
            </p>
            {online && (
              <Button
                variant="outline"
                size="sm"
                onClick={retry}
                className="h-7 px-2.5 rounded border border-slate-800 bg-slate-950 hover:bg-slate-900 text-slate-300 font-mono text-[9px] uppercase tracking-wider"
              >
                <RefreshCw className="mr-1 size-3" /> THỬ LẠI
              </Button>
            )}
          </div>
        )}

        {/* Real-time scanning effect when online and active stream */}
        {online && (canStream || canSnapshot) && (
          <div className="absolute inset-0 bg-cyan-500/[0.02] pointer-events-none" />
        )}

        {online && loading && (canStream || canSnapshot) && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-slate-950/60 text-slate-400 font-mono text-[10px]">
            <Loader2 className="h-6 w-6 animate-spin mr-2 text-cyan-400" />
            <span>DECRYPTING_FEED...</span>
          </div>
        )}

        <Badge
          variant="outline"
          className={`absolute left-3 top-3 gap-1.5 font-mono text-[9px] font-bold tracking-wider px-2 py-0.5 rounded uppercase border transition-all z-20 ${
            online
              ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
              : "border-rose-500/20 bg-rose-500/10 text-rose-400"
          }`}
        >
          <span
            className={`inline-block w-1.5 h-1.5 rounded-full ${
              online ? "bg-emerald-400 animate-pulse" : "bg-rose-400"
            }`}
          />
          {online ? "ONLINE" : camera.status || "OFFLINE"}
        </Badge>
      </div>

      {/* Metadata Detail Section */}
      <div className="p-4 flex flex-col justify-between h-full space-y-2">
        <div className="min-w-0">
          <span className="text-[8px] font-mono text-slate-600 block">{"[NODE_FEED]"}</span>
          <h3 className="truncate font-mono text-sm font-black text-white group-hover:text-cyan-400 transition-colors uppercase mt-0.5">
            {camera.name}
          </h3>
        </div>

        <div className="flex items-center justify-between gap-3 text-[10px] font-mono text-slate-400 mt-2 border-t border-slate-900 pt-2.5">
          <span className="truncate uppercase text-slate-500">
            {camera.zoneId ? "CHANN_ZONE" : "CHANN_SITE"}
          </span>
          <span
            className="flex shrink-0 items-center gap-1.5 text-slate-300 font-bold"
            title={camera.lastSeenAt || undefined}
          >
            <Clock className="h-3.5 w-3.5 text-cyan-400" />
            {lastUpdate(camera.lastSeenAt)}
          </span>
        </div>
      </div>
    </div>
  )
}
