import { API_URL } from './config'

export interface SiteAgent {
  id: string
  tenantId: string
  siteId: string
  name: string
  deviceFingerprintHash?: string
  status: 'provisioning' | 'online' | 'offline' | 'revoked'
  version?: string
  platform?: string
  lastHeartbeatAt?: string
  lastIp?: string
  capabilitiesJson?: Record<string, any>
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
  status: 'online' | 'offline' | 'revoked'
  version?: string
  platform?: string
  lastHeartbeatAt?: string
  cameraCount: number
  onlineCameraCount: number
}

/**
 * Generate a new enrollment code for pairing a site agent
 */
export async function generateEnrollmentCode(
  siteId: string,
  token: string
): Promise<EnrollmentCodeResponse> {
  const response = await fetch(
    `${API_URL}/sites/${siteId}/agents/enrollment-codes`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  )

  if (!response.ok) {
    throw new Error(`Failed to generate enrollment code: ${response.statusText}`)
  }

  return response.json()
}

/**
 * List all agents for a site
 */
export async function listAgents(
  siteId: string,
  token: string
): Promise<AgentSummary[]> {
  const response = await fetch(
    `${API_URL}/sites/${siteId}/agents`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    }
  )

  if (!response.ok) {
    throw new Error(`Failed to list agents: ${response.statusText}`)
  }

  return response.json()
}

/**
 * Revoke an agent's access
 */
export async function revokeAgent(
  agentId: string,
  token: string
): Promise<void> {
  const response = await fetch(
    `${API_URL}/site-agents/${agentId}/revoke`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  )

  if (!response.ok) {
    throw new Error(`Failed to revoke agent: ${response.statusText}`)
  }
}

/**
 * Get detailed information about a specific agent
 */
export async function getAgent(
  agentId: string,
  token: string
): Promise<SiteAgent> {
  const response = await fetch(
    `${API_URL}/site-agents/${agentId}`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    }
  )

  if (!response.ok) {
    throw new Error(`Failed to get agent: ${response.statusText}`)
  }

  return response.json()
}
