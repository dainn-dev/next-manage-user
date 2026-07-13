package com.vehiclemanagement.billing;

public class BillingDisabledException extends RuntimeException {

    public BillingDisabledException() {
        super("Billing is disabled");
    }
}
