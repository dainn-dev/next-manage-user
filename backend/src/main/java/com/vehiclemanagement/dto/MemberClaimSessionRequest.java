package com.vehiclemanagement.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class MemberClaimSessionRequest {
    /** Session UUID or printed QR token (qr_token_jti). */
    @NotBlank
    private String code;
}
