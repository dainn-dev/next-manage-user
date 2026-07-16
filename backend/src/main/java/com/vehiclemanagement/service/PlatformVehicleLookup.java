package com.vehiclemanagement.service;

import com.vehiclemanagement.config.PlatformAdminOperation;
import com.vehiclemanagement.entity.User;
import com.vehiclemanagement.entity.Vehicle;
import com.vehiclemanagement.exception.ResourceNotFoundException;
import com.vehiclemanagement.repository.UserRepository;
import com.vehiclemanagement.repository.VehicleRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;
import java.util.UUID;

/**
 * Cross-tenant vehicle plate lookup (ADR-0604 register-by-plate).
 */
@Service
public class PlatformVehicleLookup {

    public record PlateHit(UUID vehicleId, UUID ownerId, String licensePlate) {
    }

    private final VehicleRepository vehicleRepository;
    private final UserRepository userRepository;

    public PlatformVehicleLookup(VehicleRepository vehicleRepository, UserRepository userRepository) {
        this.vehicleRepository = vehicleRepository;
        this.userRepository = userRepository;
    }

    @PlatformAdminOperation
    @Transactional(propagation = Propagation.REQUIRES_NEW, readOnly = true)
    public Optional<PlateHit> findByLicensePlateNormalized(String licensePlate) {
        return vehicleRepository.findByLicensePlateNormalized(licensePlate).map(v -> {
            UUID ownerId = v.getOwner() != null ? v.getOwner().getId() : null;
            return new PlateHit(v.getId(), ownerId, v.getLicensePlate());
        });
    }

    @PlatformAdminOperation
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void assignOwner(UUID vehicleId, UUID ownerId) {
        Vehicle vehicle = vehicleRepository.findById(vehicleId)
                .orElseThrow(() -> new ResourceNotFoundException("Vehicle not found"));
        User owner = userRepository.findById(ownerId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        if (owner.getRole() != User.Role.MEMBER) {
            throw new IllegalArgumentException("Vehicle owner must be a MEMBER");
        }
        vehicle.setOwner(owner);
        vehicleRepository.save(vehicle);
    }
}
