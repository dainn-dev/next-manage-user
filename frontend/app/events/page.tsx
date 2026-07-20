"use client"

import * as React from "react"
import {
  Activity,
  AlertCircle,
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpFromLine,
  Camera,
  ExternalLink,
  Eye,
  Filter,
  Loader2,
  MapPin,
  Radio,
  RefreshCw,
  ScanLine,
  Wifi,
  WifiOff,
  type LucideIcon,
} from "lucide-react"

import { DashboardMetricsSection } from "@/components/dashboard/dashboard-metrics-section"
import { AdminEmptyState, AdminPage, AdminPageHeader } from "@/components/layout/admin-page"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { DashboardEvent } from "@/lib/api/dashboard-api"
import { useDashboardData } from "@/lib/dashboard-data-context"
import { useDashboardScope } from "@/lib/dashboard-scope-context"

const FILTERS = ["ALL", "VEHICLE_ENTERED", "VEHICLE_RELOCATED", "VEHICLE_EXITED", "MOTION_DETECTED"] as const

const EVENT_META: Record<string, { label: string; icon: LucideIcon; tone: string }> = {
  VEHICLE_ENTERED: {
    label: "Xe vào bãi",
    icon: ArrowDownToLine,
    tone: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  VEHICLE_RELOCATED: {
    label: "Di chuyển ô đỗ",
    icon: ArrowLeftRight,
    tone: "border-sky-200 bg-sky-50 text-sky-700",
  },
  VEHICLE_EXITED: {
    label: "Xe rời bãi",
    icon: ArrowUpFromLine,
    tone: "border-rose-200 bg-rose-50 text-rose-700",
  },
  MOTION_DETECTED: {
    label: "Phát hiện chuyển động",
    icon: ScanLine,
    tone: "border-amber-200 bg-amber-50 text-amber-700",
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
  const [currentTime, setCurrentTime] = React.useState<string>("")

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      setCurrentTime(new Date().toLocaleTimeString("vi-VN"))
      const interval = setInterval(() => {
        setCurrentTime(new Date().toLocaleTimeString("vi-VN"))
      }, 1000)
      return () => clearInterval(interval)
    }
  }, [])

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
  const eventOverviewMetrics = [
    {
      label: "Sự kiện trong khu vực",
      value: scoped.length.toLocaleString("vi-VN"),
      note: "Theo bộ lọc hiện tại",
      icon: Radio,
      tone: "primary",
    },
    {
      label: "Cập nhật dữ liệu",
      value: realtime === "live" ? "Trực tiếp" : "Tự động",
      note: realtime === "live" ? "Đang nhận sự kiện mới" : "Đang đồng bộ định kỳ",
      icon: realtime === "live" ? Wifi : Activity,
      tone: realtime === "live" ? "success" : "warning",
    },
    {
      label: "Vị trí đang xem",
      value: selectedSiteId ? "Đã chọn site" : "Chưa chọn site",
      note: selectedZoneId ? "Đã giới hạn theo khu vực" : "Tất cả khu vực trong site",
      icon: MapPin,
      tone: "serious",
    },
  ] as const

  return (
    <AdminPage className="min-h-dvh space-y-5">
      <AdminPageHeader
        eyebrow="Vận hành bãi xe"
        title="Dòng sự kiện"
        description="Theo dõi các hoạt động mới nhất từ phương tiện, camera giám sát và ô đỗ trong khu vực đang chọn."
        actionList={[
          {
            key: "current-time",
            content: <div className="flex items-center gap-2 rounded-xl bg-muted px-3 py-2 text-sm text-muted-foreground">
            <span className="size-2 rounded-full bg-emerald-500" aria-hidden="true" />
            <span>Hiện tại</span>
            <time className="font-semibold tabular-nums text-foreground">{currentTime || "--:--:--"}</time>
            </div>,
          },
        ]}
      />

      <DashboardMetricsSection
        id="event-overview-title"
        title="Tổng quan sự kiện"
        description="Tóm tắt luồng sự kiện và phạm vi giám sát đang hiển thị."
        badge={(
          <Badge
            variant="outline"
            className={realtime === "live"
              ? "gap-1.5 border-[var(--color-success)]/25 bg-[var(--color-success-surface)] text-[var(--color-success)]"
              : "gap-1.5 border-[var(--color-warning)]/25 bg-[var(--color-warning-surface)] text-[var(--color-serious)]"}
          >
            {realtime === "live" ? <Wifi className="size-3" aria-hidden="true" /> : <WifiOff className="size-3" aria-hidden="true" />}
            {realtime === "live" ? "Đang nhận realtime" : "Đồng bộ tự động"}
          </Badge>
        )}
        meta={lastUpdatedAt ? (
          <time className="text-xs text-muted-foreground" dateTime={lastUpdatedAt}>
            Cập nhật {new Date(lastUpdatedAt).toLocaleTimeString("vi-VN")}
          </time>
        ) : undefined}
        loading={loading}
        metricGridClassName="sm:grid-cols-3"
        metrics={eventOverviewMetrics}
      />

      <Card className="border-border bg-card shadow-[var(--shadow-card)]">
        <CardContent className="p-4 sm:p-5">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <div className="grid min-w-0 gap-1.5">
              <label className="flex items-center gap-2 text-sm font-medium text-foreground" htmlFor="event-filter-trigger">
                <Filter className="size-4 text-primary" aria-hidden="true" />
                Loại sự kiện
              </label>
              <Select value={filter} onValueChange={(value) => setFilter(value as typeof filter)}>
                <SelectTrigger id="event-filter-trigger" className="min-h-11 w-full bg-background text-sm">
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
            </div>
            <Button
              className="min-h-11 w-full sm:w-auto"
              variant="outline"
              onClick={() => void refresh()}
              disabled={loading}
            >
              <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
              Làm mới
            </Button>
          </div>
        </CardContent>
      </Card>

      {realtime !== "live" && (
        <div className="flex flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900 sm:flex-row sm:items-center">
          <div className="flex min-w-0 items-start gap-2">
            <WifiOff className="mt-0.5 size-4 shrink-0 text-amber-700" />
            <span>{realtimeError || "Kết nối trực tiếp tạm thời không khả dụng. Dòng sự kiện vẫn được đồng bộ tự động."}</span>
          </div>
          {lastUpdatedAt && (
            <time className="shrink-0 text-xs text-amber-800 sm:ml-auto" dateTime={lastUpdatedAt}>
              Cập nhật lúc {new Date(lastUpdatedAt).toLocaleTimeString("vi-VN")}
            </time>
          )}
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm leading-6 text-rose-800" role="alert">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {!selectedSiteId ? (
        <EmptyState title="Chưa chọn site để hiển thị sự kiện" />
      ) : loading ? (
        <AdminEmptyState
          className="min-h-[18rem] rounded-[var(--radius-sheet)] bg-card"
          icon={<Loader2 className="size-5 animate-spin" />}
          title="Đang tải sự kiện"
          description="Hệ thống đang đồng bộ hoạt động mới nhất trong khu vực của bạn."
        />
      ) : scoped.length === 0 ? (
        <EmptyState title={filter === "ALL" ? "Chưa có sự kiện vận hành" : "Không có sự kiện phù hợp"} />
      ) : (
        <section className="space-y-4" aria-label="Dòng thời gian sự kiện">
          <div className="relative space-y-3 border-l border-border pl-5 sm:pl-7">
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
            <div className="grid pt-1 sm:justify-items-center">
              <Button
                className="min-h-11 w-full sm:w-auto"
                variant="outline"
                disabled={eventsLoadingMore}
                onClick={() => void loadMoreEvents()}
              >
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
    tone: "border-slate-200 bg-slate-50 text-slate-700",
  }
  const Icon = meta.icon

  return (
    <Card className="relative overflow-visible border-border bg-card shadow-none transition-shadow hover:shadow-[var(--shadow-card)]">
      <span
        className={`absolute -left-[2.45rem] top-5 grid size-8 place-items-center rounded-full border ring-4 ring-background sm:-left-[3rem] ${meta.tone}`}
        aria-hidden="true"
      >
        <Icon className="size-4" />
      </span>
      <CardContent className="space-y-4 p-4 sm:p-5">
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold text-foreground">{meta.label}</h2>
            {event.plate && (
              <Badge variant="outline" className="max-w-full truncate border-primary/20 bg-primary/5 px-2 py-0.5 font-semibold text-primary">
                {event.plate}
              </Badge>
            )}
          </div>
          <time className="shrink-0 text-sm text-muted-foreground" dateTime={event.occurredAt}>
            {new Date(event.occurredAt).toLocaleString("vi-VN")}
          </time>
        </div>

        <div className="flex min-w-0 flex-col gap-2 text-sm text-muted-foreground sm:flex-row sm:flex-wrap sm:gap-x-5">
          {cameraName && (
            <span className="flex min-w-0 items-center gap-1.5">
              <Camera className="size-4 shrink-0 text-primary" />
              <span className="truncate">{cameraName}</span>
            </span>
          )}
          {slotCode && (
            <span className="flex min-w-0 items-center gap-1.5">
              <MapPin className="size-4 shrink-0 text-primary" />
              <span className="truncate">Ô {slotCode}</span>
            </span>
          )}
          {event.cameraId && !cameraName && <span className="break-all">Camera: {event.cameraId.slice(0, 8).toUpperCase()}</span>}
          {event.slotId && !slotCode && <span className="break-all">Ô đỗ: {event.slotId.slice(0, 8).toUpperCase()}</span>}
        </div>

        {event.snapshotUrl && (
          <div className="border-t border-border pt-3">
            <a
              href={event.snapshotUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Eye className="size-4 text-primary" />
              Xem ảnh chụp
              <ExternalLink className="size-3.5 text-muted-foreground" />
            </a>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function EmptyState({ title }: { title: string }) {
  return (
    <AdminEmptyState
      className="min-h-[18rem] rounded-[var(--radius-sheet)] bg-card"
      icon={<ScanLine className="size-6" />}
      title={title}
      description="Sự kiện mới sẽ xuất hiện tự động khi hệ thống nhận dữ liệu từ camera hoặc cảm biến cổng."
    />
  )
}
