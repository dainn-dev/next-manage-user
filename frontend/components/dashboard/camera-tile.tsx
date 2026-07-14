"use client"

import * as React from 'react'
import { Camera, Clock, Loader2, Radio, RefreshCw, TriangleAlert, WifiOff } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { DashboardCamera } from '@/lib/api/dashboard-api'

function lastUpdate(value: string | null): string {
  if (!value) return 'Chưa nhận heartbeat'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Không rõ thời gian'
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'medium' }).format(date)
}

export function CameraTile({ camera }: { camera: DashboardCamera }) {
  const videoRef = React.useRef<HTMLVideoElement>(null)
  const [streamFailed, setStreamFailed] = React.useState(false)
  const [snapshotFailed, setSnapshotFailed] = React.useState(false)
  const [loading, setLoading] = React.useState(true)
  const [snapshotRevision, setSnapshotRevision] = React.useState(0)
  const online = camera.status === 'ONLINE' || camera.status === 'ACTIVE'
  const expired = !!camera.streamExpiresAt && new Date(camera.streamExpiresAt).getTime() <= Date.now()
  const browserPlayable = ['HLS', 'MJPEG', 'MP4'].includes(camera.streamKind || '')
  const canStream = online && browserPlayable && !!camera.streamUrl && !expired && !streamFailed
  const canSnapshot = online && !!camera.snapshotUrl && !snapshotFailed
  const snapshotUrl = camera.snapshotUrl
    ? `${camera.snapshotUrl}${camera.snapshotUrl.includes('?') ? '&' : '?'}pv=${snapshotRevision}`
    : null

  React.useEffect(() => {
    setStreamFailed(false); setSnapshotFailed(false); setLoading(true); setSnapshotRevision(0)
  }, [camera.id, camera.streamUrl, camera.snapshotUrl])

  React.useEffect(() => {
    if (!online || !camera.snapshotUrl) return
    const interval = window.setInterval(() => setSnapshotRevision((value) => value + 1), 10000)
    return () => window.clearInterval(interval)
  }, [online, camera.snapshotUrl])

  React.useEffect(() => {
    const video = videoRef.current
    if (!video || !canStream || camera.streamKind !== 'HLS' || !camera.streamUrl) return
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = camera.streamUrl
      return () => { video.removeAttribute('src'); video.load() }
    }
    let cancelled = false
    let destroy = () => undefined
    void import('hls.js').then(({ default: Hls }) => {
      if (cancelled) return
      if (!Hls.isSupported()) { setStreamFailed(true); return }
      const hls = new Hls({ lowLatencyMode: true, backBufferLength: 30 })
      destroy = () => hls.destroy()
      hls.loadSource(camera.streamUrl!)
      hls.attachMedia(video)
      hls.on(Hls.Events.MANIFEST_PARSED, () => { void video.play().catch(() => undefined) })
      hls.on(Hls.Events.ERROR, (_event, data) => { if (data.fatal) setStreamFailed(true) })
    }).catch(() => setStreamFailed(true))
    return () => { cancelled = true; destroy() }
  }, [camera.streamKind, camera.streamUrl, canStream])

  const retry = () => {
    setStreamFailed(false); setSnapshotFailed(false); setLoading(true)
    setSnapshotRevision((value) => value + 1)
  }

  return (
    <Card className="overflow-hidden">
      <div className="relative aspect-video overflow-hidden bg-slate-950">
        {canStream ? (
          camera.streamKind === 'MJPEG' ? (
            <img src={camera.streamUrl!} alt={`Camera trực tiếp ${camera.name}`} className="h-full w-full object-cover" onLoad={() => setLoading(false)} onError={() => setStreamFailed(true)} />
          ) : (
            <video ref={videoRef} src={camera.streamKind === 'MP4' ? camera.streamUrl! : undefined} poster={snapshotUrl || undefined} className="h-full w-full object-cover" autoPlay muted playsInline controls onPlaying={() => setLoading(false)} onError={() => setStreamFailed(true)} />
          )
        ) : canSnapshot ? (
          <img src={snapshotUrl!} alt={`Ảnh mới nhất từ ${camera.name}`} className="h-full w-full object-cover" onLoad={() => setLoading(false)} onError={() => setSnapshotFailed(true)} />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center text-slate-400">
            {online ? <TriangleAlert className="h-9 w-9" /> : <WifiOff className="h-9 w-9" />}
            <p className="text-sm">{online ? expired ? 'Liên kết stream đã hết hạn' : 'Không thể tải stream hoặc snapshot' : 'Camera đang ngoại tuyến'}</p>
            {online && <Button variant="secondary" size="sm" onClick={retry}><RefreshCw className="mr-2 h-4 w-4" />Thử lại</Button>}
          </div>
        )}
        {online && loading && (canStream || canSnapshot) && <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-slate-950/60 text-slate-300"><Loader2 className="h-7 w-7 animate-spin" /></div>}
        <Badge className="absolute left-3 top-3 gap-1" variant={online ? 'default' : 'secondary'}>
          {online && <Radio className="h-3 w-3" />}{online ? 'Trực tuyến' : camera.status || 'Không rõ'}
        </Badge>
      </div>
      <CardHeader className="pb-2">
        <CardTitle className="truncate text-base">{camera.name}</CardTitle>
      </CardHeader>
      <CardContent className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span className="truncate">{camera.zoneId ? 'Theo zone đã chọn' : 'Toàn site'}</span>
        <span className="flex shrink-0 items-center gap-1" title={camera.lastSeenAt || undefined}>
          <Clock className="h-3.5 w-3.5" />{lastUpdate(camera.lastSeenAt)}
        </span>
      </CardContent>
    </Card>
  )
}
