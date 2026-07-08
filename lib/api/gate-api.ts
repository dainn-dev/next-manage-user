import { authApi } from "./auth-api"
import { getApiUrl } from "./config"
import type { VehicleLog } from "./vehicle-log-api"

const API_BASE_URL = getApiUrl()

// Mirrors the backend GateDto (com.vehiclemanagement.dto.GateDto). `status` is the
// value persisted by the backend; the freshness of `lastHeartbeatAt` is what a UI
// should trust for a real online/offline decision (see isGateOnline below).
export interface Gate {
  id: string
  name: string
  location?: string
  cameraRtspUrl?: string
  status: "online" | "offline" | "disabled"
  lastHeartbeatAt?: string
  createdAt?: string
  updatedAt?: string
}

// A gate is considered live only when it reported a heartbeat recently. The edge
// client (Phase 3.3) pings roughly once a minute, so a 2-minute window tolerates a
// missed beat without flapping. `disabled` gates are never shown as online.
export const GATE_HEARTBEAT_TIMEOUT_MS = 2 * 60 * 1000

// Mirrors the backend GateHealthDto (com.vehiclemanagement.dto.GateHealthDto). The
// backend computes `online` and `secondsSinceHeartbeat` against the same staleness
// window the offline scheduler uses, so the dashboard can trust these directly.
export interface GateHealth {
  id: string
  name: string
  location?: string
  status: "online" | "offline" | "disabled"
  lastHeartbeatAt?: string
  secondsSinceHeartbeat?: number | null
  online: boolean
}

export function isGateOnline(gate: Gate, now: number = Date.now()): boolean {
  if (gate.status === "disabled") return false
  if (!gate.lastHeartbeatAt) return false
  const last = new Date(gate.lastHeartbeatAt).getTime()
  if (Number.isNaN(last)) return false
  return now - last <= GATE_HEARTBEAT_TIMEOUT_MS
}

export const gateApi = {
  // GET /api/gates — admin gate registry. Requires an ADMIN JWT.
  getGates: async (): Promise<Gate[]> => {
    const response = await fetch(`${API_BASE_URL}/gates`, {
      headers: { ...authApi.getAuthHeaders() },
    })
    if (!response.ok) {
      throw new Error("Failed to fetch gates")
    }
    return response.json()
  },

  // GET /api/gates/health — per-gate health summary for the dashboard. Requires an
  // ADMIN / APPROVER / SECURITY_OFFICER JWT. Returns each gate with a computed
  // `online` flag and `secondsSinceHeartbeat`.
  getGateHealth: async (): Promise<GateHealth[]> => {
    const response = await fetch(`${API_BASE_URL}/gates/health`, {
      headers: { ...authApi.getAuthHeaders() },
    })
    if (!response.ok) {
      throw new Error("Failed to fetch gate health")
    }
    return response.json()
  },

  // GET /api/gates/{id}
  getGate: async (id: string): Promise<Gate> => {
    const response = await fetch(`${API_BASE_URL}/gates/${id}`, {
      headers: { ...authApi.getAuthHeaders() },
    })
    if (!response.ok) {
      throw new Error("Failed to fetch gate")
    }
    return response.json()
  },

  // GET /api/gates/{id}/recent-checks?since=<ISO> — reliable-delivery replay
  // (Phase 3.2). Returns the check logs created for this gate after `since`,
  // newest first. `since` is an ISO-8601 LOCAL date-time (no timezone suffix) to
  // match the backend @DateTimeFormat(ISO.DATE_TIME) LocalDateTime binding.
  getRecentChecks: async (id: string, since?: string): Promise<VehicleLog[]> => {
    const qs = since ? `?since=${encodeURIComponent(since)}` : ""
    const response = await fetch(`${API_BASE_URL}/gates/${id}/recent-checks${qs}`, {
      headers: { ...authApi.getAuthHeaders() },
    })
    if (!response.ok) {
      throw new Error("Failed to fetch recent checks")
    }
    return response.json()
  },
}
