package com.vehiclemanagement.parking;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.UUID;

@Data
public class UpsertSiteBankAccountRequest {
    @NotNull
    private UUID siteId;
    @NotBlank
    private String bankCode;
    @NotBlank
    private String accountNumber;
    @NotBlank
    private String accountName;
}
