"use client"

import * as React from 'react'
import { Car, Clock, MapPin } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { DashboardSlot, OccupancyStatus } from '@/lib/api/dashboard-api'

const COLORS: Record<OccupancyStatus, string> = {
  AVAILABLE: '#22c55e',
  OCCUPIED: '#ef4444',
  RESERVED: '#f59e0b',
  DISABLED: '#64748b',
  UNKNOWN: '#a855f7',
}

function viewBox(slots: DashboardSlot[]): string {
  const points = slots.flatMap((slot) => slot.polygon)
  if (!points.length) return '0 0 100 100'
  const xs = points.map((point) => point.x)
  const ys = points.map((point) => point.y)
  const minX = Math.min(...xs); const maxX = Math.max(...xs)
  const minY = Math.min(...ys); const maxY = Math.max(...ys)
  const width = Math.max(maxX - minX, 1); const height = Math.max(maxY - minY, 1)
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
    return <div className="flex min-h-[420px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed p-8 text-center"><MapPin className="h-10 w-10 text-muted-foreground" /><div><h2 className="font-medium">Chưa có dữ liệu bản đồ</h2><p className="mt-1 text-sm text-muted-foreground">Các ô đỗ chưa có polygon được publish từ Map Designer.</p></div></div>
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="min-h-[480px] bg-slate-950 p-4">
            <svg viewBox={viewBox(drawable)} className="h-full min-h-[448px] w-full" role="img" aria-label="Sơ đồ trạng thái ô đỗ xe" preserveAspectRatio="xMidYMid meet">
              {drawable.map((slot) => (
                <polygon
                  key={slot.id}
                  points={slot.polygon.map((point) => `${point.x},${point.y}`).join(' ')}
                  fill={COLORS[slot.status]}
                  fillOpacity={selectedId === slot.id ? 0.95 : 0.65}
                  stroke={selectedId === slot.id ? '#ffffff' : '#e2e8f0'}
                  strokeWidth={selectedId === slot.id ? 0.18 : 0.08}
                  vectorEffect="non-scaling-stroke"
                  className="cursor-pointer transition-opacity hover:opacity-100 focus:outline-none"
                  tabIndex={0}
                  role="button"
                  aria-label={`Ô ${slot.code}: ${slot.status}`}
                  onClick={() => setSelectedId(slot.id)}
                  onFocus={() => setSelectedId(slot.id)}
                  onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') setSelectedId(slot.id) }}
                ><title>{`${slot.code} · ${slot.status}${slot.plate ? ` · ${slot.plate}` : ''}`}</title></polygon>
              ))}
            </svg>
          </div>
        </CardContent>
      </Card>

      <Card className="h-fit">
        <CardHeader><CardTitle className="text-base">Chi tiết ô đỗ</CardTitle></CardHeader>
        <CardContent>
          {selected ? <SlotDetail slot={selected} /> : <p className="text-sm text-muted-foreground">Chọn hoặc focus một polygon để xem chi tiết.</p>}
        </CardContent>
      </Card>
    </div>
  )
}

function SlotDetail({ slot }: { slot: DashboardSlot }) {
  return <div className="space-y-4"><div className="flex items-center justify-between gap-2"><span className="text-xl font-semibold">{slot.code}</span><Badge style={{ backgroundColor: COLORS[slot.status] }}>{slot.status}</Badge></div><div className="space-y-2 text-sm"><div className="flex items-center gap-2"><Car className="h-4 w-4 text-muted-foreground" /><span>{slot.plate || 'Chưa có phương tiện'}</span></div><div className="flex items-center gap-2"><Clock className="h-4 w-4 text-muted-foreground" /><span>{slot.lastSeenAt ? new Date(slot.lastSeenAt).toLocaleString('vi-VN') : 'Chưa có cập nhật occupancy'}</span></div><div className="text-xs text-muted-foreground">{slot.polygon.length} đỉnh · dữ liệu Map Designer</div></div></div>
}
