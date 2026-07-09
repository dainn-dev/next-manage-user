import { authApi } from "./auth-api"

import { getApiUrl } from './config'
import type {
  VehicleStatistics,
  VehicleDailyStats,
  VehicleWeeklyStats,
  VehicleMonthlyStats,
  EntryExitStats,
} from "@/lib/types"

// Re-export the canonical types so any existing imports of these names from
// this module keep resolving after the local interface declarations were moved
// to @/lib/types.
export type {
  VehicleStatistics,
  VehicleDailyStats,
  VehicleWeeklyStats,
  VehicleMonthlyStats,
  EntryExitStats,
}

const API_BASE_URL = getApiUrl()

// Raw backend shape (field names that differ from the frontend interface are
// documented inline). Kept loose/unknown so this layer tolerates schema drift
// (e.g. older backend without Stage 2.1 fields) without crashing.
function num(v: unknown): number {
  return typeof v === "number" && !Number.isNaN(v) ? v : 0
}

function str(v: unknown): string {
  return typeof v === "string" ? v : ""
}

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {}
}

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : []
}

function asStringRecord(v: unknown): Record<string, number> {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, number>)
    : {}
}

// The backend VehicleStatisticsDto uses gate-status field names
// (approvedVehicles / rejectedVehicles / exitedVehicles / enteredVehicles)
// that differ from the frontend interface (activeVehicles / inactiveVehicles /
// maintenanceVehicles / retiredVehicles). The backend's gate-status model has no
// maintenance/retired concept, so those default to 0. entryExitStats and the
// averageDailyRequests / peakDay / completedCount fields are populated by Stage
// 2.1 (VehicleLogService.getLogBasedStatistics); the defensive defaults below
// keep the UI safe when the backend omits them.
function normalizeEntryExitStats(raw: unknown): EntryExitStats {
  const s = asRecord(raw)
  return {
    totalRequests: num(s.totalRequests),
    approvedRequests: num(s.approvedRequests),
    pendingRequests: num(s.pendingRequests),
    completedRequests: num(s.completedRequests),
    entryRequests: num(s.entryRequests),
    exitRequests: num(s.exitRequests),
  }
}

function normalizePeakDay(raw: unknown): { date: string; requestCount: number } {
  const p = asRecord(raw)
  return {
    date: str(p.date),
    requestCount: num(p.requestCount),
  }
}

function normalizeDaily(raw: unknown): VehicleDailyStats {
  const d = asRecord(raw)
  return {
    date: str(d.date),
    entryCount: num(d.entryCount),
    exitCount: num(d.exitCount),
    totalRequests: num(d.totalRequests),
    approvedCount: num(d.approvedCount),
    pendingCount: num(d.pendingCount),
    completedCount: num(d.completedCount),
    rejectedCount: num(d.rejectedCount),
    uniqueVehicles: num(d.uniqueVehicles),
  }
}

function normalizeWeekly(raw: unknown): VehicleWeeklyStats {
  const w = asRecord(raw)
  return {
    week: num(w.week),
    startDate: str(w.startDate),
    endDate: str(w.endDate),
    entryCount: num(w.entryCount),
    exitCount: num(w.exitCount),
    totalRequests: num(w.totalRequests),
    approvedCount: num(w.approvedCount),
    pendingCount: num(w.pendingCount),
    completedCount: num(w.completedCount),
    rejectedCount: num(w.rejectedCount),
    uniqueVehicles: num(w.uniqueVehicles),
    averageDailyRequests: num(w.averageDailyRequests),
  }
}

function normalizeMonthly(raw: unknown): VehicleMonthlyStats {
  const m = asRecord(raw)
  return {
    month: num(m.month),
    year: num(m.year),
    entryCount: num(m.entryCount),
    exitCount: num(m.exitCount),
    totalRequests: num(m.totalRequests),
    approvedCount: num(m.approvedCount),
    pendingCount: num(m.pendingCount),
    completedCount: num(m.completedCount),
    rejectedCount: num(m.rejectedCount),
    uniqueVehicles: num(m.uniqueVehicles),
    averageDailyRequests: num(m.averageDailyRequests),
    peakDay: normalizePeakDay(m.peakDay),
  }
}

export function normalizeVehicleStatistics(raw: unknown): VehicleStatistics {
  const r = asRecord(raw)
  return {
    totalVehicles: num(r.totalVehicles),
    // activeVehicles = approved (đã duyệt) vehicles; inactiveVehicles = rejected.
    activeVehicles: num(r.activeVehicles ?? r.approvedVehicles),
    inactiveVehicles: num(r.inactiveVehicles ?? r.rejectedVehicles),
    maintenanceVehicles: num(r.maintenanceVehicles),
    retiredVehicles: num(r.retiredVehicles),
    vehicleTypeStats: asStringRecord(r.vehicleTypeStats),
    fuelTypeStats: asStringRecord(r.fuelTypeStats),
    entryExitStats: normalizeEntryExitStats(r.entryExitStats),
    dailyStats: asArray(r.dailyStats).map(normalizeDaily),
    weeklyStats: asArray(r.weeklyStats).map(normalizeWeekly),
    monthlyStats: asArray(r.monthlyStats).map(normalizeMonthly),
  }
}

function defaultStatistics(): VehicleStatistics {
  return {
    totalVehicles: 0,
    activeVehicles: 0,
    inactiveVehicles: 0,
    maintenanceVehicles: 0,
    retiredVehicles: 0,
    vehicleTypeStats: {},
    fuelTypeStats: {},
    entryExitStats: {
      totalRequests: 0,
      approvedRequests: 0,
      pendingRequests: 0,
      completedRequests: 0,
      entryRequests: 0,
      exitRequests: 0,
    },
    dailyStats: [],
    weeklyStats: [],
    monthlyStats: [],
  }
}

class VehicleStatisticsApi {
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`

    const config: RequestInit = {
      headers: {
        ...authApi.getAuthHeaders(),
        ...options.headers,
      },
      ...options,
    }

    try {
      const response = await fetch(url, config)

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`HTTP ${response.status}: ${errorText}`)
      }

      const data = await response.json()
      return data
    } catch (error) {
      console.error(`API Error [${endpoint}]:`, error)
      throw error
    }
  }

  /**
   * Get comprehensive vehicle statistics, normalized to the frontend interface.
   */
  async getVehicleStatistics(): Promise<VehicleStatistics> {
    try {
      const raw = await this.request<unknown>('/vehicles/statistics/overview')
      return normalizeVehicleStatistics(raw)
    } catch (error) {
      console.warn('Failed to fetch vehicle statistics, returning default values:', error)
      return defaultStatistics()
    }
  }
}

export const vehicleStatisticsApi = new VehicleStatisticsApi()