package com.vehiclemanagement.entity;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

import java.util.Locale;

public enum TenantStatus {
    ACTIVE("active"),
    SUSPENDED("suspended"),
    PENDING_DELETION("pending_deletion");

    private final String value;

    TenantStatus(String value) {
        this.value = value;
    }

    @JsonValue
    public String value() {
        return value;
    }

    @JsonCreator
    public static TenantStatus fromValue(String value) {
        if (value == null) {
            return null;
        }
        String normalized = value.trim().toLowerCase(Locale.ROOT);
        for (TenantStatus status : values()) {
            if (status.value.equals(normalized)) {
                return status;
            }
        }
        throw new IllegalArgumentException("Unsupported tenant status: " + value);
    }
}
