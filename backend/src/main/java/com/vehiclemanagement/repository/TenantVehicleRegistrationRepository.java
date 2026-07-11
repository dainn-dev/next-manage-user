package com.vehiclemanagement.repository;

import com.vehiclemanagement.entity.TenantVehicleRegistration;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface TenantVehicleRegistrationRepository
        extends JpaRepository<TenantVehicleRegistration, TenantVehicleRegistration.TenantVehicleRegistrationId> {

    List<TenantVehicleRegistration> findByTenantIdAndStatus(
            UUID tenantId, TenantVehicleRegistration.Status status);

    Optional<TenantVehicleRegistration> findByIdVehicleIdAndIdTenantId(UUID vehicleId, UUID tenantId);

    boolean existsByIdVehicleIdAndIdTenantIdAndStatus(
            UUID vehicleId, UUID tenantId, TenantVehicleRegistration.Status status);

    default boolean existsActive(UUID vehicleId, UUID tenantId) {
        return existsByIdVehicleIdAndIdTenantIdAndStatus(
                vehicleId, tenantId, TenantVehicleRegistration.Status.ACTIVE);
    }

    List<TenantVehicleRegistration> findByIdVehicleIdAndStatus(
            UUID vehicleId, TenantVehicleRegistration.Status status);
}
