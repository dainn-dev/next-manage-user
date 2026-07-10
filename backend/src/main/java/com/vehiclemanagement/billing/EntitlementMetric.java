package com.vehiclemanagement.billing;

public enum EntitlementMetric {
    MAX_SITES("max_sites"),
    MAX_CAMERAS_PER_SITE("max_cameras_per_site"),
    USERS_PER_TENANT("users_per_tenant");

    private final String limitKey;

    EntitlementMetric(String limitKey) {
        this.limitKey = limitKey;
    }

    public String limitKey() {
        return limitKey;
    }
}
