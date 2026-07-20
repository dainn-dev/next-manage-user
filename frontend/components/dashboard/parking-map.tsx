"use client"

import * as React from "react"
import { Car, Clock, MapPin } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { DashboardSlot, OccupancyStatus } from "@/lib/api/dashboard-api"

const COLORS: Record<OccupancyStatus, string> = {
  AVAILABLE: "var(--color-success)",
  OCCUPIED: "var(--color-critical)",
  RESERVED: "var(--color-serious)",
  DISABLED: "var(--color-muted)",
  UNKNOWN: "var(--color-signal)",
}

const STATUS_LABELS: Record<OccupancyStatus, string> = {
  AVAILABLE: "Trống",
  OCCUPIED: "Đã có xe",
  RESERVED: "Đã giữ chỗ",
  DISABLED: "Không sử dụng",
  UNKNOWN: "Chưa rõ",
}

function viewBox(slots: DashboardSlot[]): string {
  const points = slots.flatMap((slot) => slot.polygon)
  if (!points.length) return "0 0 100 100"
  const xs = points.map((point) => point.x)
  const ys = points.map((point) => point.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const width = Math.max(maxX - minX, 1)
  const height = Math.max(maxY - minY, 1)
  const padding = Math.max(width, height) * 0.06
  return `${minX - padding} ${minY - padding} ${width + padding * 2} ${height + padding * 2}`
}

export function ParkingMap({ slots }: { slots: DashboardSlot[] }) {
  const drawable = React.useMemo(() => slots.filter((slot) => slot.polygon.length >= 3), [slots])
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const selected = slots.find((slot) => slot.id === selectedId) || null

  React.useEffect(() => {
    if (selectedId && !slots.some((slot) => slot.id === selectedId)) setSelectedId(null)
  }, [slots, selectedId])

  if (!drawable.length) {
    return (
      <div className="flex min-h-[22rem] flex-col items-center justify-center gap-3 rounded-[var(--radius-card)] border border-dashed border-border p-8 text-center">
        <MapPin className="size-10 text-muted-foreground" />
        <div>
          <h2 className="font-semibold">Chưa có dữ liệu bản đồ</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">Các ô đỗ chưa có polygon được xuất bản từ Map Designer.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="grid gap-3 bg-muted/45 p-3 sm:p-4">
            <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground" aria-label="Chú giải trạng thái ô đỗ">
              {(Object.keys(COLORS) as OccupancyStatus[]).map((status) => (
                <span key={status} className="inline-flex items-center gap-1.5">
                  <span className="size-2.5 rounded-full" style={{ backgroundColor: COLORS[status] }} aria-hidden="true" />
                  {STATUS_LABELS[status]}
                </span>
              ))}
            </div>
            <div className="min-h-[20rem] rounded-[var(--radius-input)] border border-border bg-card p-2 sm:min-h-[28rem] sm:p-4">
              <svg
                viewBox={viewBox(drawable)}
                className="h-full min-h-[18rem] w-full sm:min-h-[25rem]"
                role="img"
                aria-label="Sơ đồ trạng thái ô đỗ xe. Chọn một ô để xem chi tiết."
                preserveAspectRatio="xMidYMid meet"
              >
                {drawable.map((slot) => (
                  <polygon
                    key={slot.id}
                    points={slot.polygon.map((point) => `${point.x},${point.y}`).join(" ")}
                    fill={COLORS[slot.status]}
                    fillOpacity={selectedId === slot.id ? 0.96 : 0.72}
                    stroke={selectedId === slot.id ? "var(--color-focus)" : "var(--color-surface-raised)"}
                    strokeWidth={selectedId === slot.id ? 0.22 : 0.1}
                    vectorEffect="non-scaling-stroke"
                    className="cursor-pointer transition-opacity hover:opacity-100 focus:outline-none"
                    tabIndex={0}
                    role="button"
                    aria-label={`Ô ${slot.code}: ${STATUS_LABELS[slot.status]}`}
                    onClick={() => setSelectedId(slot.id)}
                    onFocus={() => setSelectedId(slot.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault()
                        setSelectedId(slot.id)
                      }
                    }}
                  >
                    <title>{`${slot.code} · ${STATUS_LABELS[slot.status]}${slot.plate ? ` · ${slot.plate}` : ""}`}</title>
                  </polygon>
                ))}
              </svg>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="h-fit">
        <CardHeader><CardTitle className="text-base">Chi tiết ô đỗ</CardTitle></CardHeader>
        <CardContent>
          {selected ? <SlotDetail slot={selected} /> : <p className="text-sm leading-6 text-muted-foreground">Chọn hoặc dùng phím Enter trên một ô để xem chi tiết.</p>}
        </CardContent>
      </Card>
    </div>
  )
}

function SlotDetail({ slot }: { slot: DashboardSlot }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xl font-semibold">{slot.code}</span>
        <Badge style={{ backgroundColor: COLORS[slot.status] }}>{STATUS_LABELS[slot.status]}</Badge>
      </div>
      <div className="space-y-3 text-sm">
        <div className="flex items-center gap-2"><Car className="size-4 text-muted-foreground" /><span>{slot.plate || "Chưa có phương tiện"}</span></div>
        <div className="flex items-center gap-2"><Clock className="size-4 text-muted-foreground" /><span>{slot.lastSeenAt ? new Date(slot.lastSeenAt).toLocaleString("vi-VN") : "Chưa có cập nhật occupancy"}</span></div>
        <p className="text-xs leading-5 text-muted-foreground">{slot.polygon.length} đỉnh · dữ liệu Map Designer</p>
      </div>
    </div>
  )
}
