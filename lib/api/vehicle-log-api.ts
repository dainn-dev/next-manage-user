import { authApi } from "./auth-api"

import { getApiUrl } from './config'

const API_BASE_URL = getApiUrl()

export interface VehicleLog {
  id: string
  licensePlateNumber: string
  vehicleId?: string
  employeeId?: string
  employeeName?: string
  employeeAvatar?: string
  employeeDepartment?: string
  employeePosition?: string
  entryExitTime: string
  type: 'entry' | 'exit'
  vehicleType: 'internal' | 'external'
  driverName?: string
  purpose?: string
  gateLocation?: string
  securityGuardId?: string
  securityGuardName?: string
  notes?: string
  imagePath?: string
  createdAt: string
  updatedAt: string
  vehicleBrand?: string
  vehicleModel?: string
  vehicleColor?: string
  vehicleImagePath?: string
}

export interface VehicleLogPage {
  content: VehicleLog[]
  totalElements: number
  totalPages: number
  size: number
  number: number
  first: boolean
  last: boolean
}

export interface VehicleLogStatistics {
  entryCount: number
  exitCount: number
  uniqueVehicles: number
}

export interface EmployeeVehicleInfo {
  // Employee information
  employeeId: string
  employeeName: string
  firstName?: string
  lastName?: string
  department: string
  position: string
  rank?: string
  jobTitle?: string
  militaryCivilian?: string
  phone: string
  email: string
  location?: string
  avatar?: string
  
  // Vehicle information
  vehicleId: string
  licensePlateNumber: string
  brand?: string
  model?: string
  color?: string
  vehicleType?: string
  year?: number
  engineNumber?: string
  chassisNumber?: string
  registrationDate?: string
  expiryDate?: string
  
  // Latest log information
  logId?: string
  logType: string
  logTime?: string
  driverName?: string
  purpose?: string
  gateLocation?: string
  notes?: string
}

