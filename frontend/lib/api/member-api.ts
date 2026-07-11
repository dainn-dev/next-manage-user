import { getApiUrl } from "./config"
import { authApi } from "./auth-api"

const API_BASE_URL = getApiUrl()

export interface MemberRegistrationOrg {
  tenantId: string
  tenantName?: string
  siteId?: string
  status?: string
}

export interface MemberVehicleGarageItem {
  vehicleId: string
  licensePlate: string
  vehicleType?: string
  brand?: string
  model?: string
  color?: string
  status?: string
  registeredAt: MemberRegistrationOrg[]
}

export interface MemberParkingSession {
  sessionId: string
  tenantId?: string
  tenantName?: string
  siteId?: string
  licensePlate: string
  status: string
  startedAt?: string
  endedAt?: string
  qrTokenJti?: string
  locationLabel?: string | null
}

async function memberFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = authApi.getToken()
  if (!token) throw new Error("Not authenticated")
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers || {}),
    },
  })
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body.message || `Request failed (${response.status})`)
  }
  if (response.status === 204) return undefined as T
  return response.json()
}

export const memberApi = {
  listVehicles: () => memberFetch<MemberVehicleGarageItem[]>("/member/vehicles"),
  listSessions: () => memberFetch<MemberParkingSession[]>("/member/sessions"),
  getSession: (sessionId: string) =>
    memberFetch<MemberParkingSession>(`/member/sessions/${sessionId}`),
  claimSession: (code: string) =>
    memberFetch<MemberParkingSession>("/member/sessions/claim", {
      method: "POST",
      body: JSON.stringify({ code }),
    }),
}
