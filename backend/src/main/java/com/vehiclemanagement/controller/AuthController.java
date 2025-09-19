package com.vehiclemanagement.controller;

import com.vehiclemanagement.dto.LoginRequest;
import com.vehiclemanagement.dto.LoginResponse;
import com.vehiclemanagement.dto.UserDto;
import com.vehiclemanagement.service.AuthService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@Tag(name = "Authentication", description = "APIs for user authentication")
public class AuthController {
    
    @Autowired
    private AuthService authService;
    
    @PostMapping("/login")
    @Operation(summary = "User login", description = "Authenticate user and return JWT token")
    public ResponseEntity<LoginResponse> login(@Valid @RequestBody LoginRequest loginRequest) {
        LoginResponse response = authService.login(loginRequest);
        return ResponseEntity.ok(response);
    }
    
    @GetMapping("/me")
    @Operation(summary = "Get current user", description = "Get current authenticated user information")
    public ResponseEntity<UserDto> getCurrentUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        String username = authentication.getName();
        UserDto user = authService.getCurrentUser(username);
        return ResponseEntity.ok(user);
    }
    
    @PostMapping("/logout")
    @Operation(summary = "User logout", description = "Logout user (client should discard token)")
    public ResponseEntity<String> logout() {
        // In a stateless JWT system, logout is handled client-side by discarding the token
        // For additional security, you could implement a token blacklist
        return ResponseEntity.ok("Logged out successfully");
    }
}