export const vehicleLogApi = {
  // Get paginated vehicle logs
  getAllVehicleLogs: async (page = 0, size = 10, sortBy = 'entryExitTime', sortDir = 'desc'): Promise<VehicleLogPage> => {
    const response = await fetch(`${API_BASE_URL}/vehicle-logs?page=${page}&size=${size}&sortBy=${sortBy}&sortDir=${sortDir}`, {
      headers: {
        ...authApi.getAuthHeaders(),
      },
    })
    if (!response.ok) {
      throw new Error('Failed to fetch vehicle logs')
    }
    return response.json()
  },

  // Get all vehicle logs as list
  getAllVehicleLogsList: async (): Promise<VehicleLog[]> => {
    const response = await fetch(`${API_BASE_URL}/vehicle-logs/list`, {
      headers: {
        ...authApi.getAuthHeaders(),
      },
    })
    if (!response.ok) {
      throw new Error('Failed to fetch vehicle logs list')
    }
    return response.json()
  },

  // Get vehicle log by ID
  getVehicleLogById: async (id: string): Promise<VehicleLog> => {
    const response = await fetch(`${API_BASE_URL}/vehicle-logs/${id}`, {
      headers: {
        ...authApi.getAuthHeaders(),
      },
    })
    if (!response.ok) {
      throw new Error('Failed to fetch vehicle log')
    }
    return response.json()
  },

  // Get today's logs
  getTodayLogs: async (page = 0, size = 10): Promise<VehicleLogPage> => {
    const response = await fetch(`${API_BASE_URL}/vehicle-logs/today?page=${page}&size=${size}`, {
      headers: {
        ...authApi.getAuthHeaders(),
      },
    })
    if (!response.ok) {
      throw new Error('Failed to fetch today logs')
    }
    return response.json()
  },

  // Get weekly logs
  getWeeklyLogs: async (page = 0, size = 10): Promise<VehicleLogPage> => {
    const response = await fetch(`${API_BASE_URL}/vehicle-logs/weekly?page=${page}&size=${size}`, {
      headers: {
        ...authApi.getAuthHeaders(),
      },
    })
    if (!response.ok) {
      throw new Error('Failed to fetch weekly logs')
    }
    return response.json()
  },

  // Get monthly logs
  getMonthlyLogs: async (page = 0, size = 10): Promise<VehicleLogPage> => {
    const response = await fetch(`${API_BASE_URL}/vehicle-logs/monthly?page=${page}&size=${size}`, {
      headers: {
        ...authApi.getAuthHeaders(),
      },
    })
    if (!response.ok) {
      throw new Error('Failed to fetch monthly logs')
    }
    return response.json()
  },

  // Get logs by date range
  getVehicleLogsByDateRange: async (
    startDate: string, 
    endDate: string, 
    page = 0, 
    size = 10
  ): Promise<VehicleLogPage> => {
    const response = await fetch(
      `${API_BASE_URL}/vehicle-logs/date-range?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}&page=${page}&size=${size}`,
      {
        headers: {
          ...authApi.getAuthHeaders(),
        },
      }
    )
    if (!response.ok) {
      throw new Error('Failed to fetch vehicle logs by date range')
    }
    return response.json()
  },

  // Search vehicle logs
  searchVehicleLogs: async (params: {
    licensePlate?: string
    type?: 'entry' | 'exit'
    vehicleType?: 'internal' | 'external'
    driverName?: string
    startDate: string
    endDate: string
    page?: number
    size?: number
  }): Promise<VehicleLogPage> => {
    const searchParams = new URLSearchParams()
    
    if (params.licensePlate) searchParams.append('licensePlate', params.licensePlate)
    if (params.type) searchParams.append('type', params.type)
    if (params.vehicleType) searchParams.append('vehicleType', params.vehicleType)
    if (params.driverName) searchParams.append('driverName', params.driverName)
    searchParams.append('startDate', params.startDate)
    searchParams.append('endDate', params.endDate)
    searchParams.append('page', (params.page || 0).toString())
    searchParams.append('size', (params.size || 10).toString())

    const response = await fetch(`${API_BASE_URL}/vehicle-logs/search?${searchParams.toString()}`, {
      headers: {
        ...authApi.getAuthHeaders(),
      },
    })
    if (!response.ok) {
      throw new Error('Failed to search vehicle logs')
    }
    return response.json()
  },

  // Create vehicle log
  createVehicleLog: async (vehicleLog: Omit<VehicleLog, 'id' | 'createdAt' | 'updatedAt'>): Promise<VehicleLog> => {
    const response = await fetch(`${API_BASE_URL}/vehicle-logs`, {
      method: 'POST',
      headers: {
        ...authApi.getAuthHeaders(),
      },
      body: JSON.stringify(vehicleLog),
    })
    if (!response.ok) {
      throw new Error('Failed to create vehicle log')
    }
    return response.json()
  },

  // Update vehicle log
  updateVehicleLog: async (id: string, vehicleLog: Partial<VehicleLog>): Promise<VehicleLog> => {
    const response = await fetch(`${API_BASE_URL}/vehicle-logs/${id}`, {
      method: 'PUT',
      headers: {
        ...authApi.getAuthHeaders(),
      },
      body: JSON.stringify(vehicleLog),
    })
    if (!response.ok) {
      throw new Error('Failed to update vehicle log')
    }
    return response.json()
  },

  // Delete vehicle log
  deleteVehicleLog: async (id: string): Promise<void> => {
    const response = await fetch(`${API_BASE_URL}/vehicle-logs/${id}`, {
      method: 'DELETE',
      headers: {
        ...authApi.getAuthHeaders(),
      },
    })
    if (!response.ok) {
      throw new Error('Failed to delete vehicle log')
    }
  },

  // Get today's statistics
  getTodayStatistics: async (): Promise<VehicleLogStatistics> => {
    const response = await fetch(`${API_BASE_URL}/vehicle-logs/statistics/today`, {
      headers: {
        ...authApi.getAuthHeaders(),
      },
    })
    if (!response.ok) {
      throw new Error('Failed to fetch today statistics')
    }
    return response.json()
  },

  // Get employee info by license plate and type
  getEmployeeInfoByLicensePlate: async (licensePlateNumber: string, type: 'entry' | 'exit'): Promise<EmployeeVehicleInfo> => {
    const response = await fetch(`${API_BASE_URL}/vehicle-logs/employee-info?licensePlateNumber=${encodeURIComponent(licensePlateNumber)}&type=${type.toLowerCase()}`, {
      headers: {
        ...authApi.getAuthHeaders(),
      },
    })
    if (!response.ok) {
      throw new Error('Failed to fetch employee info')
    }
    return response.json()
  },

  // Check vehicle (triggers WebSocket notification)
  checkVehicle: async (licensePlateNumber: string, type: 'entry' | 'exit', additionalData?: {
    driverName?: string
    purpose?: string
    gateLocation?: string
    notes?: string
  }) => {
    const response = await fetch(`${API_BASE_URL}/vehicle-check`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        licensePlateNumber,
        type: type.toLowerCase(),
        ...additionalData
      })
    })
    if (!response.ok) {
      throw new Error('Failed to check vehicle')
    }
    return response.json()
  },

  // Test vehicle check endpoint
  testVehicleCheck: async (licensePlateNumber: string, type: 'entry' | 'exit') => {
    const response = await fetch(`${API_BASE_URL}/vehicle-check/test?licensePlateNumber=${encodeURIComponent(licensePlateNumber)}&type=${type.toLowerCase()}`)
    if (!response.ok) {
      throw new Error('Failed to test vehicle check')
    }
    return response.json()
  }
}
