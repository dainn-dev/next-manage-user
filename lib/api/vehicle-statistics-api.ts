const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api'

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
  uniqueVehicles: number
  averageDailyRequests: number
  peakDay: { date: string; requestCount: number }
}

class VehicleStatisticsApi {
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`
    
    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
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
    return this.request<VehicleStatistics>('/vehicles/statistics/overview')
  }
}

export const vehicleStatisticsApi = new VehicleStatisticsApi()
