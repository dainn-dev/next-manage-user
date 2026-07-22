"use client"

import * as React from "react"
import { Car, Check, Clock, Maximize2, MapPin, Move, RotateCcw, RotateCw, Save, Undo2, ZoomIn, ZoomOut } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
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

type ZoneLayout = { x: number; y: number; rotation: number }
type ZoneLayouts = Record<string, ZoneLayout>

const EMPTY_LAYOUT: ZoneLayout = { x: 0, y: 0, rotation: 0 }
const UNASSIGNED_ZONE = "__unassigned"
const MIN_ZOOM = 0.5
const MAX_ZOOM = 4
const ZOOM_STEP = 0.25

function zoneKey(slot: DashboardSlot) {
  return slot.zoneId || UNASSIGNED_ZONE
}

function zoneLabel(zoneId: string, slots: DashboardSlot[]) {
  if (zoneId === UNASSIGNED_ZONE) return "Chưa phân zone"
  const codePrefix = slots[0]?.code.match(/^([^\d\s-]+)/)?.[1]
  return codePrefix ? `Zone ${codePrefix.toUpperCase()}` : `Zone ${zoneId.slice(0, 6).toUpperCase()}`
}

function zoneBounds(slots: DashboardSlot[]) {
  const points = slots.flatMap((slot) => slot.polygon)
  const xs = points.map((point) => point.x)
  const ys = points.map((point) => point.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: Math.max(maxX - minX, 1),
    height: Math.max(maxY - minY, 1),
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
  }
}

function transformedSlots(slots: DashboardSlot[], layouts: ZoneLayouts): DashboardSlot[] {
  const groups = new Map<string, DashboardSlot[]>()
  slots.forEach((slot) => groups.set(zoneKey(slot), [...(groups.get(zoneKey(slot)) || []), slot]))

  return slots.map((slot) => {
    const key = zoneKey(slot)
    const layout = layouts[key] || EMPTY_LAYOUT
    const bounds = zoneBounds(groups.get(key) || [slot])
    const radians = layout.rotation * Math.PI / 180
    const cos = Math.cos(radians)
    const sin = Math.sin(radians)
    return {
      ...slot,
      polygon: slot.polygon.map((point) => {
        const relativeX = point.x - bounds.centerX
        const relativeY = point.y - bounds.centerY
        return {
          x: bounds.centerX + relativeX * cos - relativeY * sin + layout.x,
          y: bounds.centerY + relativeX * sin + relativeY * cos + layout.y,
        }
      }),
    }
  })
}

function viewBox(slots: DashboardSlot[], paddingRatio = 0.06): string {
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
  const padding = Math.max(width, height) * paddingRatio
  return `${minX - padding} ${minY - padding} ${width + padding * 2} ${height + padding * 2}`
}

function zoomedViewBox(value: string, zoom: number): string {
  const [x, y, width, height] = value.split(/\s+/).map(Number)
  if (![x, y, width, height].every(Number.isFinite)) return value
  const nextWidth = width / zoom
  const nextHeight = height / zoom
  return `${x + (width - nextWidth) / 2} ${y + (height - nextHeight) / 2} ${nextWidth} ${nextHeight}`
}

