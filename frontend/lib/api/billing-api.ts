import { authApi } from './auth-api'
import { getApiUrl } from './config'

const API_BASE_URL = getApiUrl()

/** Tenant-scoped billing status (requires tenant JWT context). */
export interface BillingStatusResponse {
  planId?: string
  planCode?: string
  planName?: string
  limits?: string
  usage?: Record<string, number>
  subscriptionStatus?: string
  currentPeriodEnd?: string
}

export interface BillingCheckoutRequest {
  planId: string
  successUrl: string
  cancelUrl: string
}

export interface BillingCheckoutResponse {
  sessionId: string
  url: string
}

export interface BillingPortalRequest {
  returnUrl: string
}

export interface BillingPortalResponse {
  sessionId?: string
  id?: string
  url: string
}

class BillingApi {
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

  /**
   * Own-tenant billing status. PLATFORM_ADMIN has no tenant context, so this
   * is primarily for TENANT_ADMIN; platform overview uses tenant registry APIs.
   */
  getStatus(): Promise<BillingStatusResponse> {
    return this.request<BillingStatusResponse>('/v1/billing/status')
  }

  createCheckoutSession(body: BillingCheckoutRequest): Promise<BillingCheckoutResponse> {
    return this.request<BillingCheckoutResponse>('/v1/billing/checkout-session', {
      method: 'POST',
      body: JSON.stringify(body),
    })
  }

  createPortalSession(body: BillingPortalRequest): Promise<BillingPortalResponse> {
    return this.request<BillingPortalResponse>('/v1/billing/portal-session', {
      method: 'POST',
      body: JSON.stringify(body),
    })
  }
}

export const billingApi = new BillingApi()
