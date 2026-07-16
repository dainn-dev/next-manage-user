"use client"

import * as React from "react"
import {
  AlertCircle,
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpFromLine,
  Camera,
  ExternalLink,
  Loader2,
  MapPin,
  RefreshCw,
  ScanLine,
  WifiOff,
  type LucideIcon,
} from "lucide-react"

import { AdminEmptyState, AdminPage, AdminPageHeader, AdminToolbar } from "@/components/layout/admin-page"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { DashboardEvent } from "@/lib/api/dashboard-api"
import { useDashboardData } from "@/lib/dashboard-data-context"
import { useDashboardScope } from "@/lib/dashboard-scope-context"

const FILTERS = ["ALL", "VEHICLE_ENTERED", "VEHICLE_RELOCATED", "VEHICLE_EXITED", "MOTION_DETECTED"] as const

const EVENT_META: Record<string, { label: string; icon: LucideIcon; tone: string }> = {
  VEHICLE_ENTERED: {
    label: "Xe vào bãi",
    icon: ArrowDownToLine,
    tone: "bg-[var(--color-success-surface)] text-[var(--color-success)]",
  },
  VEHICLE_RELOCATED: {
    label: "Xe được di chuyển",
    icon: ArrowLeftRight,
    tone: "bg-[var(--color-warning-surface)] text-[var(--color-serious)]",
  },
  VEHICLE_EXITED: {
    label: "Xe rời bãi",
    icon: ArrowUpFromLine,
    tone: "bg-primary/10 text-primary",
  },
  MOTION_DETECTED: {
    label: "Phát hiện chuyển động",
    icon: ScanLine,
    tone: "bg-[var(--color-serious-surface)] text-[var(--color-serious)]",
  },
}

export default function EventsPage() {
  const [filter, setFilter] = React.useState<(typeof FILTERS)[number]>("ALL")
  const {
    cameras,
    error,
    events,
    eventsHasMore,
    eventsLoadingMore,
    lastUpdatedAt,
    loadMoreEvents,
    realtime,
    realtimeError,
    refresh,
    setEventFilter,
    slots,
    status,
  } = useDashboardData()
  const { selectedSiteId, selectedZoneId } = useDashboardScope()

  React.useEffect(() => {
    setEventFilter(filter)
    return () => setEventFilter("ALL")
  }, [filter, setEventFilter])

  const scoped = React.useMemo(
    () =>
      events.filter((event) => {
        if (event.siteId !== selectedSiteId) return false
        if (selectedZoneId && event.zoneId && event.zoneId !== selectedZoneId) return false
        if (selectedZoneId && !event.zoneId) {
          const camera = cameras.find((item) => item.id === event.cameraId)
          const slot = slots.find((item) => item.id === event.slotId)
          if (camera?.zoneId !== selectedZoneId && slot?.zoneId !== selectedZoneId) return false
        }
        return true
      }),
    [events, selectedSiteId, selectedZoneId, cameras, slots],
  )

  const loading = status === "loading" || status === "idle"

  return (
    <AdminPage>
      <AdminPageHeader
        eyebrow="Vận hành"
        title="Dòng sự kiện vận hành"
        description="Sự kiện mới nhất trong site và zone đang chọn, ưu tiên biển số, camera, ô đỗ và thời điểm."
      />

      <AdminToolbar>
        <div className="grid min-w-0 flex-1 gap-1">
          <label className="text-sm font-medium text-foreground" htmlFor="event-filter-trigger">
            Loại sự kiện
          </label>
          <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
            <Select value={filter} onValueChange={(value) => setFilter(value as typeof filter)}>
              <SelectTrigger id="event-filter-trigger" className="h-10 min-h-10 w-full sm:h-11 sm:min-h-11 sm:w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FILTERS.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type === "ALL" ? "Tất cả sự kiện" : EVENT_META[type]?.label || type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              className="!h-10 !min-h-10 !w-auto shrink-0 px-3 text-xs sm:!h-11 sm:!min-h-11 sm:px-4 sm:text-sm"
              variant="outline"
              onClick={() => void refresh()}
              disabled={loading}
            >
              <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
              Làm mới
            </Button>
          </div>
        </div>
      </AdminToolbar>

      {realtime !== "live" && (
        <div className="flex flex-col gap-2 rounded-xl border border-[var(--color-warning)] bg-[var(--color-warning-surface)] p-3 text-sm text-[var(--color-serious)] sm:flex-row sm:items-center">
          <div className="flex min-w-0 items-start gap-2">
            <WifiOff className="mt-0.5 size-4 shrink-0" />
            <span className="min-w-0">{realtimeError || "Realtime chưa kết nối; timeline đang dùng polling fallback."}</span>
          </div>
          {lastUpdatedAt && (
            <span className="shrink-0 text-xs text-muted-foreground sm:ml-auto">
              Cập nhật {new Date(lastUpdatedAt).toLocaleTimeString("vi-VN")}
            </span>
          )}
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span className="min-w-0">{error}</span>
        </div>
      )}

      {!selectedSiteId ? (
        <EmptyState title="Chưa có site để hiển thị" />
      ) : loading ? (
        <div className="flex min-h-72 items-center justify-center rounded-xl border border-dashed bg-card/70">
          <Loader2 className="size-7 animate-spin text-primary" />
        </div>
      ) : scoped.length === 0 ? (
        <EmptyState title={filter === "ALL" ? "Chưa có sự kiện vận hành" : "Không có sự kiện phù hợp bộ lọc"} />
      ) : (
        <section className="space-y-4" aria-label="Timeline sự kiện">
          <div className="relative space-y-3 pl-8 before:absolute before:bottom-4 before:left-3 before:top-4 before:w-px before:bg-border sm:pl-10 sm:before:left-5">
            {scoped.map((event) => (
              <TimelineItem
                key={event.id}
                event={event}
                cameraName={cameras.find((item) => item.id === event.cameraId)?.name}
                slotCode={slots.find((item) => item.id === event.slotId)?.code}
              />
            ))}
          </div>
          {eventsHasMore && (
            <div className="grid sm:flex sm:justify-center">
              <Button className="w-full sm:w-auto" variant="outline" disabled={eventsLoadingMore} onClick={() => void loadMoreEvents()}>
                {eventsLoadingMore && <Loader2 className="size-4 animate-spin" />}
                Tải thêm sự kiện
              </Button>
            </div>
          )}
        </section>
      )}
    </AdminPage>
  )
}

