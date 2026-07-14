"use client"

import { AlertCircle, Car, CircleParking, RefreshCw, SquareParking } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ParkingMap } from '@/components/dashboard/parking-map'
import { useDashboardData } from '@/lib/dashboard-data-context'
import { useDashboardScope } from '@/lib/dashboard-scope-context'

export default function ParkingMapPage() {
  const { slots, status, error, refresh, realtime } = useDashboardData()
  const { selectedSiteId, selectedZoneId } = useDashboardScope()
  const occupied = slots.filter((slot) => slot.status === 'OCCUPIED').length
  const available = slots.filter((slot) => slot.status === 'AVAILABLE').length

  return <div className="space-y-6 p-6">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h1 className="text-2xl font-semibold">Sơ đồ bãi đỗ xe</h1><p className="text-sm text-muted-foreground">Occupancy theo {selectedZoneId ? 'zone' : 'site'} đang chọn · {realtime === 'live' ? 'realtime' : 'polling fallback'}</p></div><Button variant="outline" size="sm" onClick={() => void refresh()} disabled={status === 'loading'}><RefreshCw className="mr-2 h-4 w-4" />Làm mới</Button></div>
    {error && <div className="flex items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm"><AlertCircle className="h-4 w-4" />{error}</div>}
    <div className="grid gap-3 sm:grid-cols-3"><CountCard label="Tổng số ô" value={slots.length} icon={SquareParking} /><CountCard label="Còn trống" value={available} icon={CircleParking} tone="text-green-600" /><CountCard label="Đang có xe" value={occupied} icon={Car} tone="text-red-600" /></div>
    {!selectedSiteId ? <EmptySite /> : status === 'loading' || status === 'idle' ? <div className="min-h-[480px] animate-pulse rounded-xl bg-muted" /> : slots.length === 0 ? <EmptySite title="Site hoặc zone chưa có ô đỗ" /> : <ParkingMap slots={slots} />}
  </div>
}

function CountCard({ label, value, icon: Icon, tone = 'text-primary' }: { label: string; value: number; icon: typeof Car; tone?: string }) {
  return <Card><CardContent className="flex items-center justify-between p-4"><div><p className="text-sm text-muted-foreground">{label}</p><p className="text-2xl font-semibold">{value}</p></div><Icon className={`h-7 w-7 ${tone}`} /></CardContent></Card>
}

function EmptySite({ title = 'Chưa có site để hiển thị' }: { title?: string }) {
  return <div className="flex min-h-[420px] items-center justify-center rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">{title}</div>
}
