import { authApi } from './auth-api'
import { getApiUrl } from './config'

const API_URL = getApiUrl()

export interface SiteAgent {
  id: string
  name: string
  status: string
  version?: string
  platform?: string
  lastHeartbeatAt?: string
  lastIp?: string
  capabilitiesJson?: string
  camerasAssigned: number
  createdAt: string
  updatedAt: string
  revokedAt?: string
}

export interface EnrollmentCodeResponse {
  code: string
  expiresAt: string
}

export interface AgentSummary {
  id: string
  name: string
  status: string
  version?: string
  platform?: string
  lastHeartbeatAt?: string
  camerasAssigned: number
  createdAt: string
}

async function readError(response: Response, fallback: string): Promise<Error> {
  const body = await response.json().catch(() => null) as { message?: string } | null
  return new Error(body?.message || `${fallback} (${response.status})`)
}

/** Generate a one-time enrollment code for pairing a site agent. */
export async function generateEnrollmentCode(siteId: string): Promise<EnrollmentCodeResponse> {
  const response = await fetch(`${API_URL}/sites/${siteId}/agents/enrollment-codes`, {
    method: 'POST',
    headers: authApi.getAuthHeaders(),
  })

  if (!response.ok) throw await readError(response, 'Không thể tạo mã kích hoạt')
  return response.json()
}

/** List all agents assigned to a site. */
export async function listAgents(siteId: string): Promise<AgentSummary[]> {
  const response = await fetch(`${API_URL}/sites/${siteId}/agents`, {
    headers: authApi.getAuthHeaders(),
  })

  if (!response.ok) throw await readError(response, 'Không thể tải danh sách máy vận hành')
  return response.json()
}

/** Revoke an agent and invalidate its credentials. */
export async function revokeAgent(siteId: string, agentId: string): Promise<void> {
  const response = await fetch(`${API_URL}/sites/${siteId}/agents/${agentId}/revoke`, {
    method: 'POST',
    headers: authApi.getAuthHeaders(),
  })

  if (!response.ok) throw await readError(response, 'Không thể thu hồi máy vận hành')
}

/** Get detailed information about an agent in a site. */
export async function getAgent(siteId: string, agentId: string): Promise<SiteAgent> {
  const response = await fetch(`${API_URL}/sites/${siteId}/agents/${agentId}`, {
    headers: authApi.getAuthHeaders(),
  })

  if (!response.ok) throw await readError(response, 'Không thể tải máy vận hành')
  return response.json()
}
