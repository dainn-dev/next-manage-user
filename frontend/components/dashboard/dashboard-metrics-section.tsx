import type { ReactNode } from "react"

import { DynamicMetricGrid, type DashboardMetric } from "@/components/dashboard/dynamic-metric-grid"

interface DashboardMetricsSectionProps {
  action?: ReactNode
  badge?: ReactNode
  children?: ReactNode
  description: ReactNode
  id: string
  loading?: boolean
  meta?: ReactNode
  metricGridClassName?: string
  metrics: readonly DashboardMetric[]
  notice?: ReactNode
  title: ReactNode
}

/** Shared dashboard surface: header, status, KPI grid, and optional detail content. */
export function DashboardMetricsSection({
  action,
  badge,
  children,
  description,
  id,
  loading = false,
  meta,
  metricGridClassName,
  metrics,
  notice,
  title,
}: DashboardMetricsSectionProps) {
  return (
    <section aria-labelledby={id} className="material-surface grid gap-4 p-4 sm:gap-5 sm:p-5">
      <header className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
        <div className="min-w-0">
          <h2 id={id} className="text-lg font-semibold tracking-tight text-foreground">{title}</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
        </div>
        {(badge || meta || action) && (
          <div className="flex min-w-0 flex-wrap items-center gap-2 sm:justify-self-end sm:justify-end">
            {badge}
            {meta}
            {action}
          </div>
        )}
      </header>

      {notice}
      <DynamicMetricGrid className={metricGridClassName} loading={loading} metrics={metrics} />
      {children}
    </section>
  )
}
