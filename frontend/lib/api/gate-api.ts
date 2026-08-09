import { authApi } from "./auth-api"
import { getApiUrl } from "./config"
import type { VehicleLog } from "./vehicle-log-api"

const API_BASE_URL = getApiUrl()

// Mirrors the backend GateDto (com.vehiclemanagement.dto.GateDto). `status` is the
// value persisted by the backend; the freshness of `lastHeartbeatAt` is what a UI
// should trust for a real online/offline decision (see isGateOnline below).
export interface Gate {
  id: string
  siteId?: string | null
  name: string
  location?: string
  cameraRtspUrl?: string
  status: "online" | "offline" | "disabled"
  lastHeartbeatAt?: string
  createdAt?: string
  updatedAt?: string
}

export interface GateWriteRequest {
  siteId?: string
  name: string
  location?: string | null
  cameraRtspUrl?: string | null
  status?: Gate["status"]
}

// A gate is considered live only when it reported a heartbeat recently. The edge
// client (Phase 3.3) pings roughly once a minute, so a 2-minute window tolerates a
// missed beat without flapping. `disabled` gates are never shown as online.
export const GATE_HEARTBEAT_TIMEOUT_MS = 2 * 60 * 1000

export function isGateOnline(gate: Gate, now: number = Date.now()): boolean {
  if (gate.status === "disabled") return false
  if (!gate.lastHeartbeatAt) return false
  const last = new Date(gate.lastHeartbeatAt).getTime()
  if (Number.isNaN(last)) return false
  return now - last <= GATE_HEARTBEAT_TIMEOUT_MS
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
  // GET /api/gates — admin gate registry. Requires an ADMIN JWT.
  getGates: async (): Promise<Gate[]> => {
    return requestJson<Gate[]>("/gates")
  },

  // GET /api/gates/{id}
  getGate: async (id: string): Promise<Gate> => {
    return requestJson<Gate>(`/gates/${id}`)
  },

  // POST /api/gates
  createGate: async (body: GateWriteRequest & { siteId: string }): Promise<Gate> => {
    return requestJson<Gate>("/gates", {
      method: "POST",
      body: JSON.stringify(body),
    })
  },

  // PUT /api/gates/{id}
  updateGate: async (id: string, body: GateWriteRequest): Promise<Gate> => {
    return requestJson<Gate>(`/gates/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    })
  },

  // DELETE /api/gates/{id}
  deleteGate: async (id: string): Promise<void> => {
    await requestJson<void>(`/gates/${id}`, { method: "DELETE" })
  },

  // GET /api/gates/{id}/recent-checks?since=<ISO> — reliable-delivery replay
  // (Phase 3.2). Returns the check logs created for this gate after `since`,
  // newest first. `since` is an ISO-8601 LOCAL date-time (no timezone suffix) to
  // match the backend @DateTimeFormat(ISO.DATE_TIME) LocalDateTime binding.
  getRecentChecks: async (id: string, since?: string): Promise<VehicleLog[]> => {
    const qs = since ? `?since=${encodeURIComponent(since)}` : ""
    return requestJson<VehicleLog[]>(`/gates/${id}/recent-checks${qs}`)
  },
}
