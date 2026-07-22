package com.vehiclemanagement.repository;

import com.vehiclemanagement.entity.ParkingFloor;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface ParkingFloorRepository extends JpaRepository<ParkingFloor, UUID> {
    List<ParkingFloor> findBySiteIdOrderBySortOrderAscLevelNumberAscNameAsc(UUID siteId);
    boolean existsBySiteIdAndName(UUID siteId, String name);
    boolean existsBySiteIdAndNameAndIdNot(UUID siteId, String name, UUID id);
    boolean existsBySiteIdAndLevelNumber(UUID siteId, Integer levelNumber);
    boolean existsBySiteIdAndLevelNumberAndIdNot(UUID siteId, Integer levelNumber, UUID id);
}
