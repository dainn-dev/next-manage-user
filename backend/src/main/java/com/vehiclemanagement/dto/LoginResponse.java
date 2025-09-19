package com.vehiclemanagement.dto;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LoginResponse {
    
    private String token;
    @Builder.Default
    private String tokenType = "Bearer";
    private String username;
    private String email;
    private String role;
    private LocalDateTime expiresAt;
    private UserDto user;
}
