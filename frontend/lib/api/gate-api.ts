import { authApi } from "./auth-api"
import { getApiUrl } from "./config"
import type { VehicleLog } from "./vehicle-log-api"

const API_BASE_URL = getApiUrl()

export type GateType = "ENTRANCE" | "EXIT"
export type GateStatus = "online" | "offline" | "disabled"
export type CameraPanelType = "entry" | "exit"
export type CameraStatus = "provisioned" | "online" | "offline" | "disabled"

export interface GateLane {
  cameraId: string
  name: string
  status?: CameraStatus
  panelType?: CameraPanelType | null
}

// Mirrors the backend GateDto (com.vehiclemanagement.dto.GateDto). `status` is the
// value persisted by the backend; the freshness of `lastHeartbeatAt` is what a UI
// should trust for a real online/offline decision (see isGateOnline below).
export interface Gate {
  id: string
  siteId?: string | null
  name: string
  location?: string
  gateType?: GateType | null
  cameraRtspUrl?: string
  status: GateStatus
  lastHeartbeatAt?: string
  createdAt?: string
  updatedAt?: string
  lanes?: GateLane[]
}

export interface GateWriteRequest {
  siteId?: string
  name: string
  gateType: GateType
  location?: string | null
  status?: GateStatus
  /** Ordered lane cameras — one camera per lane. */
  cameraIds?: string[]
}

export const GATE_HEARTBEAT_TIMEOUT_MS = 2 * 60 * 1000

export function isGateOnline(gate: Gate, now: number = Date.now()): boolean {
  if (gate.status === "disabled") return false
  if (!gate.lastHeartbeatAt) return false
  const last = new Date(gate.lastHeartbeatAt).getTime()
  if (Number.isNaN(last)) return false
  return now - last <= GATE_HEARTBEAT_TIMEOUT_MS
}

export function gateTypeLabel(type?: GateType | null): string {
  if (type === "ENTRANCE") return "Vào"
  if (type === "EXIT") return "Ra"
  return "Chưa đặt"
}

async function requestJson<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...authApi.getAuthHeaders(),
      ...options.headers,
    },
  })
  if (response.status === 204) {
    return undefined as T
  }
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(
      typeof body?.message === "string" ? body.message : `Request failed (${response.status})`,
    )
  }
  return body as T
}

export const gateApi = {
  getGates: async (): Promise<Gate[]> => {
    return requestJson<Gate[]>("/gates")
  },

  getGate: async (id: string): Promise<Gate> => {
    return requestJson<Gate>(`/gates/${id}`)
  },

  createGate: async (body: GateWriteRequest & { siteId: string }): Promise<Gate> => {
    return requestJson<Gate>("/gates", {
      method: "POST",
      body: JSON.stringify(body),
    })
  },

  updateGate: async (id: string, body: GateWriteRequest): Promise<Gate> => {
    return requestJson<Gate>(`/gates/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    })
  },

  deleteGate: async (id: string): Promise<void> => {
    await requestJson<void>(`/gates/${id}`, { method: "DELETE" })
  },

  getRecentChecks: async (id: string, since?: string): Promise<VehicleLog[]> => {
    const qs = since ? `?since=${encodeURIComponent(since)}` : ""
    return requestJson<VehicleLog[]>(`/gates/${id}/recent-checks${qs}`)
  },
}
