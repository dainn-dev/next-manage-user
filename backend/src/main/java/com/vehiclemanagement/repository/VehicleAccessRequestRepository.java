package com.vehiclemanagement.repository;

import com.vehiclemanagement.entity.VehicleAccessRequest;
import com.vehiclemanagement.entity.VehicleAccessRequest.AccessRequestStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface VehicleAccessRequestRepository extends JpaRepository<VehicleAccessRequest, UUID> {

    List<VehicleAccessRequest> findByStatus(AccessRequestStatus status);

    List<VehicleAccessRequest> findByRequesterId(UUID requesterId);

    List<VehicleAccessRequest> findByVehicleId(UUID vehicleId);
}
