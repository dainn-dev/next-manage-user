import { authApi } from "./auth-api"
import { getApiUrl } from './config'

const API_BASE_URL = getApiUrl()

export type AccessRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED'

export type AccessRequestSource = 'USER' | 'GATE'

export interface AccessRequest {
  id: string
  vehicleId?: string
  vehicleLicensePlate?: string
  // Raw plate for gate-originated requests that have no linked vehicle (Phase 4.4).
  licensePlate?: string
  requesterId?: string
  requesterName?: string
  approverId?: string
  approverName?: string
  status: AccessRequestStatus
  requestReason: string
  rejectionReason?: string
  validFrom?: string
  validTo?: string
  // Gate-detected request metadata (Phase 4.4).
  gateId?: string
  gateName?: string
  imagePath?: string
  source?: AccessRequestSource
  createdAt: string
  updatedAt: string
}

export interface CreateAccessRequestDto {
  vehicleId: string
  requestReason: string
  validFrom?: string
  validTo?: string
}

class AccessRequestApi {
  private getHeaders(): HeadersInit {
    const token = authApi.getToken()
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }
  }

  async getAllRequests(): Promise<AccessRequest[]> {
    const response = await fetch(`${API_BASE_URL}/access-requests`, {
      headers: this.getHeaders(),
    })
    if (!response.ok) throw new Error('Failed to fetch access requests')
    return response.json()
  }

  async getPendingRequests(): Promise<AccessRequest[]> {
    const response = await fetch(`${API_BASE_URL}/access-requests/pending`, {
      headers: this.getHeaders(),
    })
    if (!response.ok) throw new Error('Failed to fetch pending requests')
    return response.json()
  }

  async getMyRequests(): Promise<AccessRequest[]> {
    const response = await fetch(`${API_BASE_URL}/access-requests/my`, {
      headers: this.getHeaders(),
    })
    if (!response.ok) throw new Error('Failed to fetch my requests')
    return response.json()
  }

  async createRequest(dto: CreateAccessRequestDto): Promise<AccessRequest> {
    const response = await fetch(`${API_BASE_URL}/access-requests`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(dto),
    })
    if (!response.ok) throw new Error('Failed to create access request')
    return response.json()
  }

  async approveRequest(id: string): Promise<AccessRequest> {
    const response = await fetch(`${API_BASE_URL}/access-requests/${id}/approve`, {
      method: 'PUT',
      headers: this.getHeaders(),
    })
    if (!response.ok) throw new Error('Failed to approve request')
    return response.json()
  }

  async rejectRequest(id: string, rejectionReason: string): Promise<AccessRequest> {
    const response = await fetch(`${API_BASE_URL}/access-requests/${id}/reject`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify({ rejectionReason }),
    })
    if (!response.ok) throw new Error('Failed to reject request')
    return response.json()
  }

  async cancelRequest(id: string): Promise<AccessRequest> {
    const response = await fetch(`${API_BASE_URL}/access-requests/${id}/cancel`, {
      method: 'PUT',
      headers: this.getHeaders(),
    })
    if (!response.ok) throw new Error('Failed to cancel request')
    return response.json()
  }
}

export const accessRequestApi = new AccessRequestApi()
