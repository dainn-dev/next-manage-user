"use client"

import { Car, Clock3, Gauge } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { useDashboardData } from '@/lib/dashboard-data-context'
import { useDashboardScope } from '@/lib/dashboard-scope-context'
import { calculateOccupancyMetrics, formatDuration } from '@/lib/dashboard-metrics.mjs'

export function MvpAnalytics() {
  const { slots, analytics, status, lastUpdatedAt } = useDashboardData()
  const { selectedSiteId, selectedZoneId } = useDashboardScope()
  const metrics = calculateOccupancyMetrics(slots)
  const loading = status === 'loading' || status === 'idle'
  const cards = [
    { label: 'Xe đang trong bãi', value: metrics.currentVehicles.toLocaleString('vi-VN'), icon: Car },
    { label: 'Tỷ lệ lấp đầy', value: `${(metrics.fillRate * 100).toFixed(1)}%`, icon: Gauge },
    { label: 'Thời gian đỗ trung bình', value: analytics?.completedDwellSessions ? formatDuration(analytics.averageDwellSeconds) : 'Chưa đủ dữ liệu', icon: Clock3 },
  ]

  return <section aria-labelledby="mvp-analytics-title" className="space-y-3"><div className="flex items-end justify-between gap-3"><div><h2 id="mvp-analytics-title" className="text-lg font-semibold">Occupancy hiện tại</h2><p className="text-xs text-muted-foreground">{selectedZoneId ? 'Occupancy theo zone đang chọn' : selectedSiteId ? 'Site đang chọn' : 'Chưa chọn site'} · dwell từ {analytics?.completedDwellSessions || 0} lượt đỗ hoàn tất trong 7 ngày</p></div>{lastUpdatedAt && <time className="text-xs text-muted-foreground" dateTime={lastUpdatedAt}>As of {new Date(lastUpdatedAt).toLocaleTimeString('vi-VN')}</time>}</div><div className="grid gap-3 sm:grid-cols-3">{cards.map(({ label, value, icon: Icon }) => <Card key={label}><CardContent className="flex items-center justify-between p-4"><div><p className="text-sm text-muted-foreground">{label}</p>{loading ? <div className="mt-2 h-7 w-20 animate-pulse rounded bg-muted" /> : <p className="text-2xl font-semibold">{value}</p>}</div><Icon className="h-7 w-7 text-primary" /></CardContent></Card>)}</div></section>
}
