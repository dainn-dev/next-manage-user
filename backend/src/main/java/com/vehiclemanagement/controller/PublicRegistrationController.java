package com.vehiclemanagement.controller;

import com.vehiclemanagement.dto.PublicRegistrationRequest;
import com.vehiclemanagement.dto.PublicRegistrationResponse;
import com.vehiclemanagement.service.PublicRegistrationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
@Tag(name = "Authentication", description = "Public registration and authentication APIs")
public class PublicRegistrationController {

    private final PublicRegistrationService registrationService;

    public PublicRegistrationController(PublicRegistrationService registrationService) {
        this.registrationService = registrationService;
    }

    @PostMapping("/register")
    @Operation(summary = "Register a new organization", description = "Create an organization, its first site, and tenant administrator")
    public ResponseEntity<PublicRegistrationResponse> register(
            @Valid @RequestBody PublicRegistrationRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(registrationService.register(request));
    }
}
