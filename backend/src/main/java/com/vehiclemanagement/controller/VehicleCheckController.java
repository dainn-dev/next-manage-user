package com.vehiclemanagement.controller;

import com.vehiclemanagement.dto.VehicleCheckDto;
import com.vehiclemanagement.entity.VehicleLog;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;

@RestController
@RequestMapping("/api/vehicle-check")
@Tag(name = "Vehicle Check", description = "APIs for vehicle check-in/check-out with WebSocket notifications")
public class VehicleCheckController {

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    @PostMapping
    @Operation(summary = "Check vehicle", description = "Process vehicle check-in/check-out and send WebSocket notification")
    public ResponseEntity<Object> checkVehicle(@RequestBody VehicleCheckDto vehicleCheckDto) {
        try {
            // Create WebSocket message
            Object message = new Object() {
                public final String licensePlateNumber = vehicleCheckDto.getLicensePlateNumber();
                public final String type = vehicleCheckDto.getType().name();
                public final String timestamp = LocalDateTime.now().toString();
                public final String message = "Vehicle check: " + vehicleCheckDto.getLicensePlateNumber() + " - " + vehicleCheckDto.getType();
            };

            // Send WebSocket message to all subscribers
            messagingTemplate.convertAndSend("/topic/vehicle-check", message);

            // Return success response
            return ResponseEntity.ok(new Object() {
                public final String status = "success";
                public final String message = "Vehicle check processed and notification sent";
                public final String licensePlateNumber = vehicleCheckDto.getLicensePlateNumber();
                public final String type = vehicleCheckDto.getType().name();
                public final String timestamp = LocalDateTime.now().toString();
            });

        } catch (Exception e) {
            return ResponseEntity.badRequest().body(new Object() {
                public final String status = "error";
                public final String message = "Failed to process vehicle check: " + e.getMessage();
            });
        }
    }

    @GetMapping("/test")
    @Operation(summary = "Test vehicle check", description = "Test endpoint to trigger vehicle check WebSocket notification")
    public ResponseEntity<Object> testVehicleCheck(
            @Parameter(description = "License plate number") @RequestParam String licensePlateNumber,
            @Parameter(description = "Check type (ENTRY/EXIT)") @RequestParam VehicleLog.LogType type) {
        
        VehicleCheckDto testDto = new VehicleCheckDto();
        testDto.setLicensePlateNumber(licensePlateNumber);
        testDto.setType(type);
        
        return checkVehicle(testDto);
    }
}
