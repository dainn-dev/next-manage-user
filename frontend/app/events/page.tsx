"use client"

import * as React from 'react'
import { AlertCircle, ArrowDownToLine, ArrowLeftRight, ArrowUpFromLine, Camera, ExternalLink, Loader2, MapPin, RefreshCw, ScanLine, WifiOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useDashboardData } from '@/lib/dashboard-data-context'
import { useDashboardScope } from '@/lib/dashboard-scope-context'
import type { DashboardEvent } from '@/lib/api/dashboard-api'

const FILTERS = ['ALL', 'VEHICLE_ENTERED', 'VEHICLE_RELOCATED', 'VEHICLE_EXITED', 'MOTION_DETECTED'] as const

const EVENT_META: Record<string, { label: string; icon: typeof Camera; tone: string }> = {
  VEHICLE_ENTERED: { label: 'Xe vào bãi', icon: ArrowDownToLine, tone: 'bg-green-500/10 text-green-700' },
  VEHICLE_RELOCATED: { label: 'Xe được di chuyển', icon: ArrowLeftRight, tone: 'bg-amber-500/10 text-amber-700' },
  VEHICLE_EXITED: { label: 'Xe rời bãi', icon: ArrowUpFromLine, tone: 'bg-blue-500/10 text-blue-700' },
  MOTION_DETECTED: { label: 'Phát hiện chuyển động', icon: ScanLine, tone: 'bg-purple-500/10 text-purple-700' },
}

export default function EventsPage() {
  const [filter, setFilter] = React.useState<(typeof FILTERS)[number]>('ALL')
  const { events, cameras, slots, status, error, realtime, realtimeError, refresh, lastUpdatedAt,
    setEventFilter, loadMoreEvents, eventsHasMore, eventsLoadingMore } = useDashboardData()
  const { selectedSiteId, selectedZoneId } = useDashboardScope()

  React.useEffect(() => {
    setEventFilter(filter)
    return () => setEventFilter('ALL')
  }, [filter, setEventFilter])

  const scoped = React.useMemo(() => events.filter((event) => {
    if (event.siteId !== selectedSiteId) return false
    if (selectedZoneId && event.zoneId && event.zoneId !== selectedZoneId) return false
    if (selectedZoneId && !event.zoneId) {
      const camera = cameras.find((item) => item.id === event.cameraId)
      const slot = slots.find((item) => item.id === event.slotId)
      if (camera?.zoneId !== selectedZoneId && slot?.zoneId !== selectedZoneId) return false
    }
    return true
  }), [events, selectedSiteId, selectedZoneId, cameras, slots])

  return <div className="mx-auto max-w-5xl space-y-6 p-6">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h1 className="text-2xl font-semibold">Dòng sự kiện vận hành</h1><p className="text-sm text-muted-foreground">Sự kiện mới nhất trong site và zone đang chọn.</p></div><div className="flex gap-2"><Select value={filter} onValueChange={(value) => setFilter(value as typeof filter)}><SelectTrigger className="w-52"><SelectValue /></SelectTrigger><SelectContent>{FILTERS.map((type) => <SelectItem key={type} value={type}>{type === 'ALL' ? 'Tất cả sự kiện' : EVENT_META[type]?.label || type}</SelectItem>)}</SelectContent></Select><Button variant="outline" size="icon" onClick={() => void refresh()} aria-label="Làm mới"><RefreshCw className="h-4 w-4" /></Button></div></div>

    {realtime !== 'live' && <div className="flex items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm"><WifiOff className="h-4 w-4" /><span>{realtimeError || 'Realtime chưa kết nối; timeline đang dùng polling fallback.'}</span>{lastUpdatedAt && <span className="ml-auto text-xs text-muted-foreground">Cập nhật {new Date(lastUpdatedAt).toLocaleTimeString('vi-VN')}</span>}</div>}
    {error && <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"><AlertCircle className="h-4 w-4" />{error}</div>}

    {!selectedSiteId ? <EmptyState title="Chưa có site để hiển thị" /> : status === 'loading' || status === 'idle' ? <div className="flex min-h-72 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div> : scoped.length === 0 ? <EmptyState title={filter === 'ALL' ? 'Chưa có sự kiện vận hành' : 'Không có sự kiện phù hợp bộ lọc'} /> : <><div className="relative space-y-3 before:absolute before:bottom-4 before:left-5 before:top-4 before:w-px before:bg-border">{scoped.map((event) => <TimelineItem key={event.id} event={event} cameraName={cameras.find((item) => item.id === event.cameraId)?.name} slotCode={slots.find((item) => item.id === event.slotId)?.code} />)}</div>{eventsHasMore && <div className="flex justify-center"><Button variant="outline" disabled={eventsLoadingMore} onClick={() => void loadMoreEvents()}>{eventsLoadingMore && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Tải thêm sự kiện</Button></div>}</>}
  </div>
}

function TimelineItem({ event, cameraName, slotCode }: { event: DashboardEvent; cameraName?: string; slotCode?: string }) {
  const meta = EVENT_META[event.type] || { label: event.type.replaceAll('_', ' '), icon: Camera, tone: 'bg-muted text-foreground' }
  const Icon = meta.icon
  return <Card className="relative ml-10"><div className={`absolute -left-[2.15rem] top-5 z-10 flex h-7 w-7 items-center justify-center rounded-full ring-4 ring-background ${meta.tone}`}><Icon className="h-4 w-4" /></div><CardContent className="space-y-3 p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div className="flex items-center gap-2"><span className="font-medium">{meta.label}</span>{event.plate && <Badge variant="outline" className="font-mono">{event.plate}</Badge>}</div><time className="text-xs text-muted-foreground" dateTime={event.occurredAt}>{new Date(event.occurredAt).toLocaleString('vi-VN')}</time></div><div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">{cameraName && <span className="flex items-center gap-1"><Camera className="h-4 w-4" />{cameraName}</span>}{slotCode && <span className="flex items-center gap-1"><MapPin className="h-4 w-4" />Ô {slotCode}</span>}{event.cameraId && !cameraName && <span>Camera {event.cameraId.slice(0, 8)}</span>}{event.slotId && !slotCode && <span>Slot {event.slotId.slice(0, 8)}</span>}</div>{event.snapshotUrl && <a href={event.snapshotUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">Xem snapshot <ExternalLink className="h-3.5 w-3.5" /></a>}</CardContent></Card>
}

function EmptyState({ title }: { title: string }) {
  return <div className="flex min-h-72 flex-col items-center justify-center gap-3 rounded-xl border border-dashed p-8 text-center"><div className="rounded-full bg-muted p-4"><ScanLine className="h-8 w-8 text-muted-foreground" /></div><div><h2 className="font-medium">{title}</h2><p className="mt-1 text-sm text-muted-foreground">Sự kiện mới sẽ xuất hiện tự động khi hệ thống nhận được.</p></div></div>
}
