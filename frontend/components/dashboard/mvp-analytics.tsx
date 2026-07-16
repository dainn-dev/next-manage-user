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

  return (
    <section aria-labelledby="mvp-analytics-title" className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Sức chứa hiện tại
          </p>
          <h2 id="mvp-analytics-title" className="mt-1 text-lg font-semibold tracking-tight">
            Tình hình bãi đỗ
          </h2>
          <p className="mt-1 max-w-[60ch] text-xs leading-5 text-muted-foreground">
            {selectedZoneId
              ? 'Theo khu vực đang chọn'
              : selectedSiteId
                ? 'Theo bãi đỗ đang chọn'
                : 'Chưa chọn bãi đỗ'}
            {' · '}dwell từ {analytics?.completedDwellSessions || 0} lượt hoàn tất trong 7 ngày
          </p>
        </div>
        {lastUpdatedAt && (
          <time className="shrink-0 pt-1 font-mono text-xs text-muted-foreground" dateTime={lastUpdatedAt}>
            {new Date(lastUpdatedAt).toLocaleTimeString('vi-VN')}
          </time>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {cards.map(({ label, value, icon: Icon }) => (
          <Card key={label} className="gap-0 py-0 last:col-span-2 sm:last:col-span-1">
            <CardContent className="flex min-w-0 items-start justify-between gap-2 p-4">
              <div className="min-w-0">
                <p className="text-xs leading-4 text-muted-foreground">{label}</p>
                {loading ? (
                  <div className="mt-2 h-7 w-20 animate-pulse rounded bg-muted" />
                ) : (
                  <p className="mt-2 break-words font-mono text-lg font-semibold leading-tight tabular-nums">
                    {value}
                  </p>
                )}
              </div>
              <Icon className="size-5 shrink-0 text-primary" aria-hidden="true" />
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  )
}
