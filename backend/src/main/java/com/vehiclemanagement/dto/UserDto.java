package com.vehiclemanagement.dto;

import com.vehiclemanagement.entity.User;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserDto {
    
    private UUID id;
    
    @NotBlank(message = "Username is required")
    @Size(min = 3, max = 50, message = "Username must be between 3 and 50 characters")
    private String username;
    
    @Email(message = "Email should be valid")
    @NotBlank(message = "Email is required")
    private String email;
    
    private String firstName;
    private String lastName;
    private String fullName;
    private User.Role role;
    private User.UserStatus status;
    private LocalDateTime lastLogin;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    
    // Employee information if linked
    private UUID employeeId;
    private String employeeName;
    
    // Constructor from User entity
    public UserDto(User user) {
        this.id = user.getId();
        this.username = user.getUsername();
        this.email = user.getEmail();
        this.firstName = user.getFirstName();
        this.lastName = user.getLastName();
        this.fullName = user.getFullName();
        this.role = user.getRole();
        this.status = user.getStatus();
        this.lastLogin = user.getLastLogin();
        this.createdAt = user.getCreatedAt();
        this.updatedAt = user.getUpdatedAt();
        
        if (user.getEmployee() != null) {
            this.employeeId = user.getEmployee().getId();
            this.employeeName = user.getEmployee().getName();
        }
    }
}
