package com.vehiclemanagement.exception;

/**
 * A request that conflicts with existing state — e.g. a duplicate camera name
 * within a site. Mapped to HTTP 409 by {@link GlobalExceptionHandler}.
 */
public class ConflictException extends RuntimeException {

    public ConflictException(String message) {
        super(message);
    }

    public ConflictException(String message, Throwable cause) {
        super(message, cause);
    }
}
