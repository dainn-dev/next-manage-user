import { authApi } from './auth-api'
import { getApiUrl } from './config'

const API_BASE_URL = getApiUrl()

export interface Site {
  id: string
  name: string
  location?: string | null
  createdAt?: string
  updatedAt?: string
}

export interface SiteWriteRequest {
  name: string
  location?: string
}

class SiteApi {
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

    if (response.status === 204) {
      return undefined as T
    }

    return response.json()
  }

  list(): Promise<Site[]> {
    return this.request<Site[]>('/sites')
  }

  get(id: string): Promise<Site> {
    return this.request<Site>(`/sites/${id}`)
  }

  create(body: SiteWriteRequest): Promise<Site> {
    return this.request<Site>('/sites', {
      method: 'POST',
      body: JSON.stringify(body),
    })
  }

  update(id: string, body: SiteWriteRequest): Promise<Site> {
    return this.request<Site>(`/sites/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    })
  }

  delete(id: string): Promise<void> {
    return this.request<void>(`/sites/${id}`, { method: 'DELETE' })
  }
}

export const siteApi = new SiteApi()
