import { authApi } from './auth-api'
import { getApiUrl } from './config'

const API_BASE_URL = getApiUrl()

export interface TenantSettings {
  id: string
  name: string
  slug: string
  status: string
  managementModel?: string | null
  areaCount?: number | null
  siteCount: number
  planCode?: string | null
  planName?: string | null
}

export interface TenantSettingsUpdateRequest {
  name: string
  managementModel: string
  areaCount: number
}

class TenantSettingsApi {
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        ...authApi.getAuthHeaders(),
        ...options.headers,
      },
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || `Request failed (${response.status})`)
    }

    return response.json()
  }

  getMe(): Promise<TenantSettings> {
    return this.request<TenantSettings>('/v1/tenant/me')
  }

  updateMe(body: TenantSettingsUpdateRequest): Promise<TenantSettings> {
    return this.request<TenantSettings>('/v1/tenant/me', {
      method: 'PATCH',
      body: JSON.stringify(body),
    })
  }
}

export const tenantSettingsApi = new TenantSettingsApi()
