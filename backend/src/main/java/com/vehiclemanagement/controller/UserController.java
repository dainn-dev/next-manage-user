package com.vehiclemanagement.controller;

import com.vehiclemanagement.dto.CreateUserRequest;
import com.vehiclemanagement.dto.UpdateUserRequest;
import com.vehiclemanagement.dto.UserDto;
import com.vehiclemanagement.entity.User;
import com.vehiclemanagement.service.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/admin/users")
@Tag(name = "User Management (Admin)", description = "APIs for managing users (Admin only)")
@PreAuthorize("hasRole('ADMIN') or hasRole('SUPER_ADMIN')")
public class UserController {
    
    @Autowired
    private UserService userService;
    
    @GetMapping
    @Operation(summary = "Get all users with pagination", description = "Retrieve a paginated list of all users")
    public ResponseEntity<Page<UserDto>> getAllUsers(
            @Parameter(description = "Page number (0-based)") @RequestParam(defaultValue = "0") int page,
            @Parameter(description = "Page size") @RequestParam(defaultValue = "10") int size,
            @Parameter(description = "Sort by field") @RequestParam(defaultValue = "createdAt") String sortBy,
            @Parameter(description = "Sort direction (asc/desc)") @RequestParam(defaultValue = "desc") String sortDir) {
        
        Sort sort = sortDir.equalsIgnoreCase("asc") ? 
            Sort.by(sortBy).ascending() : Sort.by(sortBy).descending();
        Pageable pageable = PageRequest.of(page, size, sort);
        
        Page<UserDto> users = userService.getAllUsers(pageable);
        return ResponseEntity.ok(users);
    }
    
    @GetMapping("/list")
    @Operation(summary = "Get all users as list", description = "Retrieve all users without pagination")
    public ResponseEntity<List<UserDto>> getAllUsersList() {
        List<UserDto> users = userService.getAllUsersList();
        return ResponseEntity.ok(users);
    }
    
    @GetMapping("/{id}")
    @Operation(summary = "Get user by ID", description = "Retrieve a specific user by their ID")
    public ResponseEntity<UserDto> getUserById(@PathVariable UUID id) {
        UserDto user = userService.getUserById(id);
        return ResponseEntity.ok(user);
    }
    
    @GetMapping("/username/{username}")
    @Operation(summary = "Get user by username", description = "Retrieve a specific user by their username")
    public ResponseEntity<UserDto> getUserByUsername(@PathVariable String username) {
        UserDto user = userService.getUserByUsername(username);
        return ResponseEntity.ok(user);
    }
    
    @GetMapping("/search")
    @Operation(summary = "Search users", description = "Search users by username, email, first name, or last name")
    public ResponseEntity<Page<UserDto>> searchUsers(
            @Parameter(description = "Search term") @RequestParam String searchTerm,
            @Parameter(description = "Page number (0-based)") @RequestParam(defaultValue = "0") int page,
            @Parameter(description = "Page size") @RequestParam(defaultValue = "10") int size,
            @Parameter(description = "Sort by field") @RequestParam(defaultValue = "createdAt") String sortBy,
            @Parameter(description = "Sort direction (asc/desc)") @RequestParam(defaultValue = "desc") String sortDir) {
        
        Sort sort = sortDir.equalsIgnoreCase("asc") ? 
            Sort.by(sortBy).ascending() : Sort.by(sortBy).descending();
        Pageable pageable = PageRequest.of(page, size, sort);
        
        Page<UserDto> users = userService.searchUsers(searchTerm, pageable);
        return ResponseEntity.ok(users);
    }
    
    @GetMapping("/role/{role}")
    @Operation(summary = "Get users by role", description = "Retrieve users filtered by role")
    public ResponseEntity<Page<UserDto>> getUsersByRole(
            @PathVariable User.Role role,
            @Parameter(description = "Page number (0-based)") @RequestParam(defaultValue = "0") int page,
            @Parameter(description = "Page size") @RequestParam(defaultValue = "10") int size,
            @Parameter(description = "Sort by field") @RequestParam(defaultValue = "createdAt") String sortBy,
            @Parameter(description = "Sort direction (asc/desc)") @RequestParam(defaultValue = "desc") String sortDir) {
        
        Sort sort = sortDir.equalsIgnoreCase("asc") ? 
            Sort.by(sortBy).ascending() : Sort.by(sortBy).descending();
        Pageable pageable = PageRequest.of(page, size, sort);
        
        Page<UserDto> users = userService.getUsersByRole(role, pageable);
        return ResponseEntity.ok(users);
    }
    
