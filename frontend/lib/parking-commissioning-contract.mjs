export function normalizeMapStatus(value) {
  const normalized = String(value || '').trim().toUpperCase()
  if (normalized === 'DRAFT' || normalized === 'PUBLISHED' || normalized === 'ARCHIVED') return normalized
  throw new Error(`Unsupported parking map status: ${value}`)
}

export function normalizeSlotStatus(value) {
  const normalized = String(value || '').trim().toUpperCase()
  if (normalized === 'ACTIVE' || normalized === 'ENABLED') return 'ACTIVE'
  if (normalized === 'RESERVED') return 'RESERVED'
  if (normalized === 'DISABLED' || normalized === 'RETIRED') return 'DISABLED'
  throw new Error(`Unsupported parking slot status: ${value}`)
}
