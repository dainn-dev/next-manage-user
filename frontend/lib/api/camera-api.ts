import { authApi } from './auth-api'
import { getApiUrl } from './config'

const API_BASE_URL = getApiUrl()

export type CameraRole = 'ANPR_GATE' | 'OVERVIEW'
export type CameraPanelType = 'entry' | 'exit'
export type CameraStatus = 'provisioned' | 'online' | 'offline' | 'disabled'

export interface Camera {
  id: string
  siteId: string
  zoneId?: string | null
  name: string
  rtspUrl?: string
  snapshotUrl?: string | null
  role: CameraRole
  panelType?: CameraPanelType | null
  status: CameraStatus
  lastHeartbeatAt?: string | null
  createdAt?: string
  updatedAt?: string
}

export interface CameraWriteRequest {
  siteId: string
  zoneId?: string | null
  name: string
  rtspUrl?: string | null
  role: CameraRole
  panelType?: CameraPanelType | null
  status?: CameraStatus
}

export interface CameraCredential extends Camera {
  ingestKey: string
  previousKeyExpiresAt?: string | null
}

class CameraApi {
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: { ...authApi.getAuthHeaders(), ...options.headers },
    })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(body.message || `Request failed (${response.status})`)
    if (response.status === 204) return undefined as T
    return body as T
  }

  list(siteId: string): Promise<Camera[]> {
    return this.request<Camera[]>(`/cameras?${new URLSearchParams({ siteId })}`)
  }

  create(body: CameraWriteRequest): Promise<Camera> {
    return this.request<Camera>('/cameras', { method: 'POST', body: JSON.stringify(body) })
  }

  update(id: string, body: CameraWriteRequest): Promise<Camera> {
    return this.request<Camera>(`/cameras/${id}`, { method: 'PUT', body: JSON.stringify(body) })
  }

  delete(id: string): Promise<void> {
    return this.request<void>(`/cameras/${id}`, { method: 'DELETE' })
  }

  issueCredential(id: string): Promise<CameraCredential> {
    return this.request<CameraCredential>(`/cameras/${id}/credentials`, { method: 'POST' })
  }

  rotateCredential(id: string): Promise<CameraCredential> {
    return this.request<CameraCredential>(`/cameras/${id}/credentials/rotate`, { method: 'POST' })
  }
}

export const cameraApi = new CameraApi()
