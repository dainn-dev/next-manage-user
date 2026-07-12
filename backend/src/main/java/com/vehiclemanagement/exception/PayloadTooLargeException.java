package com.vehiclemanagement.exception;

/** Raised when an upload exceeds an endpoint's permitted payload size. */
public class PayloadTooLargeException extends RuntimeException {

    public PayloadTooLargeException(String message) {
        super(message);
    }
}
