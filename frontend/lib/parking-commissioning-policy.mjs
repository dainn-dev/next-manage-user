/** Commissioning requires four non-duplicated image and site-plane correspondences. */
export function calibrationInputReady(points) {
  if (!Array.isArray(points) || points.length < 4) return false
  const pixelPairs = new Set(points.map((point) => `${point.pixelX}:${point.pixelY}`))
  const sitePairs = new Set(points.map((point) => `${point.siteX}:${point.siteY}`))
  return pixelPairs.size === points.length && sitePairs.size === points.length
}

/** Convert the first four calibration image points into the grid generator's corner order. */
export function calibrationPointsToGridCorners(points) {
  if (!Array.isArray(points) || points.length < 4) return []

  const corners = points.slice(0, 4).map((point) => ({ x: point.pixelX, y: point.pixelY }))
  const center = corners.reduce(
    (result, point) => ({ x: result.x + point.x / 4, y: result.y + point.y / 4 }),
    { x: 0, y: 0 },
  )
  const clockwise = corners.sort(
    (left, right) => Math.atan2(left.y - center.y, left.x - center.x)
      - Math.atan2(right.y - center.y, right.x - center.x),
  )
  const topLeftIndex = clockwise.reduce(
    (best, point, index) => point.x + point.y < clockwise[best].x + clockwise[best].y ? index : best,
    0,
  )

  return [...clockwise.slice(topLeftIndex), ...clockwise.slice(0, topLeftIndex)]
}

/** Return camera names that must be reassigned before a zone can be deleted. */
export function zoneDeletionBlockers(zoneId, cameras) {
  return (cameras || [])
    .filter((camera) => camera.role !== 'OVERVIEW' && camera.zoneId === zoneId)
    .map((camera) => camera.name)
}

/** Publishing is deliberately gated by a server validation result for this draft. */
export function mapPublishReady(draft, validation) {
  return Boolean(draft && draft.status === 'DRAFT' && validation?.valid === true)
}

/** Create an independent, visibly offset polygon for the copy-slot interaction. */
export function offsetSlotCopy(slot, offset = 12) {
  return {
    ...slot,
    slotId: null,
    code: `${slot.code}-COPY`,
    pixelVertices: slot.pixelVertices.map((point) => ({ x: point.x + offset, y: point.y + offset })),
  }
}
