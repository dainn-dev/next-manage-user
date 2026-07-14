package com.vehiclemanagement.security;

import com.vehiclemanagement.config.SiteContext;
import com.vehiclemanagement.entity.User;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.UUID;

/**
 * App-layer site scoping for SITE_MANAGER. Empty {@link SiteContext} site ids
 * mean tenant-wide access for TENANT_ADMIN; SITE_MANAGER is always restricted
 * (empty assignment → no sites).
 */
@Component
public class SiteAccess {

    public List<UUID> allowedSiteIds() {
        return SiteContext.getSiteIds();
    }

    public boolean isRestricted() {
        return currentUserIsSiteScoped() || SiteContext.isRestricted();
    }

    public boolean isSiteAllowed(UUID siteId) {
        if (siteId == null) {
            return !isRestricted();
        }
        if (!isRestricted()) {
            return true;
        }
        return allowedSiteIds().contains(siteId);
    }

    public void assertSiteAllowed(UUID siteId) {
        if (!isSiteAllowed(siteId)) {
            throw new AccessDeniedException("Site is outside your assigned branches");
        }
    }

    public void assertAnyAssignedSite() {
        if (isRestricted() && allowedSiteIds().isEmpty()) {
            throw new AccessDeniedException("No sites assigned to this site manager");
        }
    }

    public static boolean currentUserIsSiteScoped() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getPrincipal() instanceof User user)) {
            return false;
        }
        return user.getRole() == User.Role.SITE_MANAGER
                || user.getRole() == User.Role.SECURITY_GUARD;
    }
}
