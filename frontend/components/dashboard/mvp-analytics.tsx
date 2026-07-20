"use client"

import { ParkingSituation } from "@/components/dashboard/parking-situation"
import { useDashboardData } from "@/lib/dashboard-data-context"
import { useDashboardScope } from "@/lib/dashboard-scope-context"

/** Connects the reusable parking-situation view to the selected dashboard scope. */
export function MvpAnalytics() {
  const { analytics, error, lastUpdatedAt, realtime, slots, status } = useDashboardData()
  const { selectedSiteId, selectedZoneId } = useDashboardScope()

  const scopeLabel = selectedZoneId
    ? "Theo khu vực đang chọn"
    : selectedSiteId
      ? "Theo bãi đỗ đang chọn"
      : "Chưa chọn bãi đỗ"

  return (
    <ParkingSituation
      analytics={analytics}
      error={error}
      lastUpdatedAt={lastUpdatedAt}
      loading={status === "idle" || status === "loading"}
      realtime={realtime}
      scopeLabel={scopeLabel}
      slots={slots}
    />
  )
}
