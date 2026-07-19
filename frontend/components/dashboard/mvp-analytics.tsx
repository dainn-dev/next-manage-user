"use client"

import { Car, Clock3, Gauge, Radio } from 'lucide-react'
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
    { 
      label: 'Xe đang trong bãi', 
      value: metrics.currentVehicles.toLocaleString('vi-VN'), 
      icon: Car, 
      id: 'LOT_OCCUPIED',
      glow: 'rgba(6,182,212,0.04)', // Cyan
      color: 'text-cyan-600',
      border: 'border-cyan-100',
      bg: 'bg-cyan-50/20'
    },
    { 
      label: 'Tỷ lệ lấp đầy', 
      value: `${(metrics.fillRate * 100).toFixed(1)}%`, 
      icon: Gauge, 
      id: 'CAP_UTILIZATION',
      glow: 'rgba(16,185,129,0.04)', // Emerald
      color: 'text-emerald-600',
      border: 'border-emerald-100',
      bg: 'bg-emerald-50/20'
    },
    { 
      label: 'Thời gian đỗ trung bình', 
      value: analytics?.completedDwellSessions ? formatDuration(analytics.averageDwellSeconds) : 'Chưa đủ dữ liệu', 
      icon: Clock3, 
      id: 'DWELL_TIME_AVG',
      glow: 'rgba(245,158,11,0.04)', // Amber
      color: 'text-amber-600',
      border: 'border-amber-100',
      bg: 'bg-amber-50/20'
    },
  ]

  return (
    <section aria-labelledby="mvp-analytics-title" className="space-y-4 relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
      {/* Dynamic scan line effect */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-cyan-500/20 shadow-[0_0_10px_#06b6d4] animate-pulse" />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between border-b border-border pb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-full border border-cyan-200 bg-cyan-50 px-2 py-0.5 text-[9px] font-mono font-medium text-cyan-700">
              <Radio className="size-2.5 animate-pulse" />
              SỨC_CHỨA_HIỆN_TẠI
            </span>
          </div>
          <h2 id="mvp-analytics-title" className="mt-1 text-base font-bold text-foreground font-mono">
            Tình hình bãi đỗ
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {selectedZoneId
              ? 'Theo khu vực đang chọn'
              : selectedSiteId
                ? 'Theo bãi đỗ đang chọn'
                : 'Chưa chọn bãi đỗ'}
            {' · '}dwell từ {analytics?.completedDwellSessions || 0} lượt hoàn tất trong 7 ngày
          </p>
        </div>
        {lastUpdatedAt && (
          <div className="shrink-0 flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground bg-muted border border-border px-2.5 py-1 rounded-md">
            <span className="size-1.5 rounded-full bg-cyan-500 animate-ping" />
            CẬP_NHẬT: {new Date(lastUpdatedAt).toLocaleTimeString('vi-VN')}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map(({ label, value, icon: Icon, id, glow, color, border, bg }) => (
          <Card 
            key={label} 
            className={`gap-0 py-0 border ${border} ${bg} shadow-sm relative overflow-hidden transition-all duration-300 hover:scale-[1.01]`}
            style={{
              boxShadow: `inset 0 0 12px ${glow}`,
            }}
          >
            <CardContent className="flex min-w-0 items-start justify-between gap-3 p-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-mono text-muted-foreground/80">[{id}]</span>
                  <span className="text-[8px] font-mono text-muted-foreground/60">FEED_A</span>
                </div>
                <p className="text-xs text-slate-600 mt-1 font-semibold">{label}</p>
                {loading ? (
                  <div className="mt-2 h-7 w-20 animate-pulse rounded bg-slate-100 border border-slate-200" />
                ) : (
                  <p className={`mt-2 font-mono text-xl sm:text-2xl font-black leading-tight tracking-tight ${color}`}>
                    {value}
                  </p>
                )}
              </div>
              <span className={`grid size-9 shrink-0 place-items-center rounded-lg bg-white/90 border ${border} text-slate-500`}>
                <Icon className={`size-4.5 ${color}`} aria-hidden="true" />
              </span>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  )
}
