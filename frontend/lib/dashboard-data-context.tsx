"use client"

import * as React from 'react'
import { usePathname } from 'next/navigation'
import { useDashboardScope } from './dashboard-scope-context'
import {
  dashboardApi, normalizeRealtimeEvent, normalizeRealtimeSlot,
  type DashboardAnalytics, type DashboardCamera, type DashboardEvent,
  type DashboardSlot, type DashboardVehicleSearchResult,
} from './api/dashboard-api'
import { needsDashboardLiveData } from './dashboard-policy.mjs'
import { useDashboardRealtime, type RealtimeState } from '@/hooks/use-dashboard-realtime'

export type DataStatus = 'idle' | 'loading' | 'ready' | 'empty' | 'error'

interface DashboardDataContextValue {
  cameras: DashboardCamera[]
  slots: DashboardSlot[]
  events: DashboardEvent[]
  eventsHasMore: boolean
  eventsLoadingMore: boolean
  analytics: DashboardAnalytics | null
  vehicles: DashboardVehicleSearchResult[]
  status: DataStatus
  error: string | null
  realtime: RealtimeState
  realtimeError: string | null
  lastUpdatedAt: string | null
  refresh: () => Promise<void>
  setEventFilter: (type: string) => void
  loadMoreEvents: () => Promise<void>
  searchVehicles: (query: string) => Promise<void>
  searchStatus: DataStatus
  searchError: string | null
  searchQuery: string
}

const DashboardDataContext = React.createContext<DashboardDataContextValue | undefined>(undefined)

