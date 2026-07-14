"use client"

import * as React from "react"
import { AlertCircle, Bell, Loader2, MapPin, RefreshCw, Shield } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ModeToggle } from "./mode-toggle"
import { useAuth } from "@/lib/auth-context"
import { isDashboardOperator, isPlatformAdmin } from "@/lib/types"
import { useDashboardScope } from "@/lib/dashboard-scope-context"
import { canSelectDashboardSite } from "@/lib/dashboard-policy.mjs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

/**
 * Operations topbar. Tenant admins can switch across tenant sites and site
 * managers across their assigned sites. Other operators get a fixed scope.
 */
export function Topbar() {
  const { user } = useAuth()
  const platform = isPlatformAdmin(user?.role)
  const operator = isDashboardOperator(user?.role)
  const canSelectSite = canSelectDashboardSite(user?.role)
  const scope = useDashboardScope()
  const selectedSite = scope.sites.find((site) => site.id === scope.selectedSiteId)

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-sidebar-border bg-sidebar/60 px-4 backdrop-blur supports-[backdrop-filter]:bg-sidebar/40">
      <div className="flex min-w-0 items-center gap-2 text-sm">
        {platform ? (
          <>
            <Shield className="h-4 w-4 shrink-0 text-primary" />
            <span className="font-medium text-sidebar-foreground">ParkVision Platform</span>
            <span className="hidden sm:inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              SaaS console
            </span>
          </>
        ) : operator ? (
          <>
            <MapPin className="h-4 w-4 shrink-0 text-primary" />
            {scope.isLoading ? (
              <span className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Đang tải phạm vi...</span>
            ) : scope.error ? (
              <Button variant="ghost" size="sm" onClick={scope.retry} className="text-destructive">
                <AlertCircle className="mr-1 h-4 w-4" />Không thể tải <RefreshCw className="ml-1 h-3 w-3" />
              </Button>
            ) : scope.sites.length === 0 ? (
              <span className="text-muted-foreground">Chưa được gán site</span>
            ) : (
              <>
                {canSelectSite ? (
                  <Select value={scope.selectedSiteId || undefined} onValueChange={scope.selectSite}>
                    <SelectTrigger aria-label="Chọn site vận hành" className="h-8 w-[min(220px,40vw)] border-none bg-transparent px-1 shadow-none focus:ring-0">
                      <SelectValue placeholder="Chọn site" />
                    </SelectTrigger>
                    <SelectContent>{scope.sites.map((site) => <SelectItem key={site.id} value={site.id}>{site.name}</SelectItem>)}</SelectContent>
                  </Select>
                ) : (
                  <span className="max-w-[min(220px,40vw)] truncate font-medium text-sidebar-foreground">
                    {selectedSite?.name || "Site được phân công"}
                  </span>
                )}
                <Select value={scope.selectedZoneId || "all"} onValueChange={(value) => scope.selectZone(value === "all" ? null : value)}>
                  <SelectTrigger aria-label="Chọn zone vận hành" className="hidden h-8 w-[min(180px,30vw)] md:flex"><SelectValue placeholder="Tất cả zone" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tất cả zone</SelectItem>
                    {scope.zones.map((zone) => <SelectItem key={zone.id} value={zone.id}>{zone.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </>
            )}
          </>
        ) : (
          <>
            <MapPin className="h-4 w-4 shrink-0 text-primary" />
            <span className="truncate font-medium text-sidebar-foreground">ParkVision</span>
          </>
        )}
      </div>

      <div className="ml-auto flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          disabled
          title="Trung tâm thông báo — sắp ra mắt"
          aria-label="Thông báo"
        >
          <Bell className="h-[1.2rem] w-[1.2rem]" />
        </Button>
        <ModeToggle />
      </div>
    </header>
  )
}
