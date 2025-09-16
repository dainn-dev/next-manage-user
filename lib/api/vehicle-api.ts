import type { Vehicle } from "@/lib/types"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api'

export interface VehicleApiResponse {
  content: Vehicle[]
  totalElements: number
  totalPages: number
  size: number
  number: number
  first: boolean
  last: boolean
}

export interface VehicleCreateRequest {
  employeeId: string
  employeeName: string
  licensePlate: string
  vehicleType: "car" | "motorbike" | "truck" | "bus"
  brand?: string
  model?: string
  color?: string
  year?: number
  engineNumber?: string
  chassisNumber?: string
  registrationDate: string
  expiryDate?: string
  insuranceNumber?: string
  insuranceExpiry?: string
  status: "active" | "inactive" | "maintenance" | "retired"
  fuelType?: "gasoline" | "diesel" | "electric" | "hybrid"
  capacity?: number
  notes?: string
}

export interface VehicleUpdateRequest extends VehicleCreateRequest {
  id: string
}

export interface VehicleCreateResponse {
  vehicle: Vehicle
  alreadyExists: boolean
  message: string
}

class VehicleApiService {
  private baseUrl = `${API_BASE_URL}/vehicles`
  private requestCache = new Map<string, Promise<any>>()

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`
    const cacheKey = `${options.method || 'GET'}:${url}`
    
    // Check if request is already in progress
    if (this.requestCache.has(cacheKey)) {
      return this.requestCache.get(cacheKey)!
    }
    
    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    }

    const requestPromise = this.executeRequest<T>(url, config)
    this.requestCache.set(cacheKey, requestPromise)
    
    try {
      const result = await requestPromise
      return result
    } finally {
      // Clean up cache after request completes
      this.requestCache.delete(cacheKey)
    }
  }

  private async executeRequest<T>(
    url: string,
    config: RequestInit
  ): Promise<T> {
    try {
      const response = await fetch(url, config)
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`)
      }

      // Handle 204 No Content responses
      if (response.status === 204) {
        return {} as T
      }

      return await response.json()
    } catch (error) {
      console.error(`API request failed for ${url}:`, error)
      throw error
    }
  }

  // Get all vehicles with pagination
  async getAllVehicles(
    page: number = 0,
    size: number = 10,
    sortBy: string = 'createdAt',
    sortDir: string = 'desc'
  ): Promise<VehicleApiResponse> {
    const params = new URLSearchParams({
      page: page.toString(),
      size: size.toString(),
      sortBy,
      sortDir,
    })
    
    return this.request<VehicleApiResponse>(`?${params}`)
  }

  // Get all vehicles as list (no pagination)
  async getAllVehiclesList(): Promise<Vehicle[]> {
    return this.request<Vehicle[]>('/list')
  }

  // Get vehicle by ID
  async getVehicleById(id: string): Promise<Vehicle> {
    return this.request<Vehicle>(`/${id}`)
  }

  // Get vehicle by license plate
  async getVehicleByLicensePlate(licensePlate: string): Promise<Vehicle> {
    return this.request<Vehicle>(`/license-plate/${encodeURIComponent(licensePlate)}`)
  }

  // Get vehicles by employee
  async getVehiclesByEmployee(employeeId: string): Promise<Vehicle[]> {
    return this.request<Vehicle[]>(`/employee/${employeeId}`)
  }

  // Get vehicles by type
  async getVehiclesByType(vehicleType: string): Promise<Vehicle[]> {
    return this.request<Vehicle[]>(`/type/${vehicleType}`)
  }

  // Get vehicles by status
  async getVehiclesByStatus(status: string): Promise<Vehicle[]> {
    return this.request<Vehicle[]>(`/status/${status}`)
  }

  // Search vehicles
  async searchVehicles(
    searchTerm: string,
    page: number = 0,
    size: number = 10,
    sortBy: string = 'createdAt',
    sortDir: string = 'desc'
  ): Promise<VehicleApiResponse> {
    const params = new URLSearchParams({
      searchTerm,
      page: page.toString(),
      size: size.toString(),
      sortBy,
      sortDir,
    })
    
    return this.request<VehicleApiResponse>(`/search?${params}`)
  }

  // Search vehicles by type
  async searchVehiclesByType(
    vehicleType: string,
    searchTerm: string,
    page: number = 0,
    size: number = 10,
    sortBy: string = 'createdAt',
    sortDir: string = 'desc'
  ): Promise<VehicleApiResponse> {
    const params = new URLSearchParams({
      searchTerm,
      page: page.toString(),
      size: size.toString(),
      sortBy,
      sortDir,
    })
    
    return this.request<VehicleApiResponse>(`/search/type/${vehicleType}?${params}`)
  }

  // Search vehicles by status
  async searchVehiclesByStatus(
    status: string,
    searchTerm: string,
    page: number = 0,
    size: number = 10,
    sortBy: string = 'createdAt',
    sortDir: string = 'desc'
  ): Promise<VehicleApiResponse> {
    const params = new URLSearchParams({
      searchTerm,
      page: page.toString(),
      size: size.toString(),
      sortBy,
      sortDir,
    })
    
    return this.request<VehicleApiResponse>(`/search/status/${status}?${params}`)
  }

  // Create vehicle
  async createVehicle(data: VehicleCreateRequest): Promise<VehicleCreateResponse> {
    return this.request<VehicleCreateResponse>('', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  // Update vehicle
  async updateVehicle(id: string, data: VehicleCreateRequest): Promise<Vehicle> {
    return this.request<Vehicle>(`/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  // Delete vehicle
  async deleteVehicle(id: string): Promise<void> {
    return this.request<void>(`/${id}`, {
      method: 'DELETE',
    })
  }

  // Check if license plate exists
  async existsByLicensePlate(licensePlate: string): Promise<boolean> {
    return this.request<boolean>(`/exists/license-plate/${encodeURIComponent(licensePlate)}`)
  }

  // Get vehicle count by status
  async getVehicleCountByStatus(status: string): Promise<number> {
    return this.request<number>(`/stats/count/status/${status}`)
  }

  // Get vehicle count by type
  async getVehicleCountByType(): Promise<Array<[string, number]>> {
    return this.request<Array<[string, number]>>('/stats/count/type')
  }

  // Get vehicle count by fuel type
  async getVehicleCountByFuelType(): Promise<Array<[string, number]>> {
    return this.request<Array<[string, number]>>('/stats/count/fuel-type')
  }
}

// Export singleton instance
export const vehicleApi = new VehicleApiService()
