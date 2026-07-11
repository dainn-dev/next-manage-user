package com.vehiclemanagement.controller;

import com.vehiclemanagement.dto.UserDto;
import com.vehiclemanagement.service.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/vehicle-owners")
@Tag(name = "Vehicle Owners", description = "Selectable vehicle owners")
public class VehicleOwnerController {

    private final UserService userService;

    public VehicleOwnerController(UserService userService) {
        this.userService = userService;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('TENANT_ADMIN','SITE_MANAGER')")
    @Operation(summary = "List selectable vehicle owners")
    public ResponseEntity<List<UserDto>> getSelectableOwners() {
        return ResponseEntity.ok(userService.getAllUsersList());
    }
}
