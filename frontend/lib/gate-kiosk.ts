import type {
  EmployeeVehicleCheckMessage,
  VehicleCheckMessage,
} from "@/hooks/use-websocket"
import type { VehicleLog } from "@/lib/api/vehicle-log-api"

// A single normalized event rendered on the kiosk, regardless of whether it came
// from the rich (employee) WebSocket payload, the simple WebSocket payload, or the
// recent-checks replay endpoint.
export interface KioskEvent {
  key: string
  licensePlate: string
  type: "entry" | "exit" | "unknown"
  approved: boolean
  // Unregistered plate queued for approval (Phase 4.4): not approved, but not a
  // hard denial either — the kiosk renders a distinct awaiting-approval state.
  pending?: boolean
  driverName?: string
  unit?: string
  timestamp: string
  message?: string
  avatar?: string
  // Distinguishes a live WS event (speak + flash) from a replayed one (silent).
  replayed?: boolean
}

// The rich WebSocket payload carries embedded employee + vehicle info and is only
// sent for APPROVED checks (a VehicleLog was created).
export function isEmployeeMessage(
  msg: VehicleCheckMessage | EmployeeVehicleCheckMessage,
): msg is EmployeeVehicleCheckMessage {
  return (
    typeof msg === "object" &&
    msg !== null &&
    "employeeId" in msg &&
    "vehicleId" in msg
  )
}

// A simple message is a plain-text notification. The backend only distinguishes
// approved vs denied through the Vietnamese message text, so we key off it. Order
// matters: "không được phép" contains the substring "được phép".
export function isDeniedMessage(message?: string): boolean {
  if (!message) return false
  const m = message.toLowerCase()
  return (
    m.includes("không được phép") ||
    m.includes("chưa được đăng ký") ||
    m.includes("lỗi")
  )
}

function normalizeType(type?: string): KioskEvent["type"] {
  const t = (type || "").toLowerCase()
  if (t === "entry") return "entry"
  if (t === "exit") return "exit"
  return "unknown"
}

let seq = 0
function nextKey(prefix: string): string {
  seq += 1
  return `${prefix}-${seq}`
}

export function normalizeWsEvent(
  msg: VehicleCheckMessage | EmployeeVehicleCheckMessage,
): KioskEvent {
  if (isEmployeeMessage(msg)) {
    return {
      key: nextKey(`ws-${msg.licensePlateNumber}`),
      licensePlate: msg.licensePlateNumber,
      type: normalizeType(msg.logType),
      approved: true, // rich payload is only emitted on approved access
      driverName: msg.driverName || msg.employeeName,
      unit: msg.department,
      timestamp: msg.logTime || new Date().toISOString(),
      avatar: msg.avatar,
      message: undefined,
    }
  }

  const simple = msg as VehicleCheckMessage
  // Prefer the explicit backend status (Phase 4.4); fall back to text parsing for
  // older messages that don't carry one.
  const isPending = simple.status === "pending"
  const approved = simple.status
    ? simple.status === "approved"
    : !isDeniedMessage(simple.message)
  return {
    key: nextKey(`ws-${simple.licensePlateNumber}`),
    licensePlate: simple.licensePlateNumber,
    type: normalizeType(simple.type),
    approved,
    pending: isPending,
    timestamp: simple.timestamp || new Date().toISOString(),
    message: simple.message,
  }
}

// The replay endpoint returns VehicleLog rows. Only approved checks are logged, so
// every replayed event is an approved one.
export function normalizeLog(log: VehicleLog): KioskEvent {
  return {
    key: `log-${log.id}`,
    licensePlate: log.licensePlateNumber,
    type: normalizeType(log.type),
    approved: true,
    driverName: log.driverName || log.employeeName,
    unit: log.employeeDepartment,
    timestamp: log.entryExitTime,
    avatar: log.employeeAvatar,
    replayed: true,
  }
}

// ---- Browser Text-to-Speech (Web Speech API) --------------------------------
//
// Replaces the TTS that lived in the monolithic PyQt app. Speaks a short Vietnamese
// phrase when a live event arrives. Autoplay policies require a user gesture before
// speech is allowed, so the kiosk gates this behind an explicit "enable sound"
// toggle (see unlockSpeech).

export function isSpeechSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window
}

// A one-off silent-ish utterance triggered from a click, so subsequent
// programmatic speech is permitted by the browser.
export function unlockSpeech(): void {
  if (!isSpeechSupported()) return
  try {
    const u = new SpeechSynthesisUtterance(" ")
    u.volume = 0
    u.lang = "vi-VN"
    window.speechSynthesis.speak(u)
  } catch {
    /* ignore */
  }
}

function pickVietnameseVoice(): SpeechSynthesisVoice | null {
  if (!isSpeechSupported()) return null
  const voices = window.speechSynthesis.getVoices()
  return (
    voices.find((v) => v.lang?.toLowerCase().startsWith("vi")) || null
  )
}

export function speakEvent(event: KioskEvent): void {
  if (!isSpeechSupported()) return
  const dir = event.type === "entry" ? "vào" : event.type === "exit" ? "ra" : ""
  const text = event.pending
    ? `Chờ phê duyệt. Biển số ${event.licensePlate}`
    : event.approved
    ? `Được phép ${dir}. Biển số ${event.licensePlate}`.trim()
    : `Từ chối. Biển số ${event.licensePlate}`
  try {
    // Cancel any in-flight speech so bursts of events don't queue up unboundedly.
    window.speechSynthesis.cancel()
    const utter = new SpeechSynthesisUtterance(text)
    utter.lang = "vi-VN"
    const voice = pickVietnameseVoice()
    if (voice) utter.voice = voice
    utter.rate = 1
    utter.pitch = 1
    window.speechSynthesis.speak(utter)
  } catch {
    /* ignore speech failures */
  }
}
