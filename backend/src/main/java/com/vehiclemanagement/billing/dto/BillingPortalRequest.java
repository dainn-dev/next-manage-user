package com.vehiclemanagement.billing.dto;

import jakarta.validation.constraints.NotBlank;

public class BillingPortalRequest {

    @NotBlank(message = "Return URL is required")
    private String returnUrl;

    public String getReturnUrl() {
        return returnUrl;
    }

    public void setReturnUrl(String returnUrl) {
        this.returnUrl = returnUrl;
    }
}
