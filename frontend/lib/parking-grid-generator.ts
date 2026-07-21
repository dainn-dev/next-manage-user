/**
 * Parking Grid Generator - Bilinear Interpolation
 *
 * Generates a grid of parking slots from 4 corner points using bilinear interpolation.
 * Corner order: top-left, top-right, bottom-right, bottom-left
 */

export interface Point {
  x: number
  y: number
}

export interface GridConfig {
  rows: number
  cols: number
  prefix: string
  zoneId: string
  status: 'ACTIVE' | 'RESERVED' | 'DISABLED'
}

export interface ParkingSlot {
  code: string
  zoneId: string
  adminStatus: 'ACTIVE' | 'RESERVED' | 'DISABLED'
  pixelVertices: Point[]
}

/**
 * Bilinear interpolation to find a point in a quadrilateral
 * @param corners [top-left, top-right, bottom-right, bottom-left]
 * @param u horizontal parameter (0 to 1)
 * @param v vertical parameter (0 to 1)
 */
function bilinearInterpolate(corners: [Point, Point, Point, Point], u: number, v: number): Point {
  const [tl, tr, br, bl] = corners

  // Bilinear interpolation formula
  const x =
    (1 - u) * (1 - v) * tl.x +
    u * (1 - v) * tr.x +
    u * v * br.x +
    (1 - u) * v * bl.x

  const y =
    (1 - u) * (1 - v) * tl.y +
    u * (1 - v) * tr.y +
    u * v * br.y +
    (1 - u) * v * bl.y

  return { x, y }
}

/**
 * Generate grid of parking slots with small inset to prevent overlap after homography transform.
 *
 * Homography transforms don't preserve topology - adjacent cells sharing edges in pixel space
 * can overlap after projecting to world coordinates. Adding a 0.3% inset ensures a small gap
 * that survives the transform.
 */
export function generateGridSlots(
  corners: [Point, Point, Point, Point],
  config: GridConfig
): ParkingSlot[] {
  const { rows, cols, prefix, zoneId, status } = config
  const slots: ParkingSlot[] = []

  // Small inset (0.3% on each side) to prevent overlap after homography transform
  const INSET = 0.003

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      // Calculate normalized coordinates for this cell with inset
      const cellWidth = 1 / cols
      const cellHeight = 1 / rows

      const u0 = (col * cellWidth) + (cellWidth * INSET)
      const u1 = ((col + 1) * cellWidth) - (cellWidth * INSET)
      const v0 = (row * cellHeight) + (cellHeight * INSET)
      const v1 = ((row + 1) * cellHeight) - (cellHeight * INSET)

      // Calculate the 4 corners of this slot
      const topLeft = bilinearInterpolate(corners, u0, v0)
      const topRight = bilinearInterpolate(corners, u1, v0)
      const bottomRight = bilinearInterpolate(corners, u1, v1)
      const bottomLeft = bilinearInterpolate(corners, u0, v1)

      // Generate slot code
      const slotNumber = (row * cols + col + 1).toString().padStart(2, '0')
      const code = `${prefix}${slotNumber}`

      slots.push({
        code,
        zoneId,
        adminStatus: status,
        pixelVertices: [topLeft, topRight, bottomRight, bottomLeft],
      })
    }
  }

  return slots
}

/**
 * Validate grid configuration
 */
export function validateGridConfig(
  corners: Point[],
  config: GridConfig
): { valid: boolean; error?: string } {
  if (corners.length !== 4) {
    return { valid: false, error: 'Cần chọn đúng 4 góc' }
  }

  if (config.rows < 1 || config.rows > 50) {
    return { valid: false, error: 'Số hàng phải từ 1-50' }
  }

  if (config.cols < 1 || config.cols > 50) {
    return { valid: false, error: 'Số cột phải từ 1-50' }
  }

  if (!config.prefix.trim()) {
    return { valid: false, error: 'Cần nhập tiền tố mã ô' }
  }

  if (!config.zoneId) {
    return { valid: false, error: 'Cần chọn zone' }
  }

  const totalSlots = config.rows * config.cols
  if (totalSlots > 500) {
    return { valid: false, error: `Tổng số ô (${totalSlots}) vượt quá giới hạn 500` }
  }

  return { valid: true }
}
