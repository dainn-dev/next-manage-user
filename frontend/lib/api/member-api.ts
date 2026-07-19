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

  if (token === "mock_member_token") {
    if (path === "/member/vehicles") {
      const localVehiclesStr = typeof window !== "undefined" ? localStorage.getItem("mock_member_vehicles") : null
      if (localVehiclesStr) {
        try {
          return JSON.parse(localVehiclesStr) as unknown as T
        } catch (e) {
          console.error("Failed to parse localVehicles", e)
        }
      }
      return [
        {
          vehicleId: "v-1",
          licensePlate: "30F-123.45",
          vehicleType: "car",
          brand: "Toyota",
          model: "Camry",
          color: "Đen",
          status: "APPROVED",
          registeredAt: [{ tenantId: "t-1", tenantName: "Hà Nội Tower - Chi nhánh Hai Bà Trưng" }],
        },
      ] as unknown as T
    }

    if (path === "/member/sessions") {
      const localSessionsStr = typeof window !== "undefined" ? localStorage.getItem("mock_member_sessions") : null
      if (localSessionsStr) {
        try {
          return JSON.parse(localSessionsStr) as unknown as T
        } catch (e) {
          console.error("Failed to parse localSessions", e)
        }
      }
      return [
        {
          sessionId: "s-1",
          tenantId: "t-1",
          tenantName: "Hà Nội Tower - Chi nhánh Hai Bà Trưng",
          siteId: "site-1",
          licensePlate: "30F-123.45",
          status: "ACTIVE",
          startedAt: new Date(Date.now() - 3600000).toISOString(),
          locationLabel: "Tầng hầm B1 - Vị trí A-12",
        },
      ] as unknown as T
    }

    return [] as unknown as T
  }

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
