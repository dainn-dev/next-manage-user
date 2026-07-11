"use client"

import * as React from "react"
import { Bell, MapPin, Shield } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ModeToggle } from "./mode-toggle"
import { useAuth } from "@/lib/auth-context"
import { isPlatformAdmin, isSiteManager } from "@/lib/types"
import { siteApi, type Site } from "@/lib/api/site-api"
import {
  resolvePreferredSiteId,
  setSelectedSiteId,
} from "@/lib/site-selection"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

/**
 * Operations topbar. SITE_MANAGER with multiple assigned sites gets a switcher
 * (client filter). TENANT_ADMIN sees a generic site label.
 */
export function Topbar() {
  const { user } = useAuth()
  const platform = isPlatformAdmin(user?.role)
  const siteManager = isSiteManager(user?.role)
  const assignedIds = user?.siteIds || []

  const [sites, setSites] = React.useState<Site[]>([])
  const [selectedId, setSelectedId] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (platform || !user) return
    let cancelled = false
    siteApi
      .list()
      .then((list) => {
        if (cancelled) return
        setSites(list)
        if (siteManager && assignedIds.length > 0) {
          const preferred = resolvePreferredSiteId(assignedIds)
          setSelectedId(preferred)
          if (preferred) setSelectedSiteId(preferred)
        }
      })
      .catch(() => {
        if (!cancelled) setSites([])
      })
    return () => {
      cancelled = true
    }
  }, [platform, user?.id, siteManager, assignedIds.join(",")])

  const singleSiteLabel =
    sites.length === 1
      ? sites[0].name
      : sites.find((s) => s.id === selectedId)?.name || "Bãi đỗ xe"

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
        ) : siteManager && assignedIds.length > 1 ? (
          <>
            <MapPin className="h-4 w-4 shrink-0 text-primary" />
            <Select
              value={selectedId || undefined}
              onValueChange={(value) => {
                setSelectedId(value)
                setSelectedSiteId(value)
              }}
            >
              <SelectTrigger className="h-8 w-[min(220px,50vw)] border-none bg-transparent px-1 shadow-none focus:ring-0">
                <SelectValue placeholder="Chọn chi nhánh" />
              </SelectTrigger>
              <SelectContent>
                {sites
                  .filter((s) => assignedIds.includes(s.id))
                  .map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </>
        ) : (
          <>
            <MapPin className="h-4 w-4 shrink-0 text-primary" />
            <span className="truncate font-medium text-sidebar-foreground">{singleSiteLabel}</span>
            <span className="hidden sm:inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              {siteManager ? "Chi nhánh" : "Tenant"}
            </span>
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
