import { authApi } from './auth-api'
import { getApiUrl } from './config'

const API_BASE_URL = getApiUrl()

export interface Zone {
  id: string
  siteId: string
  name: string
}

class ZoneApi {
  async list(siteId: string): Promise<Zone[]> {
    const params = new URLSearchParams({ siteId })
    const response = await fetch(`${API_BASE_URL}/zones?${params}`, {
      headers: authApi.getAuthHeaders(),
    })
    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      throw new Error(body.message || `Request failed (${response.status})`)
    }
    return response.json()
  }
}

export const zoneApi = new ZoneApi()
