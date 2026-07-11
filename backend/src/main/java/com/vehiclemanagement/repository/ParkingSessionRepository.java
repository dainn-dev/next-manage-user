package com.vehiclemanagement.repository;

import com.vehiclemanagement.entity.ParkingSession;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ParkingSessionRepository extends JpaRepository<ParkingSession, UUID> {
    Optional<ParkingSession> findByIdAndStatus(UUID id, ParkingSession.Status status);

    List<ParkingSession> findByClaimedByUserIdAndStatus(UUID userId, ParkingSession.Status status);

    Optional<ParkingSession> findFirstByLicensePlateAndSiteIdAndStatusOrderByStartedAtDesc(
            String licensePlate, UUID siteId, ParkingSession.Status status);
}
