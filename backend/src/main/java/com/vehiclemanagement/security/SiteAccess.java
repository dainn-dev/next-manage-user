package com.vehiclemanagement.security;

import org.springframework.stereotype.Component;

import java.util.Collections;
import java.util.List;
import java.util.UUID;

/**
 * Transitional compatibility guard for APIs that still carry an internal
 * facility id. Tenant RLS is the only authorization boundary in the
 * single-facility model; there is no per-user branch assignment.
 */
@Component
public class SiteAccess {

    public List<UUID> allowedSiteIds() {
        return Collections.emptyList();
    }

    public boolean isRestricted() {
        return false;
    }

    public boolean isSiteAllowed(UUID siteId) {
        return siteId != null;
    }

    public void assertSiteAllowed(UUID siteId) {
        if (!isSiteAllowed(siteId)) {
            throw new IllegalArgumentException("Operating facility is required");
        }
    }

    public void assertAnyAssignedSite() {
        // Kept for source compatibility while callers are migrated to tenant scope.
    }

    public static boolean currentUserIsSiteScoped() {
        return false;
    }
}
