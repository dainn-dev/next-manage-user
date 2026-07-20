"use client"

import * as React from 'react'
import { useAuth } from './auth-context'
import { siteApi, type Site } from './api/site-api'
import { zoneApi, type Zone } from './api/zone-api'
import { isDashboardOperator } from './types'
import { resolveTenantFacilityId } from './dashboard-policy.mjs'

interface DashboardScopeContextValue {
  sites: Site[]
  zones: Zone[]
  selectedSiteId: string | null
  selectedZoneId: string | null
  isLoading: boolean
  error: string | null
  selectZone: (zoneId: string | null) => void
  retry: () => void
}

const DashboardScopeContext = React.createContext<DashboardScopeContextValue | undefined>(undefined)

export function DashboardScopeProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuth()
  const [sites, setSites] = React.useState<Site[]>([])
  const [zones, setZones] = React.useState<Zone[]>([])
  const [selectedSiteId, setSiteId] = React.useState<string | null>(null)
  const [selectedZoneId, setZoneId] = React.useState<string | null>(null)
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [reload, setReload] = React.useState(0)

  React.useEffect(() => {
    if (!isAuthenticated || !isDashboardOperator(user?.role)) {
      setSites([])
      setSiteId(null)
      return
    }
    let cancelled = false
    setIsLoading(true)
    setError(null)
    siteApi.list().then((allSites) => {
      if (cancelled) return
      const facility = allSites.slice(0, 1)
      setSites(facility)
      const next = resolveTenantFacilityId(facility)
      setSiteId(next)
    }).catch((reason) => {
      if (!cancelled) {
        setSites([])
        setSiteId(null)
        setError(reason instanceof Error ? reason.message : 'Không thể tải phạm vi vận hành')
      }
    }).finally(() => {
      if (!cancelled) setIsLoading(false)
    })
    return () => { cancelled = true }
  }, [isAuthenticated, user?.id, user?.role, reload])

  React.useEffect(() => {
    if (!selectedSiteId) {
      setZones([])
      setZoneId(null)
      return
    }
    let cancelled = false
    zoneApi.list(selectedSiteId).then((list) => {
      if (!cancelled) {
        setZones(list)
        setZoneId((current) => list.some((zone) => zone.id === current) ? current : null)
      }
    }).catch(() => {
      if (!cancelled) setZones([])
    })
    return () => { cancelled = true }
  }, [selectedSiteId])

  const value = React.useMemo(() => ({
    sites, zones, selectedSiteId, selectedZoneId, isLoading, error,
    selectZone: setZoneId, retry: () => setReload((value) => value + 1),
  }), [sites, zones, selectedSiteId, selectedZoneId, isLoading, error])

  return <DashboardScopeContext.Provider value={value}>{children}</DashboardScopeContext.Provider>
}

export function useDashboardScope() {
  const context = React.useContext(DashboardScopeContext)
  if (!context) throw new Error('useDashboardScope must be used within DashboardScopeProvider')
  return context
}
