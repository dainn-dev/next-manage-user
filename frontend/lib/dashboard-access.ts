import { UserRole, isDashboardOperator } from './types'
import { canAccessOperatorRouteValue } from './dashboard-policy.mjs'

export function canAccessOperatorRoute(role: UserRole | undefined, pathname: string | null): boolean {
  return canAccessOperatorRouteValue(role, pathname)
}

export function operatorLandingPath(role: UserRole | undefined): string {
  return isDashboardOperator(role) ? '/dashboard' : '/vehicles'
}
