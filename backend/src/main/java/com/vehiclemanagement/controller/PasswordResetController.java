package com.vehiclemanagement.controller;

import com.vehiclemanagement.dto.PasswordResetConfirmRequest;
import com.vehiclemanagement.dto.PasswordResetRequest;
import com.vehiclemanagement.dto.PasswordResetResponse;
import com.vehiclemanagement.service.PasswordResetService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import static org.springframework.http.HttpStatus.ACCEPTED;

@RestController
@RequestMapping("/api/auth/password-reset")
@Tag(name = "Password recovery", description = "Password reset APIs")
public class PasswordResetController {

    private final PasswordResetService passwordResetService;

    public PasswordResetController(PasswordResetService passwordResetService) {
        this.passwordResetService = passwordResetService;
    }

    @PostMapping("/request")
    @Operation(summary = "Request a password reset")
    public ResponseEntity<PasswordResetResponse> request(
            @Valid @RequestBody PasswordResetRequest request,
            HttpServletRequest servletRequest) {
        String message = passwordResetService.requestReset(request, servletRequest.getRemoteAddr());
        return ResponseEntity.status(ACCEPTED).body(new PasswordResetResponse(message));
    }

    @PostMapping("/confirm")
    @Operation(summary = "Confirm a password reset")
    public ResponseEntity<PasswordResetResponse> confirm(
            @Valid @RequestBody PasswordResetConfirmRequest request) {
        passwordResetService.confirmReset(request);
        return ResponseEntity.ok(new PasswordResetResponse("Password reset successfully"));
    }
}
