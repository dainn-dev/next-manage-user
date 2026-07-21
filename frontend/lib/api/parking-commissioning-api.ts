import { authApi } from './auth-api'
import { getApiUrl } from './config'
import { normalizeMapStatus, normalizeSlotStatus } from '../parking-commissioning-contract.mjs'

export interface PixelPoint { x: number; y: number }
export interface CalibrationPoint { pixelX: number; pixelY: number; siteX: number; siteY: number }

export interface SourceImage {
  id: string
  siteId: string
  cameraId: string
  contentType: string
  byteSize: number
  sha256: string
  nativeWidth: number
  nativeHeight: number
  captureMethod: string
  createdAt: string
  readUrl: string
}

export interface CalibrationPreview {
  matrix: number[]
  reprojectionError: number
  controlPoints: CalibrationPoint[]
}

export interface CalibrationVersion {
  id: string
  siteId: string
  cameraId: string
  versionNumber: number
  homography: number[]
  reprojectionError: number
  coordinateSpace: 'site-local-meters-v1'
}

export interface ParkingMapSlot {
  slotId?: string | null
  zoneId: string
  code: string
  adminStatus: 'ACTIVE' | 'DISABLED' | 'RESERVED'
  pixelVertices: PixelPoint[]
}

export interface ParkingMapWriteRequest {
  sourceImageId: string
  calibrationVersionId: string
  coveragePixelVertices: PixelPoint[]
  slots: ParkingMapSlot[]
}

export interface ParkingMapDraft extends ParkingMapWriteRequest {
  id: string
  siteId: string
  cameraId: string
  versionNumber: number
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
  lockVersion: number
}

export interface ParkingMapValidation { valid: boolean; errors: string[] }

export interface UnifiedMapFeature {
  slotId: string
  code: string
  zoneId?: string | null
  adminStatus: string
  cameraId: string
  mapVersionId: string
  polygon: PixelPoint[]
}

export interface UnifiedMapPreview {
  siteId: string
  coordinateSpace: 'site-local-meters-v1'
  features: UnifiedMapFeature[]
}

const base = (siteId: string, cameraId: string) =>
  `${getApiUrl()}/v1/sites/${siteId}/cameras/${cameraId}`

async function parse<T>(responsePromise: Promise<Response> | Response): Promise<T> {
  const response = await responsePromise
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.message || `Request failed (${response.status})`)
  return body as T
}

function jsonHeaders(extra: Record<string, string> = {}) {
  return { ...authApi.getAuthHeaders(), ...extra }
}

function normalizeMap(value: ParkingMapDraft): ParkingMapDraft {
  return {
    ...value,
    status: normalizeMapStatus(value.status) as ParkingMapDraft['status'],
    slots: value.slots.map((slot) => ({ ...slot, adminStatus: normalizeSlotStatus(slot.adminStatus) as ParkingMapSlot['adminStatus'] })),
  }
}

export async function uploadStill(siteId: string, cameraId: string, file: File): Promise<SourceImage> {
  const form = new FormData()
  form.append('file', file)
  const headers = authApi.getAuthHeaders()
  delete headers['Content-Type']
  return parse(fetch(`${base(siteId, cameraId)}/stills:upload`, {
    method: 'POST', headers, body: form,
  }))
}

export async function captureStill(siteId: string, cameraId: string): Promise<void> {
  await parse(fetch(`${base(siteId, cameraId)}/stills:capture`, {
    method: 'POST', headers: jsonHeaders(),
  }))
}

export async function getStill(siteId: string, cameraId: string, stillId: string): Promise<SourceImage> {
  return parse(fetch(`${base(siteId, cameraId)}/stills/${stillId}`, { headers: jsonHeaders() }))
}

export async function validateCalibration(
  siteId: string,
  cameraId: string,
  sourceImageId: string,
  controlPoints: CalibrationPoint[],
): Promise<CalibrationPreview> {
  return parse(fetch(`${base(siteId, cameraId)}/calibrations:validate`, {
    method: 'POST', headers: jsonHeaders(), body: JSON.stringify({ sourceImageId, controlPoints }),
  }))
}

export async function createCalibration(
  siteId: string,
  cameraId: string,
  sourceImageId: string,
  controlPoints: CalibrationPoint[],
): Promise<CalibrationVersion> {
  return parse(fetch(`${base(siteId, cameraId)}/calibrations`, {
    method: 'POST', headers: jsonHeaders(), body: JSON.stringify({ sourceImageId, controlPoints }),
  }))
}

