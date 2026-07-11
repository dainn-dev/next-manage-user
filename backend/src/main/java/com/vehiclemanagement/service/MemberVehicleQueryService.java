package com.vehiclemanagement.service;

import com.vehiclemanagement.config.PlatformAdminOperation;
import com.vehiclemanagement.entity.Vehicle;
import com.vehiclemanagement.repository.VehicleRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collection;
import java.util.Collections;
import java.util.List;
import java.util.UUID;

/**
 * Cross-tenant read of a MEMBER's vehicles (ADR-0603 Phase C).
 * Runs on the admin datasource (BYPASSRLS) and filters by affiliation tenants.
 */
@Service
public class MemberVehicleQueryService {

    private final VehicleRepository vehicleRepository;

    public MemberVehicleQueryService(VehicleRepository vehicleRepository) {
        this.vehicleRepository = vehicleRepository;
    }

    @PlatformAdminOperation
    @Transactional(propagation = Propagation.REQUIRES_NEW, readOnly = true)
    public List<Vehicle> findOwnedInTenants(UUID ownerId, Collection<UUID> tenantIds) {
        if (ownerId == null || tenantIds == null || tenantIds.isEmpty()) {
            return Collections.emptyList();
        }
        return vehicleRepository.findByOwnerIdAndTenantIdIn(ownerId, tenantIds);
    }

    @PlatformAdminOperation
    @Transactional(propagation = Propagation.REQUIRES_NEW, readOnly = true)
    public boolean isOwnedInTenants(UUID vehicleId, UUID ownerId, Collection<UUID> tenantIds) {
        if (vehicleId == null || ownerId == null || tenantIds == null || tenantIds.isEmpty()) {
            return false;
        }
        return vehicleRepository.findByIdAndOwnerIdAndTenantIdIn(vehicleId, ownerId, tenantIds).isPresent();
    }
}
