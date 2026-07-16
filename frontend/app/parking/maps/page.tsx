"use client"

import { AlertCircle, Car, CircleParking, RefreshCw, SquareParking } from "lucide-react"

import { ParkingMap } from "@/components/dashboard/parking-map"
import { AdminEmptyState, AdminPage } from "@/components/layout/admin-page"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { useDashboardData } from "@/lib/dashboard-data-context"
import { useDashboardScope } from "@/lib/dashboard-scope-context"
import { cn } from "@/lib/utils"

export default function ParkingMapPage() {
  const { slots, status, error, refresh, realtime } = useDashboardData()
  const { selectedSiteId, selectedZoneId } = useDashboardScope()
  const occupied = slots.filter((slot) => slot.status === "OCCUPIED").length
  const available = slots.filter((slot) => slot.status === "AVAILABLE").length
  const scopeLabel = selectedZoneId ? "zone đang chọn" : "site đang chọn"
  const realtimeLabel = realtime === "live" ? "Realtime" : "Đồng bộ định kỳ"

  return (
    <AdminPage className="min-h-dvh">
      <header className="relative rounded-2xl border border-border/75 bg-card/90 p-3 pr-14 shadow-[var(--shadow-card)] sm:grid sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start sm:gap-4 sm:p-5">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase leading-5 tracking-[0.12em] text-primary">
            Bãi đỗ xe
          </p>
          <h1 className="mt-1 font-[family:var(--font-display)] text-[1.125rem] font-bold leading-[1.14] tracking-[-0.025em] text-foreground sm:text-[1.75rem] sm:leading-[1.12] sm:tracking-[-0.035em]">
            Sơ đồ bãi xe
          </h1>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs leading-5 text-muted-foreground sm:mt-2 sm:text-[0.9375rem] sm:leading-6">
            <span>Theo dõi ô đỗ theo {scopeLabel}</span>
            <span className="hidden sm:inline">·</span>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-primary sm:text-xs">
              {realtimeLabel}
            </span>
          </p>
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={() => void refresh()}
          disabled={status === "loading"}
          className="absolute right-3 top-3 !h-9 !min-h-9 !w-9 shrink-0 rounded-xl border-border/70 bg-background/80 !p-0 shadow-none hover:border-primary/40 hover:bg-primary/5 sm:static sm:!h-10 sm:!min-h-10 sm:!w-auto sm:!px-3"
          aria-label="Làm mới sơ đồ bãi xe"
          title="Làm mới"
        >
          <RefreshCw className={cn("h-4 w-4", status === "loading" && "animate-spin")} />
          <span className="sr-only sm:not-sr-only sm:ml-2">Làm mới</span>
        </Button>
      </header>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm leading-5 text-amber-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <ParkingStats total={slots.length} available={available} occupied={occupied} />

      {!selectedSiteId ? (
        <EmptySite />
      ) : status === "loading" || status === "idle" ? (
        <div className="min-h-[18rem] rounded-2xl border border-border/70 bg-card/70 p-4 shadow-[var(--shadow-card)]">
          <div className="h-full min-h-[16rem] animate-pulse rounded-xl bg-muted/70" />
        </div>
      ) : slots.length === 0 ? (
        <EmptySite
          title="Site hoặc zone chưa có ô đỗ"
          description="Publish bản đồ từ Map Designer để hiển thị trạng thái từng ô đỗ tại đây."
        />
      ) : (
        <ParkingMap slots={slots} />
      )}
    </AdminPage>
  )
}

function ParkingStats({
  total,
  available,
  occupied,
}: {
  total: number
  available: number
  occupied: number
}) {
  return (
    <Card className="overflow-hidden rounded-2xl border-border/75 bg-card/90 shadow-[var(--shadow-card)]">
      <CardContent className="grid grid-cols-3 p-0">
        <StatItem
          label="Tổng ô"
          desktopLabel="Tổng số ô"
          value={total}
          icon={SquareParking}
          tone="text-primary"
        />
        <StatItem
          label="Trống"
          desktopLabel="Còn trống"
          value={available}
          icon={CircleParking}
          tone="text-green-600"
          separated
        />
        <StatItem
          label="Có xe"
          desktopLabel="Đang có xe"
          value={occupied}
          icon={Car}
          tone="text-red-600"
          separated
        />
      </CardContent>
    </Card>
  )
}

function StatItem({
  label,
  desktopLabel,
  value,
  icon: Icon,
  tone,
  separated = false,
}: {
  label: string
  desktopLabel: string
  value: number
  icon: typeof Car
  tone: string
  separated?: boolean
}) {
  return (
    <div className={cn("min-w-0 px-3 py-3 sm:px-4 sm:py-4", separated && "border-l border-border/70")}>
      <div className="flex items-center justify-between gap-1.5">
        <p className="min-w-0 truncate text-[0.68rem] font-semibold uppercase leading-4 tracking-[0.08em] text-muted-foreground sm:text-xs">
          <span className="sm:hidden">{label}</span>
          <span className="hidden sm:inline">{desktopLabel}</span>
        </p>
        <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-muted/70 sm:size-9 sm:rounded-xl">
          <Icon className={cn("h-4 w-4 sm:h-5 sm:w-5", tone)} />
        </span>
      </div>
      <p className="mt-2 font-[family:var(--font-display)] text-[1.65rem] font-bold leading-none tracking-[-0.045em] text-foreground sm:text-3xl">
        {value}
      </p>
    </div>
  )
}

function EmptySite({
  title = "Chưa có site để hiển thị",
  description = "Chọn site ở thanh trên để xem sơ đồ bãi xe và trạng thái từng ô đỗ.",
}: {
  title?: string
  description?: string
}) {
  return (
    <AdminEmptyState
      className="min-h-[18rem] rounded-2xl bg-card/70"
      icon={<SquareParking className="h-6 w-6" />}
      title={title}
      description={description}
    />
  )
}
