import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateOccupancyMetrics, formatDuration } from '../lib/dashboard-metrics.mjs'
import { canonicalPlate, validPlateQuery } from '../lib/plate-search.mjs'
import {
  canAccessOperatorRouteValue,
  needsDashboardLiveData,
  resolveTenantFacilityId,
} from '../lib/dashboard-policy.mjs'

test('role-scoped routes enforce security guard operational subset', () => {
  assert.equal(canAccessOperatorRouteValue('ADMIN', '/statistics'), true)
  assert.equal(canAccessOperatorRouteValue('SITE_MANAGER', '/statistics'), true)
  assert.equal(canAccessOperatorRouteValue('SECURITY_GUARD', '/statistics'), false)
  assert.equal(canAccessOperatorRouteValue('MEMBER', '/statistics'), false)
  assert.equal(canAccessOperatorRouteValue('SITE_MANAGER', '/parking/maps'), true)
  assert.equal(canAccessOperatorRouteValue('SITE_MANAGER', '/users'), false)
  assert.equal(canAccessOperatorRouteValue('SECURITY_GUARD', '/events'), true)
  assert.equal(canAccessOperatorRouteValue('ADMIN', '/parking/commissioning'), true)
  assert.equal(canAccessOperatorRouteValue('SITE_MANAGER', '/parking/commissioning'), true)
  assert.equal(canAccessOperatorRouteValue('SECURITY_GUARD', '/parking/commissioning'), false)
  assert.equal(canAccessOperatorRouteValue('SECURITY_GUARD', '/users'), false)
  assert.equal(canAccessOperatorRouteValue('MEMBER', '/dashboard'), false)
})

test('tenant scope uses one operating facility without a stored preference', () => {
  const facilities = [{ id: 'a' }]
  assert.equal(resolveTenantFacilityId(facilities), 'a')
  assert.equal(resolveTenantFacilityId([]), null)
})

test('dashboard live data only runs on routes that consume cameras/slots/events', () => {
  assert.equal(needsDashboardLiveData('/dashboard'), true)
  assert.equal(needsDashboardLiveData('/events'), true)
  assert.equal(needsDashboardLiveData('/parking/maps'), true)
  assert.equal(needsDashboardLiveData('/parking/cameras'), true)
  assert.equal(needsDashboardLiveData('/parking/slots'), true)
  assert.equal(needsDashboardLiveData('/statistics'), true)
  assert.equal(needsDashboardLiveData('/vehicles/search'), false)
  assert.equal(needsDashboardLiveData('/vehicles'), false)
  assert.equal(needsDashboardLiveData('/vehicles/monitoring'), false)
  assert.equal(needsDashboardLiveData('/gate'), false)
  assert.equal(needsDashboardLiveData('/gate/abc'), false)
  assert.equal(needsDashboardLiveData('/parking/agents'), false)
  assert.equal(needsDashboardLiveData('/parking/commissioning'), false)
  assert.equal(needsDashboardLiveData('/users'), false)
  assert.equal(needsDashboardLiveData('/billing'), false)
  assert.equal(needsDashboardLiveData('/settings/organization'), false)
  assert.equal(needsDashboardLiveData(null), false)
})

test('occupancy metrics react to slot state changes', () => {
  const slots = [
    { status: 'OCCUPIED', lastSeenAt: '2026-07-14T09:00:00Z' },
    { status: 'AVAILABLE', lastSeenAt: null },
    { status: 'DISABLED', lastSeenAt: null },
  ]
  assert.deepEqual(calculateOccupancyMetrics(slots), {
    totalSlots: 3,
    usableSlots: 2,
    occupiedSlots: 1,
    availableSlots: 1,
    reservedSlots: 0,
    disabledSlots: 1,
    unknownSlots: 0,
    currentVehicles: 1,
    fillRate: 0.5,
  })
  slots[1] = { status: 'OCCUPIED', lastSeenAt: '2026-07-14T09:30:00Z' }
  assert.deepEqual(calculateOccupancyMetrics(slots), {
    totalSlots: 3,
    usableSlots: 2,
    occupiedSlots: 2,
    availableSlots: 0,
    reservedSlots: 0,
    disabledSlots: 1,
    unknownSlots: 0,
    currentVehicles: 2,
    fillRate: 1,
  })
})

test('occupancy metrics and durations handle partial and empty data safely', () => {
  const slots = [
    { status: 'RESERVED' },
    { status: 'UNKNOWN' },
    { status: 'DISABLED' },
  ]
  const metrics = calculateOccupancyMetrics(slots)
  assert.equal(metrics.usableSlots, 2)
  assert.equal(metrics.reservedSlots, 1)
  assert.equal(metrics.unknownSlots, 1)
  assert.equal(metrics.fillRate, 0)
  assert.equal(Number.isFinite(metrics.fillRate), true)
  assert.equal(calculateOccupancyMetrics([]).fillRate, 0)

  assert.equal(formatDuration(0), '0 phút')
  assert.equal(formatDuration(30 * 60), '30 phút')
  assert.equal(formatDuration(60 * 60), '1 giờ')
  assert.equal(formatDuration(90 * 60), '1 giờ 30 phút')
})

test('plate search canonicalizes common Vietnamese plate formatting', () => {
  assert.equal(canonicalPlate('51a-123.45'), '51A12345')
  assert.equal(canonicalPlate(' 30 g_999 99 '), '30G99999')
  assert.equal(validPlateQuery('a'), false)
  assert.equal(validPlateQuery('51'), true)
})
