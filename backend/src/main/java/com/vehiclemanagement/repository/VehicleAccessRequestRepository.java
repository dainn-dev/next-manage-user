package com.vehiclemanagement.repository;

import com.vehiclemanagement.entity.VehicleAccessRequest;
import com.vehiclemanagement.entity.VehicleAccessRequest.AccessRequestStatus;
import com.vehiclemanagement.entity.VehicleAccessRequest.RequestSource;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Repository
public interface VehicleAccessRequestRepository extends JpaRepository<VehicleAccessRequest, UUID> {

    List<VehicleAccessRequest> findByStatus(AccessRequestStatus status);

    List<VehicleAccessRequest> findByRequesterId(UUID requesterId);

    List<VehicleAccessRequest> findByVehicleId(UUID vehicleId);

    /**
     * Backs the short-window duplicate check for gate-originated detections
     * (Phase 4.4): candidates are further filtered by gate and normalized plate in
     * the service. Returning the small recent-and-pending set keeps the query free
     * of null-gate JPQL comparisons.
     */
    List<VehicleAccessRequest> findByStatusAndSourceAndCreatedAtAfter(
            AccessRequestStatus status, RequestSource source, LocalDateTime cutoff);
}
