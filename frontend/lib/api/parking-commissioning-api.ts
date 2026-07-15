import { authApi } from './auth-api'
import { getApiUrl } from './config'

export interface CalibrationPoint { pixelX: number; pixelY: number; siteX: number; siteY: number }
export interface CalibrationVersion { id: string; siteId: string; cameraId: string; versionNumber: number; homography: number[]; reprojectionError: number; coordinateSpace: string }

export async function createCalibration(siteId: string, cameraId: string, controlPoints: CalibrationPoint[]) {
  const response = await fetch(`${getApiUrl()}/sites/${siteId}/parking-map-calibrations`, {
    method: 'POST', headers: authApi.getAuthHeaders(), body: JSON.stringify({ cameraId, controlPoints }),
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.message || `Calibration failed (${response.status})`)
  return body as CalibrationVersion
}
