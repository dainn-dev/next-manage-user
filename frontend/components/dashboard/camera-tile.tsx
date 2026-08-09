"use client"

import * as React from "react"
import { Camera, Clock, Loader2, Pencil, Radio, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { DashboardCamera } from "@/lib/api/dashboard-api"

function formatClock(value: string | null): string {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Không rõ"
  return new Intl.DateTimeFormat("vi-VN", { timeStyle: "medium" }).format(date)
}

function formatRelative(value: string | null, nowMs: number): string {
  if (!value) return "Chưa nhận heartbeat"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Không rõ"
  const deltaSec = Math.max(0, Math.floor((nowMs - date.getTime()) / 1000))
  if (deltaSec < 5) return "Vừa xong"
  if (deltaSec < 60) return `${deltaSec} giây trước`
  const minutes = Math.floor(deltaSec / 60)
  if (minutes < 60) return `${minutes} phút trước`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} giờ trước`
  return `${Math.floor(hours / 24)} ngày trước`
}

function statusLabel(status: string, online: boolean): string {
  if (online) return "ONLINE"
  const normalized = (status || "OFFLINE").toUpperCase()
  if (normalized === "PROVISIONED") return "PROVISIONED"
  if (normalized === "DISABLED") return "DISABLED"
  if (normalized === "ERROR") return "ERROR"
  return "OFFLINE"
}

export function CameraTile({
  camera,
  onEdit,
  onDelete,
}: {
  camera: DashboardCamera
  onEdit?: (camera: DashboardCamera) => void
  onDelete?: (camera: DashboardCamera) => void
}) {
  const videoRef = React.useRef<HTMLVideoElement>(null)
  const [streamFailed, setStreamFailed] = React.useState(false)
  const [snapshotFailed, setSnapshotFailed] = React.useState(false)
  const [loading, setLoading] = React.useState(true)
  const [snapshotRevision, setSnapshotRevision] = React.useState(0)
  const [nowMs, setNowMs] = React.useState(() => Date.now())
  const online = camera.status === "ONLINE" || camera.status === "ACTIVE"
  const expired = !!camera.streamExpiresAt && new Date(camera.streamExpiresAt).getTime() <= Date.now()
  const browserPlayable = ["HLS", "MJPEG", "MP4"].includes(camera.streamKind || "")
  const canStream = browserPlayable && !!camera.streamUrl && !expired && !streamFailed
  const canSnapshot = !!camera.snapshotUrl && !snapshotFailed
  const hasMedia = canStream || canSnapshot
  const snapshotUrl = camera.snapshotUrl
    ? `${camera.snapshotUrl}${camera.snapshotUrl.includes("?") ? "&" : "?"}pv=${snapshotRevision}`
    : null
  const label = statusLabel(camera.status, online)

  React.useEffect(() => {
    const interval = window.setInterval(() => setNowMs(Date.now()), 1000)
    return () => window.clearInterval(interval)
  }, [])

  React.useEffect(() => {
    setStreamFailed(false)
    setSnapshotFailed(false)
    setLoading(true)
    setSnapshotRevision(0)
  }, [camera.id, camera.streamUrl, camera.snapshotUrl])

  React.useEffect(() => {
    if (!camera.snapshotUrl) return
    const interval = window.setInterval(() => setSnapshotRevision((value) => value + 1), 10000)
    return () => window.clearInterval(interval)
  }, [camera.snapshotUrl])

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
    let destroy: () => void = () => {}
    void import("hls.js")
      .then(({ default: Hls }) => {
        if (cancelled) return
        if (!Hls.isSupported()) {
          setStreamFailed(true)
          return
        }
        const hls = new Hls({ lowLatencyMode: true, backBufferLength: 30 })
        destroy = () => { hls.destroy() }
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

  return (
    <Card className="gap-0 overflow-hidden py-0">
      {hasMedia && (
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
          ) : (
            <img
              src={snapshotUrl!}
              alt={`Ảnh mới nhất từ ${camera.name}`}
              className="h-full w-full object-cover"
              onLoad={() => setLoading(false)}
              onError={() => setSnapshotFailed(true)}
            />
          )}

          {loading && (
            <div className="pointer-events-none absolute inset-0 grid place-items-center bg-card/80 text-sm text-muted-foreground backdrop-blur-sm">
              <span className="flex items-center gap-2">
                <Loader2 className="size-5 animate-spin text-primary" />
                Đang tải hình ảnh…
              </span>
            </div>
          )}
        </div>
      )}

      <CardContent className="grid gap-3 p-4">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className={cn(
              "grid size-10 shrink-0 place-items-center rounded-[var(--radius-input)]",
              online
                ? "bg-[var(--color-success-surface)] text-[var(--color-success)]"
                : "bg-muted text-muted-foreground",
            )}
          >
            <Camera className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h3 className="truncate text-sm font-semibold text-foreground">{camera.name}</h3>
              <Badge
                variant="outline"
                className={cn(
                  "gap-1.5 font-mono text-[10px] tracking-wide",
                  online
                    ? "border-[var(--color-success)]/25 bg-[var(--color-success-surface)] text-[var(--color-success)]"
                    : "border-destructive/25 bg-destructive/10 text-destructive",
                )}
              >
                <Radio className={cn("size-3", online && "animate-pulse")} aria-hidden="true" />
                {label}
              </Badge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {camera.role === "ANPR_GATE" ? "Camera cổng ANPR" : "Camera tổng quan bãi"}
              {camera.zoneId ? " · theo khu vực" : ""}
            </p>
          </div>
          {(onEdit || onDelete) && (
            <div className="flex shrink-0 items-center gap-1">
              {onEdit && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  onClick={() => onEdit(camera)}
                  aria-label={`Sửa camera ${camera.name}`}
                >
                  <Pencil className="size-4" />
                </Button>
              )}
              {onDelete && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 text-destructive hover:text-destructive"
                  onClick={() => onDelete(camera)}
                  aria-label={`Xoá camera ${camera.name}`}
                >
                  <Trash2 className="size-4" />
                </Button>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border pt-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Clock className="size-3.5 shrink-0" aria-hidden="true" />
            <span className={cn(online && "text-[var(--color-success)]")}>
              {formatRelative(camera.lastSeenAt, nowMs)}
            </span>
          </span>
          <span className="tabular-nums">{formatClock(camera.lastSeenAt)}</span>
        </div>
      </CardContent>
    </Card>
  )
}
