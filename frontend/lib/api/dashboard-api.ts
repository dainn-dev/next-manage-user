import { authApi } from './auth-api'
import { getApiUrl, getBaseUrl } from './config'
import { canonicalPlate } from '../plate-search.mjs'

const API_BASE_URL = getApiUrl()

export type OccupancyStatus = 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'DISABLED' | 'UNKNOWN'

export interface DashboardCamera {
  id: string
  siteId: string
  zoneId: string | null
  name: string
  status: string
  lastSeenAt: string | null
  streamUrl: string | null
  snapshotUrl: string | null
  streamKind: string | null
  streamExpiresAt: string | null
}

export interface DashboardSlot {
  id: string
  siteId: string
  zoneId: string
  code: string
  status: OccupancyStatus
  plate: string | null
  lastSeenAt: string | null
  polygon: Array<{ x: number; y: number }>
}

export interface DashboardEvent {
  id: string
  siteId: string
  type: string
  occurredAt: string
  plate: string | null
  cameraId?: string | null
  slotId?: string | null
  zoneId?: string | null
  version?: number
  snapshotUrl?: string | null
}

export interface DashboardEventPage {
  content: DashboardEvent[]
  page: number
  size: number
  totalElements: number
  hasNext: boolean
}

export interface DashboardAnalytics {
  entries: number
  exits: number
  uniqueVehicles: number
  totalVehicles: number
  activeVehicles: number
  averageDwellSeconds: number
  completedDwellSessions: number
}

export interface DashboardVehicleSearchResult {
  id: string
  licensePlateNumber: string
  siteId: string
  status?: string
  currentSlotId: string | null
  currentSlotCode: string | null
  currentZoneId: string | null
  lastSeenAt: string | null
  lastEventType: string | null
  snapshotUrl: string | null
  [key: string]: unknown
}

async function request<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, { headers: authApi.getAuthHeaders() })
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body.message || `Request failed (${response.status})`)
  }
  return response.json()
}

function occupancyStatus(value: unknown): OccupancyStatus {
  const normalized = String(value || '').toUpperCase()
  if (normalized === 'FREE') return 'AVAILABLE'
  return ['AVAILABLE', 'OCCUPIED', 'RESERVED', 'DISABLED'].includes(normalized)
    ? normalized as OccupancyStatus
    : 'UNKNOWN'
}

function polygonPoints(value: unknown): Array<{ x: number; y: number }> {
  if (!Array.isArray(value)) return []
  return value.flatMap((point: any) => {
    const x = Array.isArray(point) ? Number(point[0]) : Number(point?.x)
    const y = Array.isArray(point) ? Number(point[1]) : Number(point?.y)
    return Number.isFinite(x) && Number.isFinite(y) ? [{ x, y }] : []
  })
}

function eventType(value: unknown): string {
  const normalized = String(value || 'UNKNOWN').toUpperCase()
  if (normalized === 'ENTRY') return 'VEHICLE_ENTERED'
  if (normalized === 'EXIT') return 'VEHICLE_EXITED'
  return normalized
}

function mediaUrl(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null
  if (value.startsWith('/')) return `${getBaseUrl()}${value}`
  try {
    const url = new URL(value)
    return ['http:', 'https:', 'wss:'].includes(url.protocol) ? url.toString() : null
  } catch {
    return null
  }
}

