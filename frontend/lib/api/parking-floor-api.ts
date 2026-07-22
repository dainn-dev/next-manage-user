import { authApi } from './auth-api'
import { getApiUrl } from './config'

const API_BASE_URL = getApiUrl()

export interface ParkingFloor {
  id: string
  siteId: string
  name: string
  levelNumber: number
  sortOrder: number
  backgroundImageUrl?: string | null
  createdAt?: string
  updatedAt?: string
}

export interface ParkingFloorWriteRequest {
  siteId: string
  name: string
  levelNumber: number
  sortOrder?: number
  backgroundImageUrl?: string | null
}

class ParkingFloorApi {
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: { ...authApi.getAuthHeaders(), ...options.headers },
    })
    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      throw new Error(body.message || `Request failed (${response.status})`)
    }
    if (response.status === 204) return undefined as T
    return response.json()
  }

  list(siteId: string): Promise<ParkingFloor[]> {
    return this.request<ParkingFloor[]>(`/parking-floors?${new URLSearchParams({ siteId })}`)
  }

  create(request: ParkingFloorWriteRequest): Promise<ParkingFloor> {
    return this.request<ParkingFloor>('/parking-floors', { method: 'POST', body: JSON.stringify(request) })
  }

  update(id: string, request: Partial<ParkingFloorWriteRequest>): Promise<ParkingFloor> {
    return this.request<ParkingFloor>(`/parking-floors/${id}`, { method: 'PUT', body: JSON.stringify(request) })
  }

  delete(id: string): Promise<void> {
    return this.request<void>(`/parking-floors/${id}`, { method: 'DELETE' })
  }
}

export const parkingFloorApi = new ParkingFloorApi()
