import { authApi } from './auth-api'
import { getApiUrl } from './config'

const API_BASE_URL = getApiUrl()

export type TenantStatus = 'active' | 'suspended' | 'pending_deletion'

export interface TenantSummary {
  id: string
  name: string
  slug: string
  status: TenantStatus
  managementModel?: string | null
  areaCount?: number | null
  siteCount: number
  tenantAdminCount: number
  createdAt: string
  updatedAt: string
}

export interface TenantSiteSummary {
  id: string
  name: string
  location?: string
  createdAt?: string
}

export interface TenantAdminSummary {
  id: string
  username: string
  email: string
  fullName?: string
  status?: string
  lastLogin?: string
}

export interface TenantDetail {
  id: string
  name: string
  slug: string
  status: TenantStatus
  managementModel?: string | null
  areaCount?: number | null
  createdAt: string
  updatedAt: string
  sites: TenantSiteSummary[]
  tenantAdmins: TenantAdminSummary[]
}

export interface TenantOnboardingRequest {
  tenantName: string
  tenantSlug?: string
  siteName: string
  siteLocation?: string
  managementModel: string
  areaCount: number
  adminUsername: string
  adminEmail: string
  adminPassword: string
  adminFirstName?: string
  adminLastName?: string
}

export interface TenantOnboardingResponse {
  tenantId: string
  tenantName: string
  tenantSlug: string
  siteId: string
  siteName: string
  adminUserId: string
  adminUsername: string
  adminEmail: string
  role: string
  token?: string
}

export interface TenantPageResponse {
  content: TenantSummary[]
  totalElements: number
  totalPages: number
  size: number
  number: number
  first: boolean
  last: boolean
  numberOfElements: number
}

export interface TenantStatistics {
  total: number
  active: number
  suspended: number
  pendingDeletion: number
}

export interface ListTenantsParams {
  page?: number
  size?: number
  searchTerm?: string
  status?: TenantStatus | 'all'
  sortBy?: string
  sortDir?: 'asc' | 'desc'
}

class TenantApi {
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

  list(params: ListTenantsParams = {}): Promise<TenantPageResponse> {
    const query = new URLSearchParams()
    query.set('page', String(params.page ?? 0))
    query.set('size', String(params.size ?? 20))
    query.set('sortBy', params.sortBy ?? 'updatedAt')
    query.set('sortDir', params.sortDir ?? 'desc')
    if (params.searchTerm?.trim()) {
      query.set('searchTerm', params.searchTerm.trim())
    }
    if (params.status && params.status !== 'all') {
      query.set('status', params.status)
    }
    return this.request<TenantPageResponse>(`/v1/tenants?${query.toString()}`)
  }

  summary(): Promise<TenantStatistics> {
    return this.request<TenantStatistics>('/v1/tenants/summary')
  }

  get(id: string): Promise<TenantDetail> {
    return this.request<TenantDetail>(`/v1/tenants/${id}`)
  }

  rename(id: string, name: string): Promise<TenantDetail> {
    return this.request<TenantDetail>(`/v1/tenants/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    })
  }

  updateStatus(id: string, status: TenantStatus, reason?: string): Promise<TenantDetail> {
    return this.request<TenantDetail>(`/v1/tenants/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, reason }),
    })
  }

  create(body: TenantOnboardingRequest): Promise<TenantOnboardingResponse> {
    return this.request<TenantOnboardingResponse>('/v1/tenants', {
      method: 'POST',
      body: JSON.stringify(body),
    })
  }
}

export const tenantApi = new TenantApi()