export function DashboardDataProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const live = needsDashboardLiveData(pathname)
  const { selectedSiteId, selectedZoneId } = useDashboardScope()
  const [cameras, setCameras] = React.useState<DashboardCamera[]>([])
  const [slots, setSlots] = React.useState<DashboardSlot[]>([])
  const [events, setEvents] = React.useState<DashboardEvent[]>([])
  const [eventsPage, setEventsPage] = React.useState(0)
  const [eventsHasMore, setEventsHasMore] = React.useState(false)
  const [eventsLoadingMore, setEventsLoadingMore] = React.useState(false)
  const [eventFilter, setEventFilter] = React.useState('ALL')
  const [analytics, setAnalytics] = React.useState<DashboardAnalytics | null>(null)
  const [vehicles, setVehicles] = React.useState<DashboardVehicleSearchResult[]>([])
  const [searchStatus, setSearchStatus] = React.useState<DataStatus>('idle')
  const [searchError, setSearchError] = React.useState<string | null>(null)
  const [searchQuery, setSearchQuery] = React.useState('')
  const [status, setStatus] = React.useState<DataStatus>('idle')
  const [error, setError] = React.useState<string | null>(null)
  const [lastUpdatedAt, setLastUpdatedAt] = React.useState<string | null>(null)
  const searchRequest = React.useRef(0)
  const liveRef = React.useRef(live)
  liveRef.current = live

  const refresh = React.useCallback(async () => {
    if (!selectedSiteId) {
      setCameras([]); setSlots([]); setEvents([]); setAnalytics(null); setStatus('empty')
      return
    }
    setStatus((current) => current === 'ready' ? current : 'loading')
    setError(null)
    const results = await Promise.allSettled([
      dashboardApi.cameras(selectedSiteId, selectedZoneId),
      dashboardApi.slots(selectedSiteId, selectedZoneId),
      dashboardApi.events(selectedSiteId, selectedZoneId, 0, eventFilter),
      dashboardApi.analytics(selectedSiteId),
    ])
    // Drop late responses after navigating away from live-data routes.
    if (!liveRef.current) return
    const failures: string[] = []
    if (results[0].status === 'fulfilled') setCameras(results[0].value); else failures.push('cameras')
    if (results[1].status === 'fulfilled') setSlots(results[1].value); else failures.push('slots')
    if (results[2].status === 'fulfilled') {
      setEvents(results[2].value.content); setEventsPage(0); setEventsHasMore(results[2].value.hasNext)
    } else failures.push('events')
    if (results[3].status === 'fulfilled') setAnalytics(results[3].value); else failures.push('analytics')
    setLastUpdatedAt(new Date().toISOString())
    if (failures.length === results.length) {
      setStatus('error'); setError('Không thể tải dữ liệu dashboard')
    } else {
      setStatus('ready')
      setError(failures.length ? `Một số dữ liệu chưa tải được: ${failures.join(', ')}` : null)
    }
  }, [selectedSiteId, selectedZoneId, eventFilter])

  const loadMoreEvents = React.useCallback(async () => {
    if (!selectedSiteId || !eventsHasMore || eventsLoadingMore) return
    setEventsLoadingMore(true)
    try {
      const next = await dashboardApi.events(selectedSiteId, selectedZoneId, eventsPage + 1, eventFilter)
      setEvents((current) => [...current, ...next.content.filter((row) => !current.some((item) => item.id === row.id))])
      setEventsPage(next.page); setEventsHasMore(next.hasNext)
    } finally {
      setEventsLoadingMore(false)
    }
  }, [selectedSiteId, selectedZoneId, eventsPage, eventFilter, eventsHasMore, eventsLoadingMore])

  React.useEffect(() => {
    if (!live) return
    void refresh()
  }, [live, refresh])

  const onSlot = React.useCallback((payload: unknown) => {
    if (!liveRef.current) return
    const update = normalizeRealtimeSlot(payload)
    if (!update.id || update.siteId !== selectedSiteId) return
    if (selectedZoneId && update.zoneId !== selectedZoneId) return
    setSlots((current) => {
      const existing = current.find((slot) => slot.id === update.id)
      if (existing) return current.map((slot) => slot.id === update.id ? { ...slot, ...update } : slot)
      // Slot definitions normally arrive through REST, but accepting a complete
      // realtime payload prevents a newly provisioned slot from being invisible
      // until the next poll.
      if (!update.siteId || !update.zoneId || !(payload as any)?.data?.code && !(payload as any)?.code) return current
      return [...current, {
        id: update.id,
        siteId: update.siteId,
        zoneId: update.zoneId,
        code: (payload as any)?.data?.code || (payload as any)?.code,
        status: update.status || 'UNKNOWN',
        plate: update.plate || null,
        lastSeenAt: update.lastSeenAt || null,
        polygon: [],
      }]
    })
    setLastUpdatedAt(new Date().toISOString())
  }, [selectedSiteId, selectedZoneId])

  const onEvent = React.useCallback((payload: unknown) => {
    if (!liveRef.current) return
    const event = normalizeRealtimeEvent(payload)
    if (!event.id || event.siteId !== selectedSiteId) return
    if (selectedZoneId && event.zoneId && event.zoneId !== selectedZoneId) return
    if (eventFilter === 'ALL' || event.type === eventFilter) {
      setEvents((current) => [event, ...current.filter((item) => item.id !== event.id)].slice(0, Math.max(50, current.length)))
    }
    if (event.plate && event.type === 'VEHICLE_EXITED') {
      setSlots((current) => current.map((slot) => slot.plate === event.plate
        ? { ...slot, status: 'AVAILABLE', plate: null, lastSeenAt: event.occurredAt }
        : slot))
    } else if (event.plate && event.type === 'VEHICLE_RELOCATED' && event.slotId) {
      setSlots((current) => current.map((slot) => slot.id === event.slotId
        ? { ...slot, status: 'OCCUPIED', plate: event.plate, lastSeenAt: event.occurredAt }
        : slot.plate === event.plate ? { ...slot, status: 'AVAILABLE', plate: null, lastSeenAt: event.occurredAt } : slot))
    } else if (event.plate && event.type === 'VEHICLE_ENTERED' && event.slotId) {
      setSlots((current) => current.map((slot) => slot.id === event.slotId
        ? { ...slot, status: 'OCCUPIED', plate: event.plate, lastSeenAt: event.occurredAt }
        : slot))
    }
    setLastUpdatedAt(new Date().toISOString())
  }, [selectedSiteId, selectedZoneId, eventFilter])

  const onCameraHealth = React.useCallback((event: {
    cameraId: string
    siteId: string
    status: string
    lastFrameAt?: string
    occurredAt: string
  }) => {
    if (!liveRef.current) return
    if (event.siteId !== selectedSiteId) return
    setCameras((current) => current.map((camera) => {
      if (camera.id !== event.cameraId) return camera
      const status = event.status === 'online'
        ? 'ONLINE'
        : event.status === 'error'
          ? 'ERROR'
          : 'OFFLINE'
      return {
        ...camera,
        status,
        lastSeenAt: event.lastFrameAt || event.occurredAt || camera.lastSeenAt,
      }
    }))
    setLastUpdatedAt(new Date().toISOString())
  }, [selectedSiteId])

  // Disconnect STOMP while on idle sidebar routes (gate, vehicles list, users, …).
  const { state: realtime, error: realtimeError } = useDashboardRealtime(
    live ? selectedSiteId : null,
    onSlot,
    onEvent,
    refresh,
    onCameraHealth,
  )

  React.useEffect(() => {
    if (!live || !selectedSiteId || realtime === 'live') return
    let interval: number
    const schedule = () => {
      window.clearInterval(interval)
      interval = window.setInterval(() => void refresh(), document.hidden ? 60000 : 15000)
    }
    const onVisibilityChange = () => {
      schedule()
      if (!document.hidden) void refresh()
    }
    schedule()
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [live, selectedSiteId, realtime, refresh])

  const searchVehicles = React.useCallback(async (query: string) => {
    const normalized = query.trim().toUpperCase()
    const requestId = ++searchRequest.current
    setSearchQuery(normalized)
    setSearchError(null)
    if (!normalized) {
      setVehicles([]); setSearchStatus('idle'); return
    }
    if (!selectedSiteId) {
      setVehicles([]); setSearchStatus('error'); setSearchError('Vui lòng chọn site trước khi tìm kiếm'); return
    }
    try {
      setSearchStatus('loading')
      const result = await dashboardApi.searchVehicles(normalized, selectedSiteId)
      if (requestId !== searchRequest.current) return
      const scoped = result.filter((vehicle) => vehicle.siteId === selectedSiteId)
      setVehicles(scoped)
      setSearchStatus(scoped.length ? 'ready' : 'empty')
    } catch (reason) {
      if (requestId !== searchRequest.current) return
      setVehicles([])
      setSearchStatus('error')
      setSearchError(reason instanceof Error ? reason.message : 'Không thể tìm phương tiện')
    }
  }, [selectedSiteId])

  React.useEffect(() => {
    searchRequest.current += 1
    setVehicles([]); setSearchStatus('idle'); setSearchError(null); setSearchQuery('')
  }, [selectedSiteId])

  const value = React.useMemo(() => ({
    cameras, slots, events, eventsHasMore, eventsLoadingMore, analytics, vehicles, status, error, realtime,
    realtimeError, lastUpdatedAt, refresh, setEventFilter, loadMoreEvents,
    searchVehicles, searchStatus, searchError, searchQuery,
  }), [cameras, slots, events, eventsHasMore, eventsLoadingMore, analytics, vehicles, status, error, realtime, realtimeError, lastUpdatedAt, refresh, loadMoreEvents, searchVehicles, searchStatus, searchError, searchQuery])

  return <DashboardDataContext.Provider value={value}>{children}</DashboardDataContext.Provider>
}

export function useDashboardData() {
  const context = React.useContext(DashboardDataContext)
  if (!context) throw new Error('useDashboardData must be used within DashboardDataProvider')
  return context
}