export const dashboardApi = {
  async cameras(siteId: string, zoneId?: string | null): Promise<DashboardCamera[]> {
    const params = new URLSearchParams({ siteId })
    if (zoneId) params.set('zoneId', zoneId)
    const rows = await request<any[]>(`/cameras?${params}`)
    return rows.filter((row) => !zoneId || row.zoneId === zoneId).map((row) => ({
      id: row.id, siteId: row.siteId, zoneId: row.zoneId || null, name: row.name,
      status: String(row.status || 'UNKNOWN').toUpperCase(),
      lastSeenAt: row.lastHeartbeatAt || row.lastSeenAt || null,
      streamUrl: mediaUrl(row.stream?.url || row.hlsUrl || row.webrtcUrl || row.mjpegUrl),
      snapshotUrl: mediaUrl(row.snapshotUrl || row.latestSnapshotUrl),
      streamKind: row.stream?.kind
        ? String(row.stream.kind).toUpperCase()
        : (row.hlsUrl ? 'HLS' : row.webrtcUrl ? 'WEBRTC' : row.mjpegUrl ? 'MJPEG' : null),
      streamExpiresAt: row.stream?.expiresAt || null,
    }))
  },

  async slots(siteId: string, zoneId?: string | null): Promise<DashboardSlot[]> {
    const [definitions, occupancy] = await Promise.all([
      request<any[]>(`/sites/${siteId}/parking-slots`),
      request<any[]>(`/sites/${siteId}/parking-slots/occupancy`),
    ])
    const occupied = new Map(occupancy.map((row) => [row.slotId, row]))
    return definitions.filter((row) => !zoneId || row.zoneId === zoneId).map((row) => {
      const current = occupied.get(row.id)
      return {
        id: row.id, siteId, zoneId: row.zoneId, code: row.code,
        status: occupancyStatus(current?.status || row.adminStatus),
        plate: current?.plate || null, lastSeenAt: current?.lastSeenAt || null,
        polygon: polygonPoints(row.polygon),
      }
    })
  },

  async events(siteId: string, zoneId?: string | null, page = 0, type?: string | null): Promise<DashboardEventPage> {
    const params = new URLSearchParams({ page: String(page), size: '50' })
    if (zoneId) params.set('zoneId', zoneId)
    if (type && type !== 'ALL') params.set('type', type)
    const result = await request<any>(`/sites/${siteId}/events?${params}`)
    const rows = result.content || []
    return {
      content: rows.map((row: any) => ({
        ...row, type: eventType(row.type), snapshotUrl: mediaUrl(row.snapshotUrl),
      })),
      page: result.page || 0, size: result.size || 50,
      totalElements: result.totalElements || 0, hasNext: !!result.hasNext,
    }
  },

  async analytics(siteId: string): Promise<DashboardAnalytics> {
    const [today, vehicles, dwell] = await Promise.all([
      request<any>('/vehicle-logs/statistics/today'),
      request<any>('/vehicles/statistics/overview'),
      request<any>(`/sites/${siteId}/analytics/average-dwell`),
    ])
    return {
      entries: today.entryCount || 0, exits: today.exitCount || 0,
      uniqueVehicles: today.uniqueVehicles || 0,
      totalVehicles: vehicles.totalVehicles || 0, activeVehicles: vehicles.activeVehicles || 0,
      averageDwellSeconds: Number(dwell.averageDwellSeconds) || 0,
      completedDwellSessions: Number(dwell.completedSessions) || 0,
    }
  },

  async searchVehicles(query: string, siteId: string): Promise<DashboardVehicleSearchResult[]> {
    const normalized = canonicalPlate(query)
    if (normalized.length < 2) return []
    const params = new URLSearchParams({ plate: normalized, siteId, size: '20' })
    const page = await request<any>(`/vehicles/plate-search?${params}`)
    const rows = Array.isArray(page) ? page : page.content || []
    return rows.map((row: any) => ({ ...row, snapshotUrl: mediaUrl(row.snapshotUrl) }))
  },
}

export function normalizeRealtimeSlot(payload: any): Partial<DashboardSlot> & { id: string } {
  const data = payload?.data || payload
  return {
    id: data.slotId || data.id,
    siteId: payload?.siteId || data.siteId,
    zoneId: data.zoneId,
    status: occupancyStatus(data.status),
    plate: data.plate || null,
    lastSeenAt: data.lastSeenAt || data.since || payload?.occurredAt || null,
  }
}

export function normalizeRealtimeEvent(payload: any): DashboardEvent {
  const data = payload?.data || payload
  return {
    id: payload?.eventId || data.id,
    siteId: payload?.siteId || data.siteId,
    type: eventType(payload?.type || data.type),
    occurredAt: payload?.occurredAt || data.occurredAt || new Date().toISOString(),
    plate: data.plate || data.licensePlateNumber || null,
    cameraId: data.cameraId || null, slotId: data.slotId || null, zoneId: data.zoneId || null, version: data.version,
    snapshotUrl: mediaUrl(data.snapshotUrl || data.imageUrl || data.imagePath),
  }
}
