export const OPERATOR_ROLES = ['ADMIN', 'SITE_MANAGER', 'SECURITY_GUARD']
export const SITE_SELECTOR_ROLES = ['ADMIN', 'SITE_MANAGER']
const GUARD_ROUTE_ROOTS = ['/dashboard', '/vehicles/monitoring', '/vehicles/search', '/events', '/parking']
const TENANT_ADMIN_ONLY_ROOTS = ['/users', '/sites', '/billing', '/settings/organization']

export function canAccessOperatorRouteValue(role, pathname) {
  if (!role || !pathname || !OPERATOR_ROLES.includes(role)) return false
  if (role === 'ADMIN') return true
  if (role === 'SITE_MANAGER') {
    return !TENANT_ADMIN_ONLY_ROOTS.some((root) => pathname === root || pathname.startsWith(`${root}/`))
  }
  return GUARD_ROUTE_ROOTS.some((root) => pathname === root || pathname.startsWith(`${root}/`))
}

export function filterScopedSites(role, assignedSiteIds, sites) {
  if (role === 'ADMIN') return sites
  const allowed = new Set(assignedSiteIds || [])
  return sites.filter((site) => allowed.has(site.id))
}

export function canSelectDashboardSite(role) {
  return SITE_SELECTOR_ROLES.includes(role)
}

export function resolveDashboardSiteId(storedSiteId, sites) {
  if (storedSiteId && sites.some((site) => site.id === storedSiteId)) return storedSiteId
  return sites[0]?.id || null
}