    @GetMapping("/status/{status}")
    @Operation(summary = "Get users by status", description = "Retrieve users filtered by status")
    public ResponseEntity<Page<UserDto>> getUsersByStatus(
            @PathVariable User.UserStatus status,
            @Parameter(description = "Page number (0-based)") @RequestParam(defaultValue = "0") int page,
            @Parameter(description = "Page size") @RequestParam(defaultValue = "10") int size,
            @Parameter(description = "Sort by field") @RequestParam(defaultValue = "createdAt") String sortBy,
            @Parameter(description = "Sort direction (asc/desc)") @RequestParam(defaultValue = "desc") String sortDir) {
        
        Sort sort = sortDir.equalsIgnoreCase("asc") ? 
            Sort.by(sortBy).ascending() : Sort.by(sortBy).descending();
        Pageable pageable = PageRequest.of(page, size, sort);
        
        Page<UserDto> users = userService.getUsersByStatus(status, pageable);
        return ResponseEntity.ok(users);
    }
    
    @PostMapping
    @Operation(summary = "Create new user", description = "Create a new user")
    public ResponseEntity<UserDto> createUser(@Valid @RequestBody CreateUserRequest request) {
        UserDto createdUser = userService.createUser(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(createdUser);
    }
    
    @PutMapping("/{id}")
    @Operation(summary = "Update user", description = "Update an existing user")
    public ResponseEntity<UserDto> updateUser(@PathVariable UUID id, @Valid @RequestBody UpdateUserRequest request) {
        UserDto updatedUser = userService.updateUser(id, request);
        return ResponseEntity.ok(updatedUser);
    }
    
    @DeleteMapping("/{id}")
    @Operation(summary = "Delete user", description = "Delete a user by ID")
    public ResponseEntity<Void> deleteUser(@PathVariable UUID id) {
        userService.deleteUser(id);
        return ResponseEntity.noContent().build();
    }
    
    @GetMapping("/exists/username/{username}")
    @Operation(summary = "Check if username exists", description = "Check if a username already exists")
    public ResponseEntity<Boolean> checkUsernameExists(@PathVariable String username) {
        boolean exists = userService.checkUsernameExists(username);
        return ResponseEntity.ok(exists);
    }
    
    @GetMapping("/exists/email/{email}")
    @Operation(summary = "Check if email exists", description = "Check if an email already exists")
    public ResponseEntity<Boolean> checkEmailExists(@PathVariable String email) {
        boolean exists = userService.checkEmailExists(email);
        return ResponseEntity.ok(exists);
    }
    
    @GetMapping("/stats/count/role/{role}")
    @Operation(summary = "Get user count by role", description = "Get the count of users with a specific role")
    public ResponseEntity<Long> getUserCountByRole(@PathVariable User.Role role) {
        long count = userService.getUserCountByRole(role);
        return ResponseEntity.ok(count);
    }
    
    @GetMapping("/stats/count/status/{status}")
    @Operation(summary = "Get user count by status", description = "Get the count of users with a specific status")
    public ResponseEntity<Long> getUserCountByStatus(@PathVariable User.UserStatus status) {
        long count = userService.getUserCountByStatus(status);
        return ResponseEntity.ok(count);
    }
    
    @PatchMapping("/{id}/status")
    @Operation(summary = "Update user status", description = "Update the status of a specific user")
    public ResponseEntity<UserDto> updateUserStatus(@PathVariable UUID id, @RequestParam User.UserStatus status) {
        UserDto updatedUser = userService.updateUserStatus(id, status);
        return ResponseEntity.ok(updatedUser);
    }
    
    @PatchMapping("/{id}/role")
    @Operation(summary = "Update user role", description = "Update the role of a specific user")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<UserDto> updateUserRole(@PathVariable UUID id, @RequestParam User.Role role) {
        UserDto updatedUser = userService.updateUserRole(id, role);
        return ResponseEntity.ok(updatedUser);
    }
    
    // Bulk operations
    @PostMapping("/bulk-delete")
    @Operation(summary = "Bulk delete users", description = "Delete multiple users by their IDs")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<Void> bulkDeleteUsers(@RequestBody List<UUID> userIds) {
        try {
            userService.bulkDeleteUsers(userIds);
            return ResponseEntity.noContent().build();
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
    
    @PutMapping("/bulk-update-status")
    @Operation(summary = "Bulk update user status", description = "Update status for multiple users")
    public ResponseEntity<List<UserDto>> bulkUpdateUserStatus(
            @RequestBody List<UUID> userIds,
            @RequestParam User.UserStatus status) {
        try {
            List<UserDto> updatedUsers = userService.bulkUpdateUserStatus(userIds, status);
            return ResponseEntity.ok(updatedUsers);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
    
    @PutMapping("/bulk-update-role")
    @Operation(summary = "Bulk update user role", description = "Update role for multiple users")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<List<UserDto>> bulkUpdateUserRole(
            @RequestBody List<UUID> userIds,
            @RequestParam User.Role role) {
        try {
            List<UserDto> updatedUsers = userService.bulkUpdateUserRole(userIds, role);
            return ResponseEntity.ok(updatedUsers);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
}
