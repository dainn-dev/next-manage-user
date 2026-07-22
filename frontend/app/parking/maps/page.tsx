"use client"

import * as React from "react"
import { AlertCircle, Car, CircleParking, RefreshCw, SquareParking, Activity, Building2, Loader2 } from "lucide-react"

import { ParkingMap } from "@/components/dashboard/parking-map"
import { DashboardMetricsSection } from "@/components/dashboard/dashboard-metrics-section"
import { AdminEmptyState, AdminPage, AdminPageHeader } from "@/components/layout/admin-page"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { useDashboardData } from "@/lib/dashboard-data-context"
import { useDashboardScope } from "@/lib/dashboard-scope-context"
import { parkingFloorApi, type ParkingFloor } from "@/lib/api/parking-floor-api"

export default function ParkingMapPage() {
  const { slots, status, error, refresh, realtime, lastUpdatedAt } = useDashboardData()
  const { selectedSiteId, selectedZoneId, zones, selectZone } = useDashboardScope()
  const [currentTime, setCurrentTime] = React.useState<string>("")
  const [floors, setFloors] = React.useState<ParkingFloor[]>([])
  const [selectedFloorId, setSelectedFloorId] = React.useState<string | null>(null)
  const [floorsLoading, setFloorsLoading] = React.useState(false)

  React.useEffect(() => {
    setCurrentTime(new Date().toLocaleTimeString("vi-VN"))
    const interval = window.setInterval(() => setCurrentTime(new Date().toLocaleTimeString("vi-VN")), 1000)
    return () => window.clearInterval(interval)
  }, [])

  React.useEffect(() => {
    if (!selectedSiteId) {
      setFloors([])
      setSelectedFloorId(null)
      return
    }
    let cancelled = false
    setFloorsLoading(true)
    parkingFloorApi.list(selectedSiteId).then((items) => {
      if (cancelled) return
      setFloors(items)
      const selectedZoneFloor = items.find((floor) => zones.some((zone) => zone.id === selectedZoneId && zone.floorId === floor.id))
      setSelectedFloorId((current) => selectedZoneFloor?.id || (items.some((floor) => floor.id === current) ? current : items[0]?.id || null))
    }).catch(() => {
      if (!cancelled) {
        setFloors([])
        setSelectedFloorId(null)
      }
    }).finally(() => {
      if (!cancelled) setFloorsLoading(false)
    })
    return () => { cancelled = true }
  }, [selectedSiteId, selectedZoneId, zones])

  const floorZoneIds = React.useMemo(() => new Set(
    zones.filter((zone) => !selectedFloorId || zone.floorId === selectedFloorId).map((zone) => zone.id),
  ), [zones, selectedFloorId])
  const visibleSlots = React.useMemo(
    () => selectedFloorId ? slots.filter((slot) => floorZoneIds.has(slot.zoneId)) : slots,
    [slots, selectedFloorId, floorZoneIds],
  )
  const selectedFloor = floors.find((floor) => floor.id === selectedFloorId) || null

  const occupied = visibleSlots.filter((slot) => slot.status === "OCCUPIED").length
  const available = visibleSlots.filter((slot) => slot.status === "AVAILABLE").length
  const loading = status === "loading" || status === "idle"
  const scopeLabel = selectedFloor ? `tầng ${selectedFloor.name}` : selectedZoneId ? "khu vực đang chọn" : "site đang chọn"
  const metrics = [
    {
      label: "Tổng số ô",
      value: visibleSlots.length.toLocaleString("vi-VN"),
      note: `Trong ${scopeLabel}`,
      icon: SquareParking,
      tone: "primary",
    },
    {
      label: "Còn trống",
      value: available.toLocaleString("vi-VN"),
      note: "Sẵn sàng tiếp nhận xe",
      icon: CircleParking,
      tone: "success",
    },
    {
      label: "Đang có xe",
      value: occupied.toLocaleString("vi-VN"),
      note: "Ô đỗ đang được sử dụng",
      icon: Car,
      tone: "critical",
    },
  ] as const

  return (
    <AdminPage className="space-y-5">
      <AdminPageHeader
        eyebrow="Vận hành bãi xe"
        title="Sơ đồ bãi xe"
        description={`Theo dõi trực quan trạng thái từng ô đỗ theo ${scopeLabel}; dữ liệu thay đổi được cập nhật liên tục.`}
        actions={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <div className="flex min-h-11 items-center justify-between gap-3 rounded-2xl border border-border bg-card px-3 text-sm shadow-sm sm:min-w-36">
              <span className="text-muted-foreground">Giờ hệ thống</span>
              <span className="font-semibold tabular-nums text-foreground">{currentTime || "00:00:00"}</span>
            </div>
            <Button variant="outline" onClick={() => void refresh()} disabled={loading} className="min-h-11 rounded-2xl border-border bg-card px-4 text-foreground hover:bg-muted">
              <RefreshCw className={`mr-2 size-4 ${loading ? "animate-spin text-primary" : ""}`} /> Làm mới
            </Button>
          </div>
        }
      />

      <DashboardMetricsSection
        id="parking-map-metrics-title"
        title="Thông số ô đỗ"
        description={`Tổng quan sức chứa và trạng thái sử dụng của ${scopeLabel}.`}
        badge={(
          <Badge
            variant="outline"
            className={realtime === "live"
              ? "gap-1.5 border-[var(--color-success)]/25 bg-[var(--color-success-surface)] text-[var(--color-success)]"
              : "gap-1.5 border-[var(--color-warning)]/25 bg-[var(--color-warning-surface)] text-[var(--color-serious)]"}
          >
            <Activity className={`size-3 ${realtime === "live" ? "animate-pulse" : ""}`} aria-hidden="true" />
            {realtime === "live" ? "Đang nhận realtime" : "Đồng bộ định kỳ"}
          </Badge>
        )}
        loading={loading && slots.length === 0}
        metricGridClassName="sm:grid-cols-3"
        metrics={metrics}
      />

      {selectedSiteId && (floorsLoading || floors.length > 0) && (
        <Card className="border-border bg-card shadow-sm">
          <CardContent className="p-3 sm:p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Chọn tầng bãi đỗ</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Mỗi tầng sử dụng một mặt bằng và bố trí zone độc lập.</p>
              </div>
              <Building2 className="size-5 shrink-0 text-primary" aria-hidden="true" />
            </div>
            {floorsLoading ? (
              <div className="flex h-12 items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Đang tải danh sách tầng</div>
            ) : (
              <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Các tầng bãi đỗ">
                {floors.map((floor) => {
                  const zoneIds = new Set(zones.filter((zone) => zone.floorId === floor.id).map((zone) => zone.id))
                  const floorSlots = slots.filter((slot) => zoneIds.has(slot.zoneId))
                  const free = floorSlots.filter((slot) => slot.status === "AVAILABLE").length
                  const active = floor.id === selectedFloorId
                  return (
                    <button
                      key={floor.id}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => {
                        selectZone(null)
                        setSelectedFloorId(floor.id)
                      }}
                      className={`min-w-36 rounded-xl border px-4 py-3 text-left transition-colors ${active ? "border-primary bg-primary/10 text-foreground shadow-xs" : "border-border bg-background text-muted-foreground hover:bg-muted"}`}
                    >
                      <span className="block text-sm font-semibold">{floor.name}</span>
                      <span className="mt-1 block text-xs">{free}/{floorSlots.length} chỗ trống</span>
                    </button>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {realtime !== "live" && (
        <Card className="border-primary/20 bg-primary/5 shadow-none">
          <CardContent className="flex flex-col gap-2 p-4 text-sm text-foreground sm:flex-row sm:items-center">
            <div className="flex items-start gap-2"><Activity className="mt-0.5 size-4 shrink-0 text-primary" /><span>Đang đồng bộ định kỳ trạng thái sơ đồ từ Gateway.</span></div>
            {lastUpdatedAt && <Badge variant="secondary" className="w-fit sm:ml-auto">Cập nhật {new Date(lastUpdatedAt).toLocaleTimeString("vi-VN")}</Badge>}
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="border-rose-200 bg-rose-50 shadow-none"><CardContent className="flex items-start gap-2 p-4 text-sm text-rose-800"><AlertCircle className="mt-0.5 size-4 shrink-0" /><div><p className="font-medium">Không thể tải sơ đồ</p><p className="mt-1 text-rose-700">{error}</p></div></CardContent></Card>
      )}

      {!selectedSiteId ? (
        <AdminEmptyState icon={<SquareParking className="size-6 text-muted-foreground" />} title="Chưa chọn site" description="Chọn một site ở bộ điều phối phía trên để xem sơ đồ và trạng thái từng ô đỗ." />
      ) : loading ? (
        <Card className="border-dashed border-border bg-card shadow-none"><CardContent className="flex min-h-80 flex-col items-center justify-center gap-3 p-8 text-center text-sm text-muted-foreground"><Loader2 className="size-7 animate-spin text-primary" /><span>Đang tải cấu trúc sơ đồ bãi xe</span></CardContent></Card>
      ) : visibleSlots.length === 0 ? (
        <AdminEmptyState icon={<SquareParking className="size-6 text-muted-foreground" />} title={selectedFloor ? `${selectedFloor.name} chưa có dữ liệu ô đỗ` : "Sơ đồ chưa có dữ liệu ô đỗ"} description="Hãy gán zone vào tầng và xuất bản bản đồ từ Map Designer để hiển thị trạng thái tại đây." />
      ) : (
        <ParkingMap slots={visibleSlots} layoutScopeId={selectedFloorId} />
      )}
    </AdminPage>
  )
}
