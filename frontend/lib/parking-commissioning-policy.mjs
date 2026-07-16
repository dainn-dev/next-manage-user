/** Commissioning requires four non-duplicated image and site-plane correspondences. */
export function calibrationInputReady(points) {
  if (!Array.isArray(points) || points.length < 4) return false
  const pixelPairs = new Set(points.map((point) => `${point.pixelX}:${point.pixelY}`))
  const sitePairs = new Set(points.map((point) => `${point.siteX}:${point.siteY}`))
  return pixelPairs.size === points.length && sitePairs.size === points.length
}

/** Return camera names that must be reassigned before a zone can be deleted. */
export function zoneDeletionBlockers(zoneId, cameras) {
  return (cameras || []).filter((camera) => camera.zoneId === zoneId).map((camera) => camera.name)
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
