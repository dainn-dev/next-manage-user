import { authApi } from './auth-api'
import { getApiUrl } from './config'
import type { TenantStatistics } from './tenant-api'

const API_BASE_URL = getApiUrl()

export interface PlatformAuditEntry {
  id: string
  actorUserId?: string
  actorUsername?: string
  action: string
  resourceType: string
  resourceId?: string
  detail?: string
  createdAt: string
}

export interface PlatformAuditPage {
  content: PlatformAuditEntry[]
  totalElements: number
  totalPages: number
  size: number
  number: number
  first: boolean
  last: boolean
  numberOfElements: number
}

export interface PlatformBillingSummary {
  withSubscription: number
  withoutSubscription: number
  byStatus: Record<string, number>
}

export interface PlatformSubscription {
  tenantId: string
  tenantName: string
  tenantSlug: string
  tenantStatus: string
  planCode?: string
  planName?: string
  subscriptionStatus: string
  currentPeriodEnd?: string
  pastDueSince?: string
  cancelAtPeriodEnd: boolean
}

export interface PlatformSubscriptionPage {
  content: PlatformSubscription[]
  totalElements: number
  totalPages: number
  size: number
  number: number
  first: boolean
  last: boolean
  numberOfElements: number
}

export interface PlatformOverview {
  tenants: TenantStatistics
  billing: PlatformBillingSummary
  platformAdminCount: number
  recentAudit: PlatformAuditEntry[]
}

export interface PlatformAdmin {
  id: string
  username: string
  email: string
  firstName?: string
  lastName?: string
  status: 'ACTIVE' | 'INACTIVE' | 'LOCKED' | 'SUSPENDED'
  lastLogin?: string
  createdAt: string
  updatedAt: string
}

export interface CreatePlatformAdminRequest {
  username: string
  email: string
  password: string
  firstName?: string
  lastName?: string
}

export interface PlatformAdminMutationResponse {
  admin: PlatformAdmin
  auditId?: string
  auditAction?: string
}

export interface UpdatePlatformAdminRequest {
  firstName?: string
  lastName?: string
  status?: PlatformAdmin['status']
  reason?: string
}

class PlatformApi {
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

  overview(): Promise<PlatformOverview> {
    return this.request<PlatformOverview>('/v1/platform/overview')
  }

  listSubscriptions(params: {
    page?: number
    size?: number
    status?: string
    searchTerm?: string
  } = {}): Promise<PlatformSubscriptionPage> {
    const query = new URLSearchParams()
    query.set('page', String(params.page ?? 0))
    query.set('size', String(params.size ?? 20))
    if (params.status?.trim()) query.set('status', params.status.trim())
    if (params.searchTerm?.trim()) query.set('searchTerm', params.searchTerm.trim())
    return this.request<PlatformSubscriptionPage>(`/v1/platform/billing/subscriptions?${query}`)
  }

  billingSummary(): Promise<PlatformBillingSummary> {
    return this.request<PlatformBillingSummary>('/v1/platform/billing/summary')
  }

  listAdmins(): Promise<PlatformAdmin[]> {
    return this.request<PlatformAdmin[]>('/v1/platform/admins')
  }

  createAdmin(body: CreatePlatformAdminRequest): Promise<PlatformAdminMutationResponse> {
    return this.request<PlatformAdminMutationResponse>('/v1/platform/admins', {
      method: 'POST',
      body: JSON.stringify(body),
    })
  }

  updateAdmin(id: string, body: UpdatePlatformAdminRequest): Promise<PlatformAdminMutationResponse> {
    return this.request<PlatformAdminMutationResponse>(`/v1/platform/admins/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    })
  }

  listAudit(params: {
    page?: number
    size?: number
    action?: string
    resourceType?: string
    resourceId?: string
  } = {}): Promise<PlatformAuditPage> {
    const query = new URLSearchParams()
    query.set('page', String(params.page ?? 0))
    query.set('size', String(params.size ?? 20))
    if (params.action?.trim()) query.set('action', params.action.trim())
    if (params.resourceType?.trim()) query.set('resourceType', params.resourceType.trim())
    if (params.resourceId?.trim()) query.set('resourceId', params.resourceId.trim())
    return this.request<PlatformAuditPage>(`/v1/platform/audit?${query}`)
  }
}

export const platformApi = new PlatformApi()
