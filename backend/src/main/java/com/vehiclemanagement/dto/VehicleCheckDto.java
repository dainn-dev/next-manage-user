package com.vehiclemanagement.dto;

import com.vehiclemanagement.entity.VehicleLog;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class VehicleCheckDto {
    
    @NotBlank(message = "License plate number is required")
    private String licensePlateNumber;
    
    @NotNull(message = "Type is required")
    private VehicleLog.LogType type;
    
    private String driverName;
    private String purpose;
    private String gateLocation;
    private String notes;
}