export async function listMaps(siteId: string, cameraId: string): Promise<ParkingMapDraft[]> {
  const maps = await parse<ParkingMapDraft[]>(fetch(`${base(siteId, cameraId)}/maps`, { headers: jsonHeaders() }))
  return maps.map(normalizeMap)
}

export async function createMap(siteId: string, cameraId: string, body: ParkingMapWriteRequest): Promise<ParkingMapDraft> {
  return normalizeMap(await parse(fetch(`${base(siteId, cameraId)}/maps`, {
    method: 'POST', headers: jsonHeaders(), body: JSON.stringify(body),
  })))
}

export async function updateMap(siteId: string, cameraId: string, draft: ParkingMapDraft, body: ParkingMapWriteRequest): Promise<ParkingMapDraft> {
  return normalizeMap(await parse(fetch(`${base(siteId, cameraId)}/maps/${draft.id}`, {
    method: 'PUT',
    headers: jsonHeaders({ 'If-Match': `\"${draft.id}:${draft.lockVersion}\"` }),
    body: JSON.stringify(body),
  })))
}

export async function deleteMap(siteId: string, cameraId: string, draft: ParkingMapDraft): Promise<void> {
  const response = await fetch(`${base(siteId, cameraId)}/maps/${draft.id}`, {
    method: 'DELETE', headers: jsonHeaders({ 'If-Match': `\"${draft.id}:${draft.lockVersion}\"` }),
  })
  if (!response.ok) await parse(response)
}

export async function validateMap(siteId: string, cameraId: string, mapId: string): Promise<ParkingMapValidation> {
  return parse(fetch(`${base(siteId, cameraId)}/maps/${mapId}:validate`, {
    method: 'POST', headers: jsonHeaders(),
  }))
}

export async function publishMap(siteId: string, cameraId: string, draft: ParkingMapDraft): Promise<ParkingMapDraft> {
  return normalizeMap(await parse(fetch(`${base(siteId, cameraId)}/maps/${draft.id}:publish`, {
    method: 'POST',
    headers: jsonHeaders({
      'Idempotency-Key': crypto.randomUUID(),
      'If-Match': `\"${draft.id}:${draft.lockVersion}\"`,
    }),
  })))
}

export async function archiveMap(siteId: string, cameraId: string, map: ParkingMapDraft): Promise<void> {
  const response = await fetch(`${base(siteId, cameraId)}/maps/${map.id}:archive`, {
    method: 'POST', headers: jsonHeaders({ 'If-Match': `\"${map.id}:${map.lockVersion}\"` }),
  })
  if (!response.ok) await parse(response)
}

export async function rollbackMap(
  siteId: string,
  cameraId: string,
  map: ParkingMapDraft,
  reason: string,
): Promise<ParkingMapDraft> {
  return normalizeMap(await parse(fetch(`${base(siteId, cameraId)}/maps/${map.id}:rollback`, {
    method: 'POST',
    headers: jsonHeaders({ 'If-Match': `\"${map.id}:${map.lockVersion}\"` }),
    body: JSON.stringify({ reason }),
  })))
}

export async function removeMap(siteId: string, cameraId: string, map: ParkingMapDraft): Promise<void> {
  const response = await fetch(`${base(siteId, cameraId)}/maps/${map.id}`, {
    method: 'DELETE',
    headers: jsonHeaders({ 'If-Match': `\"${map.id}:${map.lockVersion}\"` }),
  })
  if (!response.ok) await parse(response)
}

export async function getUnifiedPreview(siteId: string): Promise<UnifiedMapPreview> {
  return parse(fetch(`${getApiUrl()}/v1/sites/${siteId}/maps/preview`, { headers: jsonHeaders() }))
}

export async function exportMap(siteId: string, cameraId: string, mapId: string): Promise<Blob> {
  const response = await fetch(`${base(siteId, cameraId)}/maps/${mapId}/export`, { headers: jsonHeaders() })
  if (!response.ok) await parse(response)
  return response.blob()
}

export async function importMap(
  siteId: string,
  cameraId: string,
  sourceImageId: string,
  calibrationVersionId: string,
  geoJson: unknown,
): Promise<ParkingMapDraft> {
  return normalizeMap(await parse(fetch(`${base(siteId, cameraId)}/maps:import`, {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify({ sourceImageId, calibrationVersionId, geoJson }),
  })))
}
