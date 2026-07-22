import { authApi } from './auth-api'
import { getApiUrl } from './config'

const API_BASE_URL = getApiUrl()

export interface Zone {
  id: string
  siteId: string
  floorId?: string | null
  name: string
  createdAt?: string
  updatedAt?: string
}

class ZoneApi {
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

  list(siteId: string): Promise<Zone[]> {
    return this.request<Zone[]>(`/zones?${new URLSearchParams({ siteId })}`)
  }

  create(siteId: string, name: string, floorId?: string | null): Promise<Zone> {
    return this.request<Zone>('/zones', {
      method: 'POST',
      body: JSON.stringify({ siteId, name, floorId }),
    })
  }

  update(zone: Pick<Zone, 'id' | 'siteId' | 'name'> & { floorId?: string | null }): Promise<Zone> {
    return this.request<Zone>(`/zones/${zone.id}`, {
      method: 'PUT',
      body: JSON.stringify(zone),
    })
  }

  delete(id: string): Promise<void> {
    return this.request<void>(`/zones/${id}`, { method: 'DELETE' })
  }
}

export const zoneApi = new ZoneApi()
