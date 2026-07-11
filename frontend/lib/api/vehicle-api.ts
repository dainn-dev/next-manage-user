import type { Vehicle } from "@/lib/types"
import { authApi } from "./auth-api"

import { getApiUrl } from './config'

const API_BASE_URL = getApiUrl()

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
  status: "approved" | "rejected" | "exited" | "entered"
  fuelType?: "gasoline" | "diesel" | "electric" | "hybrid"
  capacity?: number
  notes?: string
  imagePath?: string
  currentSiteId?: string
}

export interface VehicleUpdateRequest extends VehicleCreateRequest {
  id: string
}

export interface VehicleCreateResponse {
  vehicle: Vehicle
  alreadyExists: boolean
  message: string
}

export interface VehicleImportRowError {
  row: number
  licensePlate?: string
  message: string
}

export interface VehicleImportResult {
  totalRows: number
  successCount: number
  skippedCount: number
  failureCount: number
  errors: VehicleImportRowError[]
}

/** Map FE vehicle payload to backend VehicleDto field names. */
function toBackendVehicleBody(data: VehicleCreateRequest) {
  return {
    ownerId: data.employeeId,
    licensePlate: data.licensePlate,
    vehicleType: data.vehicleType,
    brand: data.brand,
    model: data.model,
    color: data.color,
    year: data.year,
    registrationDate: data.registrationDate,
    expiryDate: data.expiryDate,
    status: data.status,
    fuelType: data.fuelType,
    capacity: data.capacity,
    notes: data.notes,
    imagePath: data.imagePath,
    currentSiteId: data.currentSiteId || null,
  }
}

function normalizeOneVehicle(v: any): Vehicle {
  if (!v || typeof v !== 'object') return v
  return {
    ...v,
    employeeId: v.employeeId || v.ownerId || '',
    employeeName: v.employeeName || v.ownerName || '',
    currentSiteId: v.currentSiteId || undefined,
  }
}

function normalizeVehiclePayload(raw: any): any {
  if (Array.isArray(raw)) {
    return raw.map(normalizeOneVehicle)
  }
  if (raw && Array.isArray(raw.content)) {
    return { ...raw, content: raw.content.map(normalizeOneVehicle) }
  }
  if (raw && raw.vehicle) {
    return { ...raw, vehicle: normalizeOneVehicle(raw.vehicle) }
  }
  if (raw && (raw.ownerId || raw.licensePlate)) {
    return normalizeOneVehicle(raw)
  }
  return raw
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
        ...authApi.getAuthHeaders(),
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

      const raw = await response.json()
      return normalizeVehiclePayload(raw) as T
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
      body: JSON.stringify(toBackendVehicleBody(data)),
    })
  }

  // Update vehicle
  async updateVehicle(id: string, data: VehicleCreateRequest): Promise<Vehicle> {
    return this.request<Vehicle>(`/${id}`, {
      method: 'PUT',
      body: JSON.stringify(toBackendVehicleBody(data)),
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

  // Upload vehicle image
  async uploadVehicleImage(vehicleId: string, imageFile: File): Promise<string> {
    const formData = new FormData()
    formData.append('image', imageFile)
    
    // Get auth headers but remove Content-Type as it will be set automatically for FormData
    const authHeaders = authApi.getAuthHeaders()
    const { 'Content-Type': _, ...headersWithoutContentType } = authHeaders
    
    const response = await fetch(`${this.baseUrl}/upload-image/${vehicleId}`, {
      method: 'POST',
      headers: headersWithoutContentType,
      body: formData,
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(errorText || `HTTP error! status: ${response.status}`)
    }
    
    return response.text() // Returns the image path
  }

  // Download the .xlsx bulk-import template
  async downloadImportTemplate(): Promise<Blob> {
    const { 'Content-Type': _ct, ...headers } = authApi.getAuthHeaders()
    const response = await fetch(`${this.baseUrl}/export/template`, { headers })
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    return response.blob()
  }

  // Export vehicles (selectable columns) to Excel/CSV -> Blob
  async exportVehicles(fields: string[], format: 'excel' | 'csv' = 'excel'): Promise<Blob> {
    const params = new URLSearchParams()
    if (fields.length) params.append('fields', fields.join(','))
    params.append('format', format)
    const { 'Content-Type': _ct, ...headers } = authApi.getAuthHeaders()
    const response = await fetch(`${this.baseUrl}/export?${params.toString()}`, { headers })
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    return response.blob()
  }

  // Bulk import vehicles from an Excel/CSV file
  async importVehicles(file: File): Promise<VehicleImportResult> {
    const formData = new FormData()
    formData.append('file', file)

    // Let the browser set the multipart Content-Type (with boundary)
    const { 'Content-Type': _ct, ...headers } = authApi.getAuthHeaders()

    const response = await fetch(`${this.baseUrl}/import`, {
      method: 'POST',
      headers,
      body: formData,
    })
    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(errorText || `HTTP error! status: ${response.status}`)
    }
    return response.json()
  }
}

// Export singleton instance
export const vehicleApi = new VehicleApiService()
