package com.vehiclemanagement.dto;

import com.vehiclemanagement.entity.ParkingFloor;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ParkingFloorDto {
    private UUID id;

    @NotNull(message = "siteId is required")
    private UUID siteId;

    @NotBlank(message = "Floor name is required")
    private String name;

    @NotNull(message = "levelNumber is required")
    private Integer levelNumber;

    private Integer sortOrder;
    private String backgroundImageUrl;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public ParkingFloorDto(ParkingFloor floor) {
        this.id = floor.getId();
        this.siteId = floor.getSiteId();
        this.name = floor.getName();
        this.levelNumber = floor.getLevelNumber();
        this.sortOrder = floor.getSortOrder();
        this.backgroundImageUrl = floor.getBackgroundImageUrl();
        this.createdAt = floor.getCreatedAt();
        this.updatedAt = floor.getUpdatedAt();
    }
}
