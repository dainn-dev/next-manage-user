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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Sức chứa hiện tại
          </p>
          <h2 id="mvp-analytics-title" className="mt-1 text-sm font-semibold tracking-tight sm:text-lg">
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
          <time className="shrink-0 font-mono text-xs text-muted-foreground sm:pt-1" dateTime={lastUpdatedAt}>
            {new Date(lastUpdatedAt).toLocaleTimeString('vi-VN')}
          </time>
        )}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map(({ label, value, icon: Icon }) => (
          <Card key={label} className="gap-0 py-0">
            <CardContent className="flex min-w-0 items-start justify-between gap-3 p-4 sm:p-5">
              <div className="min-w-0">
                <p className="text-sm leading-5 text-muted-foreground">{label}</p>
                {loading ? (
                  <div className="mt-2 h-7 w-20 animate-pulse rounded bg-muted" />
                ) : (
                  <p className="mt-2 break-words font-[family:var(--font-display)] text-[1rem] font-semibold leading-tight tracking-[-0.02em] tabular-nums sm:text-2xl sm:tracking-[-0.03em]">
                    {value}
                  </p>
                )}
              </div>
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                <Icon className="size-5" aria-hidden="true" />
              </span>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  )
}
