package com.vehiclemanagement.controller;

import com.vehiclemanagement.entity.VehicleLog;
import com.vehiclemanagement.service.VehicleLogExportService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Export endpoints for vehicle entry/exit logs. Guarded to the same roles that
 * may view logs on screen (TENANT_ADMIN), enforced both
 * here via {@code @PreAuthorize} and in SecurityConfig at the URL layer.
 */
@RestController
@RequestMapping("/api/vehicle-logs/export")
@Tag(name = "Vehicle Log Export", description = "Export vehicle entry/exit logs to Excel/CSV")
public class VehicleLogExportController {

    private static final String XLSX_CONTENT_TYPE =
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

    private final VehicleLogExportService exportService;

    @Autowired
    public VehicleLogExportController(VehicleLogExportService exportService) {
        this.exportService = exportService;
    }

    @GetMapping("/excel")
    @Operation(summary = "Export vehicle logs to Excel (.xlsx)",
            description = "Export the full filtered set of vehicle logs as an Excel workbook")
    @PreAuthorize("hasAnyRole('TENANT_ADMIN','SITE_MANAGER')")
    public ResponseEntity<byte[]> exportExcel(
            @Parameter(description = "License plate number") @RequestParam(required = false) String licensePlate,
            @Parameter(description = "Log type (entry/exit)") @RequestParam(required = false) String type,
            @Parameter(description = "Vehicle type (internal/external)") @RequestParam(required = false) String vehicleType,
            @Parameter(description = "Driver name") @RequestParam(required = false) String driverName,
            @Parameter(description = "Start date and time") @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime startDate,
            @Parameter(description = "End date and time") @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime endDate) {

        byte[] data = exportService.exportLogsToExcel(
                licensePlate, parseType(type), parseCategory(vehicleType), driverName, startDate, endDate);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType(XLSX_CONTENT_TYPE));
        headers.setContentDispositionFormData("attachment", "vehicle-logs-" + LocalDate.now() + ".xlsx");
        return new ResponseEntity<>(data, headers, HttpStatus.OK);
    }

    @GetMapping("/csv")
    @Operation(summary = "Export vehicle logs to CSV",
            description = "Export the full filtered set of vehicle logs as a UTF-8 CSV file")
    @PreAuthorize("hasAnyRole('TENANT_ADMIN','SITE_MANAGER')")
    public ResponseEntity<byte[]> exportCsv(
            @Parameter(description = "License plate number") @RequestParam(required = false) String licensePlate,
            @Parameter(description = "Log type (entry/exit)") @RequestParam(required = false) String type,
            @Parameter(description = "Vehicle type (internal/external)") @RequestParam(required = false) String vehicleType,
            @Parameter(description = "Driver name") @RequestParam(required = false) String driverName,
            @Parameter(description = "Start date and time") @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime startDate,
            @Parameter(description = "End date and time") @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime endDate) {

        byte[] data = exportService.exportLogsToCsv(
                licensePlate, parseType(type), parseCategory(vehicleType), driverName, startDate, endDate);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType("text/csv; charset=UTF-8"));
        headers.setContentDispositionFormData("attachment", "vehicle-logs-" + LocalDate.now() + ".csv");
        return new ResponseEntity<>(data, headers, HttpStatus.OK);
    }

    private VehicleLog.LogType parseType(String type) {
        if (type == null || type.trim().isEmpty()) {
            return null;
        }
        try {
            return VehicleLog.LogType.valueOf(type.toLowerCase());
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Invalid log type: " + type + ". Valid values are: entry, exit");
        }
    }

    private VehicleLog.VehicleCategory parseCategory(String vehicleType) {
        if (vehicleType == null || vehicleType.trim().isEmpty()) {
            return null;
        }
        try {
            return VehicleLog.VehicleCategory.valueOf(vehicleType.toLowerCase());
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Invalid vehicle type: " + vehicleType + ". Valid values are: internal, external");
        }
    }
}
