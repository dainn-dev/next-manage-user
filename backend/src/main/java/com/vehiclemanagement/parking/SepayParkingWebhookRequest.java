package com.vehiclemanagement.parking;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class SepayParkingWebhookRequest {
    /** Transfer memo / description containing our PV… code. */
    @NotBlank
    private String content;

    private String transferAmount;

    private String referenceCode;
}
