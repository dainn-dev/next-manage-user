package com.vehiclemanagement.config;

import java.util.Collections;
import java.util.List;
import java.util.UUID;

/**
 * Request-scoped site membership from the JWT {@code site_ids} claim.
 *
 * <p>Empty list = unrestricted within the tenant (TENANT_ADMIN / platform).
 * Non-empty = SITE_MANAGER scoped to those sites only.
 */
public final class SiteContext {

    private static final ThreadLocal<List<UUID>> CURRENT = new ThreadLocal<>();

    private SiteContext() {
    }

    public static void setSiteIds(List<UUID> siteIds) {
        if (siteIds == null || siteIds.isEmpty()) {
            CURRENT.set(Collections.emptyList());
        } else {
            CURRENT.set(List.copyOf(siteIds));
        }
    }

    /** Bound site ids, or empty when unrestricted / unset. */
    public static List<UUID> getSiteIds() {
        List<UUID> ids = CURRENT.get();
        return ids == null ? Collections.emptyList() : ids;
    }

    public static boolean isRestricted() {
        return !getSiteIds().isEmpty();
    }

    public static void clear() {
        CURRENT.remove();
    }
}
