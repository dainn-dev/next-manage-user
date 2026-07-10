package com.vehiclemanagement.billing;

public class EntitlementExceededException extends RuntimeException {

    private final String code;
    private final String metric;
    private final long limit;
    private final long currentUsage;
    private final String upgradeUrl;

    public EntitlementExceededException(String metric, long limit, long currentUsage, String upgradeUrl) {
        super("Entitlement exceeded for " + metric);
        this.code = "ENTITLEMENT_EXCEEDED";
        this.metric = metric;
        this.limit = limit;
        this.currentUsage = currentUsage;
        this.upgradeUrl = upgradeUrl;
    }

    public String getCode() {
        return code;
    }

    public String getMetric() {
        return metric;
    }

    public long getLimit() {
        return limit;
    }

    public long getCurrentUsage() {
        return currentUsage;
    }

    public String getUpgradeUrl() {
        return upgradeUrl;
    }
}
