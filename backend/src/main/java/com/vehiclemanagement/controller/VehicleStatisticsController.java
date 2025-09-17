package com.vehiclemanagement.controller;

import com.vehiclemanagement.dto.VehicleStatisticsDto;
import com.vehiclemanagement.service.VehicleService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/vehicles/statistics")
@Tag(name = "Vehicle Statistics", description = "APIs for vehicle statistics")
public class VehicleStatisticsController {
    
    @Autowired
    private VehicleService vehicleService;
    
    @GetMapping("/overview")
    @Operation(summary = "Get comprehensive vehicle statistics", description = "Get comprehensive statistics including vehicle counts, entry/exit requests, and time-based analytics")
    public ResponseEntity<VehicleStatisticsDto> getVehicleStatistics() {
        VehicleStatisticsDto statistics = vehicleService.getVehicleStatistics();
        return ResponseEntity.ok(statistics);
    }
}
