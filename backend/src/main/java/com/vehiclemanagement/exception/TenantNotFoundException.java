package com.vehiclemanagement.exception;

import java.util.UUID;

public class TenantNotFoundException extends RuntimeException {
    public TenantNotFoundException(UUID tenantId) {
        super("Tenant not found with id: " + tenantId);
    }
}
