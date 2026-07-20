import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"

import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

export type DashboardMetricTone = "primary" | "success" | "warning" | "serious" | "critical"

export interface DashboardMetric {
  icon: LucideIcon
  label: string
  note: string
  tone: DashboardMetricTone
  value: ReactNode
}

interface DynamicMetricGridProps {
  className?: string
  loading?: boolean
  metrics: readonly DashboardMetric[]
}

const toneClasses: Record<DashboardMetricTone, string> = {
  primary: "bg-primary-container text-on-primary-container",
  success: "bg-[var(--color-success-surface)] text-[var(--color-success)]",
  warning: "bg-[var(--color-warning-surface)] text-[var(--color-serious)]",
  serious: "bg-[var(--color-serious-surface)] text-[var(--color-serious)]",
  critical: "bg-[var(--color-critical-surface)] text-[var(--color-critical)]",
}

function getMetricGridColumns(metricCount: number) {
  if (metricCount <= 1) return "grid-cols-1"
  if (metricCount === 2) return "grid-cols-1 sm:grid-cols-2"
  if (metricCount === 3) return "grid-cols-2 sm:grid-cols-3"
  if (metricCount === 5) return "grid-cols-2 sm:grid-cols-3 xl:grid-cols-5"
  return "grid-cols-2 xl:grid-cols-4"
}

/** Shared realtime-friendly KPI grid for dashboard sections. */
export function DynamicMetricGrid({ className, loading = false, metrics }: DynamicMetricGridProps) {
  return (
    <div className={cn("grid gap-3", getMetricGridColumns(metrics.length), className)} aria-busy={loading}>
      {metrics.map(({ icon: Icon, label, note, tone, value }) => (
        <Card key={label} className="gap-0 py-0 shadow-none">
          <CardContent className="flex min-w-0 items-center gap-3 p-3">
            <span className={cn("grid size-11 shrink-0 place-items-center rounded-[var(--radius-input)]", toneClasses[tone])}>
              <Icon className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground">{label}</p>
              {loading ? (
                <div className="mt-2 h-7 w-20 animate-pulse rounded bg-muted" aria-label={`Đang tải ${label}`} />
              ) : (
                <p className="mt-1 truncate text-xl font-bold leading-none tracking-tight tabular-nums text-foreground">{value}</p>
              )}
              <p className="mt-1 truncate text-xs leading-4 text-muted-foreground">{note}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
