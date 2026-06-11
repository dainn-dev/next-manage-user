package com.vehiclemanagement.dto;

import com.vehiclemanagement.entity.VehicleAccessRequest;
import com.vehiclemanagement.entity.VehicleAccessRequest.AccessRequestStatus;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class VehicleAccessRequestDto {

    private UUID id;

    @NotNull(message = "Vehicle ID is required")
    private UUID vehicleId;

    private String vehicleLicensePlate;

    private UUID requesterId;
    private String requesterName;

    private UUID approverId;
    private String approverName;

    private AccessRequestStatus status;

    @NotBlank(message = "Request reason is required")
    private String requestReason;

    private String rejectionReason;

    private LocalDate validFrom;
    private LocalDate validTo;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public VehicleAccessRequestDto(VehicleAccessRequest req) {
        this.id = req.getId();
        if (req.getVehicle() != null) {
            this.vehicleId = req.getVehicle().getId();
            this.vehicleLicensePlate = req.getVehicle().getLicensePlate();
        }
        if (req.getRequester() != null) {
            this.requesterId = req.getRequester().getId();
            this.requesterName = req.getRequester().getFullName();
        }
        if (req.getApprover() != null) {
            this.approverId = req.getApprover().getId();
            this.approverName = req.getApprover().getFullName();
        }
        this.status = req.getStatus();
        this.requestReason = req.getRequestReason();
        this.rejectionReason = req.getRejectionReason();
        this.validFrom = req.getValidFrom();
        this.validTo = req.getValidTo();
        this.createdAt = req.getCreatedAt();
        this.updatedAt = req.getUpdatedAt();
    }
}
