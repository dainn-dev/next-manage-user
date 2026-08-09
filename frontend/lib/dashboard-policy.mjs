export const OPERATOR_ROLES = ['ADMIN', 'SITE_MANAGER', 'SECURITY_GUARD']
const GUARD_ROUTE_ROOTS = ['/dashboard', '/vehicles/monitoring', '/vehicles/search', '/events', '/parking']
const TENANT_ADMIN_ONLY_ROOTS = ['/users', '/billing', '/settings/organization']
const MANAGER_ONLY_ROOTS = ['/parking/commissioning']

/** Routes that need cameras/slots/events/analytics + site realtime feed. */
const DASHBOARD_LIVE_DATA_ROOTS = [
  '/dashboard',
  '/events',
  '/parking/maps',
  '/parking/cameras',
  '/parking/slots',
  '/statistics',
]

export function canAccessOperatorRouteValue(role, pathname) {
  if (!role || !pathname || !OPERATOR_ROLES.includes(role)) return false
  if (role === 'ADMIN') return true
  if (role === 'SITE_MANAGER') {
    return !TENANT_ADMIN_ONLY_ROOTS.some((root) => pathname === root || pathname.startsWith(`${root}/`))
  }
  if (MANAGER_ONLY_ROOTS.some((root) => pathname === root || pathname.startsWith(`${root}/`))) return false
  return GUARD_ROUTE_ROOTS.some((root) => pathname === root || pathname.startsWith(`${root}/`))
}

/**
 * Whether the current route should keep the dashboard data feed alive
 * (REST refresh + STOMP + polling). Other sidebar pages stay idle so navigation
 * is not blocked by background cameras/slots/events traffic.
 */
export function needsDashboardLiveData(pathname) {
  if (!pathname) return false
  return DASHBOARD_LIVE_DATA_ROOTS.some(
    (root) => pathname === root || pathname.startsWith(`${root}/`),
  )
}

/** Exactly one operating facility belongs to each tenant. */
export function resolveTenantFacilityId(facilities) {
  return facilities[0]?.id || null
}
