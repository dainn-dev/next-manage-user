import { authApi } from "./auth-api"

import { getApiUrl } from './config'

const API_BASE_URL = getApiUrl()

export interface VehicleStatistics {
  totalVehicles: number
  activeVehicles: number
  inactiveVehicles: number
  maintenanceVehicles: number
  retiredVehicles: number
  vehicleTypeStats: Record<string, number>
  fuelTypeStats: Record<string, number>
  entryExitStats: {
    totalRequests: number
    approvedRequests: number
    pendingRequests: number
    completedRequests: number
    entryRequests: number
    exitRequests: number
  }
  dailyStats: VehicleDailyStats[]
  weeklyStats: VehicleWeeklyStats[]
  monthlyStats: VehicleMonthlyStats[]
}

export interface VehicleDailyStats {
  date: string
  entryCount: number
  exitCount: number
  totalRequests: number
  approvedCount: number
  pendingCount: number
  completedCount: number
  rejectedCount: number
  uniqueVehicles: number
}

export interface VehicleWeeklyStats {
  week: number
  startDate: string
  endDate: string
  entryCount: number
  exitCount: number
  totalRequests: number
  approvedCount: number
  pendingCount: number
  completedCount: number
  rejectedCount: number
  uniqueVehicles: number
  averageDailyRequests: number
}

export interface VehicleMonthlyStats {
  month: number
  year: number
  entryCount: number
  exitCount: number
  totalRequests: number
  approvedCount: number
  pendingCount: number
  completedCount: number
  rejectedCount: number
  uniqueVehicles: number
  averageDailyRequests: number
  peakDay: { date: string; requestCount: number }
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
   * Get comprehensive vehicle statistics
   */
  async getVehicleStatistics(): Promise<VehicleStatistics> {
    try {
      return await this.request<VehicleStatistics>('/vehicles/statistics/overview')
    } catch (error) {
      console.warn('Failed to fetch vehicle statistics, returning default values:', error)
      // Return default statistics when API fails
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
  }
}

export const vehicleStatisticsApi = new VehicleStatisticsApi()
