package com.vehiclemanagement.billing;

public class EntitlementCheckUnavailableException extends RuntimeException {

    public EntitlementCheckUnavailableException(String message) {
        super(message);
    }

    public EntitlementCheckUnavailableException(String message, Throwable cause) {
        super(message, cause);
    }
}
