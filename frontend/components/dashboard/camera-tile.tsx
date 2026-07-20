"use client"

import * as React from "react"
import { Camera, Clock, Loader2, Radio, RefreshCw, TriangleAlert, WifiOff } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import type { DashboardCamera } from "@/lib/api/dashboard-api"

function lastUpdate(value: string | null): string {
  if (!value) return "Chưa nhận heartbeat"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Không rõ"
  return new Intl.DateTimeFormat("vi-VN", { timeStyle: "medium" }).format(date)
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
        hls.on(Hls.Events.MANIFEST_PARSED, () => void video.play().catch(() => undefined))
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

  const unavailableMessage = online
    ? expired
      ? "Liên kết phát trực tiếp đã hết hạn. Hãy làm mới camera để thử lại."
      : "Không thể tải luồng camera vào lúc này."
    : "Camera đang ngoại tuyến và chưa thể cung cấp hình ảnh mới."

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <div className="relative aspect-video border-b border-border bg-muted">
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
          <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
            {online ? <TriangleAlert className="size-9 text-[var(--color-warning)]" /> : <WifiOff className="size-9 text-destructive" />}
            <p className="max-w-xs text-sm leading-6 text-muted-foreground">{unavailableMessage}</p>
            {online && (
              <Button variant="outline" onClick={retry}>
                <RefreshCw className="size-4" />
                Thử lại
              </Button>
            )}
          </div>
        )}

        {loading && (canStream || canSnapshot) && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center bg-card/80 text-sm text-muted-foreground backdrop-blur-sm">
            <span className="flex items-center gap-2"><Loader2 className="size-5 animate-spin text-primary" />Đang tải hình ảnh…</span>
          </div>
        )}

        <Badge variant={online ? "default" : "destructive"} className="absolute left-3 top-3 gap-1.5 shadow-sm">
          <Radio className="size-3" aria-hidden="true" />
          {online ? "Trực tuyến" : camera.status || "Ngoại tuyến"}
        </Badge>
      </div>

      <CardContent className="grid gap-3 p-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-[var(--radius-input)] bg-primary-container text-on-primary-container">
            <Camera className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-foreground">{camera.name}</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">{camera.zoneId ? "Camera theo khu vực" : "Camera theo bãi đỗ"}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
          <Clock className="size-4 shrink-0" aria-hidden="true" />
          <span>Cập nhật: {lastUpdate(camera.lastSeenAt)}</span>
        </div>
      </CardContent>
    </Card>
  )
}