export function ParkingMap({ slots, layoutScopeId }: { slots: DashboardSlot[]; layoutScopeId?: string | null }) {
  const drawable = React.useMemo(() => slots.filter((slot) => slot.polygon.length >= 3), [slots])
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [detailOpen, setDetailOpen] = React.useState(false)
  const [selectedZoneId, setSelectedZoneId] = React.useState<string | null>(null)
  const [isEditing, setIsEditing] = React.useState(false)
  const [editingViewBox, setEditingViewBox] = React.useState("0 0 100 100")
  const [zoom, setZoom] = React.useState(1)
  const [layouts, setLayouts] = React.useState<ZoneLayouts>({})
  const [savedLayouts, setSavedLayouts] = React.useState<ZoneLayouts>({})
  const svgRef = React.useRef<SVGSVGElement | null>(null)
  const dragRef = React.useRef<{ zoneId: string; startX: number; startY: number; originX: number; originY: number; moved: boolean } | null>(null)
  const selected = slots.find((slot) => slot.id === selectedId) || null
  const storageKey = `parking-map-zone-layout:${slots[0]?.siteId || "unknown"}:${layoutScopeId || "all"}`
  const zones = React.useMemo(() => {
    const groups = new Map<string, DashboardSlot[]>()
    drawable.forEach((slot) => groups.set(zoneKey(slot), [...(groups.get(zoneKey(slot)) || []), slot]))
    return [...groups.entries()].map(([id, zoneSlots]) => ({ id, slots: zoneSlots, bounds: zoneBounds(zoneSlots) }))
  }, [drawable])
  const renderedSlots = React.useMemo(() => transformedSlots(drawable, layouts), [drawable, layouts])
  const renderedViewBox = React.useMemo(() => viewBox(renderedSlots), [renderedSlots])
  const activeViewBox = isEditing ? editingViewBox : renderedViewBox
  const visibleViewBox = React.useMemo(() => zoomedViewBox(activeViewBox, zoom), [activeViewBox, zoom])
  const hasLayoutChanges = JSON.stringify(layouts) !== JSON.stringify(savedLayouts)

  React.useEffect(() => {
    try {
      const stored = window.localStorage.getItem(storageKey)
      const parsed = stored ? JSON.parse(stored) as ZoneLayouts : {}
      setLayouts(parsed)
      setSavedLayouts(parsed)
    } catch {
      setLayouts({})
      setSavedLayouts({})
    }
  }, [storageKey])

  React.useEffect(() => {
    if (selectedId && !slots.some((slot) => slot.id === selectedId)) {
      setSelectedId(null)
      setDetailOpen(false)
    }
  }, [slots, selectedId])

  React.useEffect(() => {
    if (selectedZoneId && !zones.some((zone) => zone.id === selectedZoneId)) setSelectedZoneId(null)
  }, [selectedZoneId, zones])

  const clientToSvg = React.useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current
    if (!svg) return null
    const point = svg.createSVGPoint()
    point.x = clientX
    point.y = clientY
    const matrix = svg.getScreenCTM()?.inverse()
    return matrix ? point.matrixTransform(matrix) : null
  }, [])

  const beginDrag = (event: React.PointerEvent<SVGGElement>, zoneId: string) => {
    if (!isEditing) return
    const point = clientToSvg(event.clientX, event.clientY)
    if (!point) return
    const layout = layouts[zoneId] || EMPTY_LAYOUT
    dragRef.current = { zoneId, startX: point.x, startY: point.y, originX: layout.x, originY: layout.y, moved: false }
    setSelectedZoneId(zoneId)
    event.currentTarget.setPointerCapture(event.pointerId)
    event.preventDefault()
  }

  const moveZone = (event: React.PointerEvent<SVGGElement>) => {
    const drag = dragRef.current
    if (!drag) return
    const point = clientToSvg(event.clientX, event.clientY)
    if (!point) return
    const deltaX = point.x - drag.startX
    const deltaY = point.y - drag.startY
    if (Math.abs(deltaX) + Math.abs(deltaY) > 0.2) drag.moved = true
    setLayouts((current) => ({
      ...current,
      [drag.zoneId]: {
        ...(current[drag.zoneId] || EMPTY_LAYOUT),
        x: drag.originX + deltaX,
        y: drag.originY + deltaY,
      },
    }))
  }

  const endDrag = (event: React.PointerEvent<SVGGElement>) => {
    if (!dragRef.current) return
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    dragRef.current = null
  }

  const rotateSelectedZone = (degrees: number) => {
    if (!selectedZoneId) return
    setLayouts((current) => ({
      ...current,
      [selectedZoneId]: {
        ...(current[selectedZoneId] || EMPTY_LAYOUT),
        rotation: (current[selectedZoneId]?.rotation || 0) + degrees,
      },
    }))
  }

  const saveLayout = () => {
    window.localStorage.setItem(storageKey, JSON.stringify(layouts))
    setSavedLayouts(layouts)
    setIsEditing(false)
  }

  const resetSelectedZone = () => {
    if (!selectedZoneId) return
    setLayouts((current) => ({ ...current, [selectedZoneId]: { ...EMPTY_LAYOUT } }))
  }

  const changeZoom = (delta: number) => {
    setZoom((current) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number((current + delta).toFixed(2)))))
  }

  const openSlotDetail = (slotId: string) => {
    setSelectedId(slotId)
    setDetailOpen(true)
  }

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
    <div className="min-w-0">
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="grid gap-3 bg-muted/45 p-3 sm:p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground" aria-label="Chú giải trạng thái ô đỗ">
                {(Object.keys(COLORS) as OccupancyStatus[]).map((status) => (
                  <span key={status} className="inline-flex items-center gap-1.5">
                    <span className="size-2.5 rounded-full" style={{ backgroundColor: COLORS[status] }} aria-hidden="true" />
                    {STATUS_LABELS[status]}
                  </span>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {isEditing ? (
                  <>
                    <Button size="sm" variant="outline" disabled={!selectedZoneId} onClick={() => rotateSelectedZone(-15)} aria-label="Xoay zone sang trái 15 độ"><RotateCcw className="size-4" /> -15°</Button>
                    <Button size="sm" variant="outline" disabled={!selectedZoneId} onClick={() => rotateSelectedZone(15)} aria-label="Xoay zone sang phải 15 độ"><RotateCw className="size-4" /> +15°</Button>
                    <Button size="sm" variant="outline" disabled={!selectedZoneId} onClick={resetSelectedZone}><Undo2 className="size-4" /> Đặt lại zone</Button>
                    <Button size="sm" variant="ghost" onClick={() => { setLayouts(savedLayouts); setIsEditing(false) }}>Hủy</Button>
                    <Button size="sm" onClick={saveLayout} disabled={!hasLayoutChanges}><Save className="size-4" /> Lưu bố trí</Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditingViewBox(viewBox(renderedSlots, 0.35))
                      setIsEditing(true)
                    }}
                    disabled={zones.length === 0}
                  >
                    <Move className="size-4" /> Sắp xếp zone
                  </Button>
                )}
              </div>
            </div>
            {isEditing && (
              <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/10 px-3 py-2 text-xs text-foreground">
                <Move className="size-4 shrink-0 text-primary" aria-hidden="true" />
                <span>Chọn rồi kéo một zone để di chuyển. Dùng nút ±15° để xoay; tọa độ calibration gốc không bị thay đổi.</span>
              </div>
            )}
            <div
              className="relative min-h-[20rem] rounded-[var(--radius-input)] border border-border bg-card p-2 outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-[28rem] sm:p-4"
              tabIndex={0}
              aria-label="Khung sơ đồ bãi xe. Nhấn cộng hoặc trừ để thu phóng, nhấn 0 để vừa khung."
              onKeyDown={(event) => {
                if (event.key === "+" || event.key === "=") {
                  event.preventDefault()
                  changeZoom(ZOOM_STEP)
                } else if (event.key === "-") {
                  event.preventDefault()
                  changeZoom(-ZOOM_STEP)
                } else if (event.key === "0") {
                  event.preventDefault()
                  setZoom(1)
                }
              }}
              onWheel={(event) => {
                if (!event.ctrlKey && !event.metaKey) return
                event.preventDefault()
                changeZoom(event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP)
              }}
            >
              <div className="absolute right-3 top-3 z-10 flex items-center rounded-[var(--radius-input)] border border-border bg-card/95 p-1 shadow-md backdrop-blur-sm" role="group" aria-label="Điều khiển thu phóng">
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="size-8"
                  onClick={() => changeZoom(-ZOOM_STEP)}
                  disabled={zoom <= MIN_ZOOM}
                  aria-label="Thu nhỏ sơ đồ"
                  title="Thu nhỏ (−)"
                >
                  <ZoomOut className="size-4" />
                </Button>
                <span className="min-w-12 select-none text-center text-xs font-semibold tabular-nums text-foreground" aria-live="polite">
                  {Math.round(zoom * 100)}%
                </span>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="size-8"
                  onClick={() => changeZoom(ZOOM_STEP)}
                  disabled={zoom >= MAX_ZOOM}
                  aria-label="Phóng to sơ đồ"
                  title="Phóng to (+)"
                >
                  <ZoomIn className="size-4" />
                </Button>
                <span className="mx-1 h-5 w-px bg-border" aria-hidden="true" />
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="size-8"
                  onClick={() => setZoom(1)}
                  disabled={zoom === 1}
                  aria-label="Đưa sơ đồ về vừa khung"
                  title="Vừa khung (0)"
                >
                  <Maximize2 className="size-4" />
                </Button>
              </div>
              <svg
                ref={svgRef}
                viewBox={visibleViewBox}
                className="h-full min-h-[18rem] w-full sm:min-h-[25rem]"
                role="img"
                aria-label="Sơ đồ trạng thái ô đỗ xe. Chọn một ô để xem chi tiết."
                preserveAspectRatio="xMidYMid meet"
              >
                {zones.map((zone) => {
                  const layout = layouts[zone.id] || EMPTY_LAYOUT
                  const isSelectedZone = selectedZoneId === zone.id
                  return (
                    <g
                      key={zone.id}
                      transform={`translate(${layout.x} ${layout.y}) rotate(${layout.rotation} ${zone.bounds.centerX} ${zone.bounds.centerY})`}
                      className={isEditing ? "cursor-move" : undefined}
                      style={{ touchAction: isEditing ? "none" : "auto" }}
                      onPointerDown={(event) => beginDrag(event, zone.id)}
                      onPointerMove={moveZone}
                      onPointerUp={endDrag}
                      onPointerCancel={endDrag}
                    >
                      {isEditing && (
                        <>
                          <rect
                            x={zone.bounds.minX - 0.35}
                            y={zone.bounds.minY - 0.35}
                            width={zone.bounds.width + 0.7}
                            height={zone.bounds.height + 0.7}
                            rx="0.25"
                            fill={isSelectedZone ? "var(--color-primary)" : "transparent"}
                            fillOpacity={isSelectedZone ? 0.08 : 0}
                            stroke={isSelectedZone ? "var(--color-primary)" : "var(--color-border)"}
                            strokeDasharray="5 4"
                            vectorEffect="non-scaling-stroke"
                          />
                          <text
                            x={zone.bounds.minX}
                            y={zone.bounds.minY - 0.65}
                            fill="var(--color-foreground)"
                            fontSize="0.8"
                            fontWeight="700"
                          >
                            {zoneLabel(zone.id, zone.slots)} · {Math.round(layout.rotation)}°
                          </text>
                        </>
                      )}
                      {zone.slots.map((slot) => (
                        <polygon
                          key={slot.id}
                          points={slot.polygon.map((point) => `${point.x},${point.y}`).join(" ")}
                          fill={COLORS[slot.status]}
                          fillOpacity={selectedId === slot.id ? 0.96 : 0.72}
                          stroke={isSelectedZone ? "var(--color-primary)" : selectedId === slot.id ? "var(--color-focus)" : "var(--color-surface-raised)"}
                          strokeWidth={isSelectedZone || selectedId === slot.id ? 0.22 : 0.1}
                          vectorEffect="non-scaling-stroke"
                          className={`${isEditing ? "cursor-move" : "cursor-pointer"} transition-opacity hover:opacity-100 focus:outline-none`}
                          tabIndex={isEditing ? -1 : 0}
                          role="button"
                          aria-label={`Ô ${slot.code}: ${STATUS_LABELS[slot.status]}`}
                          onClick={() => {
                            if (isEditing) setSelectedZoneId(zone.id)
                            else openSlotDetail(slot.id)
                          }}
                          onFocus={() => !isEditing && setSelectedId(slot.id)}
                          onKeyDown={(event) => {
                            if (!isEditing && (event.key === "Enter" || event.key === " ")) {
                              event.preventDefault()
                              openSlotDetail(slot.id)
                            }
                          }}
                        >
                          <title>{`${slot.code} · ${STATUS_LABELS[slot.status]}${slot.plate ? ` · ${slot.plate}` : ""}`}</title>
                        </polygon>
                      ))}
                    </g>
                  )
                })}
              </svg>
            </div>
            {!isEditing && Object.keys(savedLayouts).length > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Check className="size-3.5 text-[var(--color-success)]" /> Đang dùng bố trí zone tùy chỉnh trên thiết bị này</div>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="pr-10">
            <DialogTitle>Chi tiết ô đỗ</DialogTitle>
            <DialogDescription>Thông tin trạng thái và phương tiện tại vị trí đã chọn.</DialogDescription>
          </DialogHeader>
          {selected && <SlotDetail slot={selected} />}
        </DialogContent>
      </Dialog>
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