function TimelineItem({
  cameraName,
  event,
  slotCode,
}: {
  event: DashboardEvent
  cameraName?: string
  slotCode?: string
}) {
  const meta = EVENT_META[event.type] || {
    label: event.type.replaceAll("_", " "),
    icon: Camera,
    tone: "bg-muted text-foreground",
  }
  const Icon = meta.icon

  return (
    <Card className="relative overflow-visible py-0">
      <div
        className={`absolute -left-[2.15rem] top-4 z-10 flex size-8 items-center justify-center rounded-full ring-4 ring-background sm:-left-[2.35rem] ${meta.tone}`}
        aria-hidden="true"
      >
        <Icon className="size-4" />
      </div>
      <CardContent className="space-y-3 p-4 sm:p-5">
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="font-medium text-foreground">{meta.label}</span>
            {event.plate && (
              <Badge variant="outline" className="max-w-full truncate font-[family:var(--font-outlier)] tabular-nums">
                {event.plate}
              </Badge>
            )}
          </div>
          <time className="shrink-0 text-sm text-muted-foreground sm:text-xs" dateTime={event.occurredAt}>
            {new Date(event.occurredAt).toLocaleString("vi-VN")}
          </time>
        </div>
        <div className="flex min-w-0 flex-col gap-2 text-sm text-muted-foreground sm:flex-row sm:flex-wrap sm:gap-x-5">
          {cameraName && (
            <span className="flex min-w-0 items-center gap-1">
              <Camera className="size-4 shrink-0" />
              <span className="truncate">{cameraName}</span>
            </span>
          )}
          {slotCode && (
            <span className="flex min-w-0 items-center gap-1">
              <MapPin className="size-4 shrink-0" />
              <span className="truncate">Ô {slotCode}</span>
            </span>
          )}
          {event.cameraId && !cameraName && <span className="break-all">Camera {event.cameraId.slice(0, 8)}</span>}
          {event.slotId && !slotCode && <span className="break-all">Slot {event.slotId.slice(0, 8)}</span>}
        </div>
        {event.snapshotUrl && (
          <a
            href={event.snapshotUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            Xem snapshot
            <ExternalLink className="size-3.5" />
          </a>
        )}
      </CardContent>
    </Card>
  )
}

function EmptyState({ title }: { title: string }) {
  return (
    <AdminEmptyState
      icon={<ScanLine className="size-6" />}
      title={title}
      description="Sự kiện mới sẽ xuất hiện tự động khi hệ thống nhận được dữ liệu từ camera hoặc cổng."
    />
  )
}
