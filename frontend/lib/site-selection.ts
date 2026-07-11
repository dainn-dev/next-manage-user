/**
 * Client-side preferred site for SITE_MANAGER UX filtering.
 * API still returns the union of JWT site_ids; this narrows lists in the UI.
 */

const STORAGE_KEY = 'pv_selected_site_id'

export function getSelectedSiteId(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(STORAGE_KEY)
}

export function setSelectedSiteId(siteId: string | null): void {
  if (typeof window === 'undefined') return
  if (!siteId) {
    localStorage.removeItem(STORAGE_KEY)
  } else {
    localStorage.setItem(STORAGE_KEY, siteId)
  }
  window.dispatchEvent(new CustomEvent('pv-site-selection', { detail: siteId }))
}

export function resolvePreferredSiteId(assignedSiteIds: string[] | undefined): string | null {
  if (!assignedSiteIds || assignedSiteIds.length === 0) return null
  const stored = getSelectedSiteId()
  if (stored && assignedSiteIds.includes(stored)) return stored
  return assignedSiteIds[0]
}
