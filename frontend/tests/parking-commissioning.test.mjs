import test from 'node:test'
import assert from 'node:assert/strict'
import {
  calibrationInputReady,
  calibrationPointsToGridCorners,
  mapPublishReady,
  offsetSlotCopy,
  zoneDeletionBlockers,
} from '../lib/parking-commissioning-policy.mjs'
import { normalizeMapStatus, normalizeSlotStatus } from '../lib/parking-commissioning-contract.mjs'

test('wire contract normalizes backend lifecycle and slot statuses', () => {
  assert.equal(normalizeMapStatus('draft'), 'DRAFT')
  assert.equal(normalizeMapStatus('published'), 'PUBLISHED')
  assert.equal(normalizeMapStatus('archived'), 'ARCHIVED')
  assert.equal(normalizeSlotStatus('enabled'), 'ACTIVE')
  assert.equal(normalizeSlotStatus('retired'), 'DISABLED')
})

test('calibration requires four unique image-to-site control pairs', () => {
  const points = [
    { pixelX: 10, pixelY: 10, siteX: 0, siteY: 0 },
    { pixelX: 90, pixelY: 10, siteX: 10, siteY: 0 },
    { pixelX: 90, pixelY: 90, siteX: 10, siteY: 8 },
    { pixelX: 10, pixelY: 90, siteX: 0, siteY: 8 },
  ]
  assert.equal(calibrationInputReady(points.slice(0, 3)), false)
  assert.equal(calibrationInputReady(points), true)
  assert.equal(calibrationInputReady([...points.slice(0, 3), points[0]]), false)
})

test('calibration image points seed grid corners in top-left clockwise order', () => {
  const points = [
    { pixelX: 90, pixelY: 90 },
    { pixelX: 10, pixelY: 10 },
    { pixelX: 10, pixelY: 90 },
    { pixelX: 90, pixelY: 10 },
  ]

  assert.deepEqual(calibrationPointsToGridCorners(points), [
    { x: 10, y: 10 },
    { x: 90, y: 10 },
    { x: 90, y: 90 },
    { x: 10, y: 90 },
  ])
  assert.deepEqual(calibrationPointsToGridCorners(points.slice(0, 3)), [])
})

test('zone deletion reports dependent cameras for safe reassignment', () => {
  const cameras = [
    { name: 'Legacy overview B1', role: 'OVERVIEW', zoneId: 'b1' },
    { name: 'Gate in', role: 'ANPR_GATE', zoneId: 'gate' },
    { name: 'Gate B1 east', role: 'ANPR_GATE', zoneId: 'b1' },
  ]
  assert.deepEqual(zoneDeletionBlockers('b1', cameras), ['Gate B1 east'])
  assert.deepEqual(zoneDeletionBlockers('empty', cameras), [])
})

test('publish remains blocked until the current draft passes server validation', () => {
  const draft = { id: 'map-1', status: 'DRAFT' }
  assert.equal(mapPublishReady(draft, null), false)
  assert.equal(mapPublishReady(draft, { valid: false }), false)
  assert.equal(mapPublishReady(draft, { valid: true }), true)
  assert.equal(mapPublishReady({ ...draft, status: 'PUBLISHED' }, { valid: true }), false)
})

test('copy slot creates an independent offset polygon', () => {
  const source = { slotId: 'slot-1', code: 'A-01', pixelVertices: [{ x: 5, y: 7 }] }
  const copy = offsetSlotCopy(source)
  assert.equal(copy.slotId, null)
  assert.equal(copy.code, 'A-01-COPY')
  assert.deepEqual(copy.pixelVertices, [{ x: 17, y: 19 }])
  assert.notEqual(copy.pixelVertices, source.pixelVertices)
})
