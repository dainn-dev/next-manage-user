"use client"

import * as React from 'react'
import { AlertCircle, Camera, Car, Clock, Loader2, MapPin, Search, WifiOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useDashboardData } from '@/lib/dashboard-data-context'
import { useDashboardScope } from '@/lib/dashboard-scope-context'
import { validPlateQuery } from '@/lib/plate-search.mjs'

export default function VehiclePlateSearchPage() {
  const [query, setQuery] = React.useState('')
  const { vehicles, searchVehicles, searchStatus, searchError, searchQuery, realtime } = useDashboardData()
  const { selectedSiteId } = useDashboardScope()

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    void searchVehicles(query)
  }

  return <div className="mx-auto max-w-5xl space-y-6 p-6">
    <div><h1 className="text-2xl font-semibold">Tìm phương tiện theo biển số</h1><p className="text-sm text-muted-foreground">Kết quả được giới hạn trong site đang chọn và cập nhật theo {realtime === 'live' ? 'realtime' : 'polling'}.</p></div>

    <form onSubmit={submit} className="flex gap-2">
      <div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value.toUpperCase())} placeholder="Ví dụ: 51A-123.45" className="pl-9 font-mono uppercase" aria-label="Biển số xe" /></div>
      <Button type="submit" disabled={!selectedSiteId || !validPlateQuery(query) || searchStatus === 'loading'}>{searchStatus === 'loading' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}Tìm kiếm</Button>
    </form>

    {!selectedSiteId && <StatePanel icon={MapPin} title="Chưa có site để tìm kiếm" description="Chọn một site hoặc liên hệ quản trị viên để được cấp phạm vi." />}
    {selectedSiteId && searchStatus === 'idle' && <StatePanel icon={Car} title="Nhập biển số để bắt đầu" description="Có thể nhập có hoặc không có dấu chấm và dấu gạch ngang." />}
    {searchStatus === 'loading' && <div className="grid gap-4 md:grid-cols-2">{[0, 1].map((item) => <div key={item} className="h-64 animate-pulse rounded-xl bg-muted" />)}</div>}
    {searchStatus === 'empty' && <StatePanel icon={Search} title="Không tìm thấy phương tiện" description={`Không có kết quả cho “${searchQuery}” trong site hiện tại.`} />}
    {searchStatus === 'error' && <StatePanel icon={AlertCircle} title="Không thể tìm kiếm" description={searchError || 'API tìm kiếm đang không khả dụng.'} action={<Button variant="outline" onClick={() => void searchVehicles(query || searchQuery)}>Thử lại</Button>} />}
    {searchStatus === 'ready' && vehicles.length > 0 && <div className="grid gap-4 md:grid-cols-2">{vehicles.map((vehicle) => <VehicleResult key={vehicle.id} vehicle={vehicle} />)}</div>}
  </div>
}

function VehicleResult({ vehicle }: { vehicle: ReturnType<typeof useDashboardData>['vehicles'][number] }) {
  const [snapshotFailed, setSnapshotFailed] = React.useState(false)
  React.useEffect(() => setSnapshotFailed(false), [vehicle.snapshotUrl])
  const snapshot = vehicle.snapshotUrl && !snapshotFailed ? vehicle.snapshotUrl : null
  const inSlot = !!vehicle.currentSlotId
  return <Card className="overflow-hidden">
    <div className="flex aspect-video items-center justify-center bg-slate-950">
      {snapshot ? <img src={snapshot} alt={`Ảnh gần nhất của ${vehicle.licensePlateNumber}`} className="h-full w-full object-cover" onError={() => setSnapshotFailed(true)} /> : <div className="flex flex-col items-center gap-2 text-sm text-slate-400"><Camera className="h-9 w-9" />Chưa có snapshot</div>}
    </div>
    <CardHeader><div className="flex items-center justify-between gap-2"><CardTitle className="font-mono text-xl">{vehicle.licensePlateNumber}</CardTitle><Badge variant={inSlot ? 'default' : 'secondary'}>{inSlot ? 'Trong bãi' : vehicle.lastEventType === 'exit' ? 'Đã rời bãi' : 'Không xác định vị trí'}</Badge></div></CardHeader>
    <CardContent className="space-y-3 text-sm">
      <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground" /><span>{vehicle.currentSlotCode ? `Ô ${vehicle.currentSlotCode}` : vehicle.lastEventType === 'exit' ? 'Đã rời bãi' : 'Chưa có dữ liệu ô đỗ'}</span></div>
      <div className="flex items-center gap-2"><Clock className="h-4 w-4 text-muted-foreground" /><span>{vehicle.lastSeenAt ? new Date(vehicle.lastSeenAt).toLocaleString('vi-VN') : 'Chưa có lần nhìn thấy gần nhất'}</span></div>
      {!inSlot && !snapshot && <div className="flex items-center gap-2 rounded-md bg-muted p-2 text-xs text-muted-foreground"><WifiOff className="h-4 w-4" />Không có occupancy hiện tại hoặc snapshot gần nhất.</div>}
    </CardContent>
  </Card>
}

function StatePanel({ icon: Icon, title, description, action }: { icon: typeof Search; title: string; description: string; action?: React.ReactNode }) {
  return <div className="flex min-h-72 flex-col items-center justify-center gap-3 rounded-xl border border-dashed p-8 text-center"><div className="rounded-full bg-muted p-4"><Icon className="h-8 w-8 text-muted-foreground" /></div><div><h2 className="font-medium">{title}</h2><p className="mt-1 text-sm text-muted-foreground">{description}</p></div>{action}</div>
}
