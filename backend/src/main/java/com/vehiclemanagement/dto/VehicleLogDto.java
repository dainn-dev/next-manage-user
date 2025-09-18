package com.vehiclemanagement.dto;

import com.vehiclemanagement.entity.VehicleLog;
import lombok.Data;
import lombok.Builder;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class VehicleLogDto {
    
    private UUID id;
    private String licensePlateNumber;
    private UUID vehicleId;
    private UUID employeeId;
    private String employeeName;
    private String employeeAvatar;
    private LocalDateTime entryExitTime;
    private VehicleLog.LogType type;
    private VehicleLog.VehicleCategory vehicleType;
    private String driverName;
    private String purpose;
    private String gateLocation;
    private UUID securityGuardId;
    private String securityGuardName;
    private String notes;
    private String imagePath;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    
    // Additional fields for display
    private String vehicleBrand;
    private String vehicleModel;
    private String vehicleColor;
}
