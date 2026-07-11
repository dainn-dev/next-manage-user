package com.vehiclemanagement.service;

import com.vehiclemanagement.config.TenantContext;
import com.vehiclemanagement.dto.TenantVehicleRegisterRequest;
import com.vehiclemanagement.dto.TenantVehicleRegistrationDto;
import com.vehiclemanagement.entity.MemberAffiliation;
import com.vehiclemanagement.entity.TenantVehicleRegistration;
import com.vehiclemanagement.entity.User;
import com.vehiclemanagement.entity.Vehicle;
import com.vehiclemanagement.exception.ResourceNotFoundException;
import com.vehiclemanagement.repository.MemberAffiliationRepository;
import com.vehiclemanagement.repository.TenantVehicleRegistrationRepository;
import com.vehiclemanagement.repository.UserRepository;
import com.vehiclemanagement.repository.VehicleRepository;
import com.vehiclemanagement.security.SiteAccess;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Closed-org “add plate to management” (ADR-0604). Does not delete platform vehicle masters.
 */
@Service
public class TenantVehicleRegistrationService {

    private final TenantVehicleRegistrationRepository registrationRepository;
    private final VehicleRepository vehicleRepository;
    private final UserRepository userRepository;
    private final MemberAffiliationRepository memberAffiliationRepository;
    private final SiteAccess siteAccess;
    private final PlatformVehicleLookup platformVehicleLookup;

    public TenantVehicleRegistrationService(
            TenantVehicleRegistrationRepository registrationRepository,
            VehicleRepository vehicleRepository,
            UserRepository userRepository,
            MemberAffiliationRepository memberAffiliationRepository,
            SiteAccess siteAccess,
            PlatformVehicleLookup platformVehicleLookup) {
        this.registrationRepository = registrationRepository;
        this.vehicleRepository = vehicleRepository;
        this.userRepository = userRepository;
        this.memberAffiliationRepository = memberAffiliationRepository;
        this.siteAccess = siteAccess;
        this.platformVehicleLookup = platformVehicleLookup;
    }

    @Transactional(readOnly = true)
    public List<TenantVehicleRegistrationDto> listForCurrentTenant() {
        UUID tenantId = requireTenant();
        return registrationRepository.findByTenantIdAndStatus(tenantId, TenantVehicleRegistration.Status.ACTIVE)
                .stream()
                .map(reg -> {
                    Vehicle v = vehicleRepository.findById(reg.getId().getVehicleId()).orElse(null);
                    return TenantVehicleRegistrationDto.from(reg, v, true);
                })
                .toList();
    }

    @Transactional
    public TenantVehicleRegistrationDto registerByPlate(TenantVehicleRegisterRequest request) {
        UUID tenantId = requireTenant();
        if (request.getSiteId() != null) {
            siteAccess.assertSiteAllowed(request.getSiteId());
        } else if (siteAccess.isRestricted()) {
            throw new IllegalArgumentException("SITE_MANAGER must supply siteId when registering a plate");
        }

        Optional<PlatformVehicleLookup.PlateHit> existing =
                platformVehicleLookup.findByLicensePlateNormalized(request.getLicensePlate());
        boolean linkedExisting;
        UUID vehicleId;
        UUID ownerIdForAffiliation = request.getOwnerId();

        if (existing.isPresent()) {
            PlatformVehicleLookup.PlateHit hit = existing.get();
            vehicleId = hit.vehicleId();
            linkedExisting = true;
            if (request.getOwnerId() != null && !request.getOwnerId().equals(hit.ownerId())) {
                platformVehicleLookup.assignOwner(vehicleId, request.getOwnerId());
                ownerIdForAffiliation = request.getOwnerId();
            } else {
                ownerIdForAffiliation = hit.ownerId() != null ? hit.ownerId() : request.getOwnerId();
            }
        } else {
            linkedExisting = false;
            Vehicle created = createLocalVehicle(request);
            vehicleId = created.getId();
            ownerIdForAffiliation = created.getOwner() != null ? created.getOwner().getId() : request.getOwnerId();
        }

        TenantVehicleRegistration reg = upsertRegistration(vehicleId, tenantId, request.getSiteId());
        if (ownerIdForAffiliation != null) {
            userRepository.findById(ownerIdForAffiliation).ifPresent(owner -> {
                if (owner.getRole() == User.Role.MEMBER) {
                    ensureAffiliation(owner.getId(), tenantId);
                }
            });
        }

        Vehicle visible = vehicleRepository.findById(vehicleId).orElse(null);
        return TenantVehicleRegistrationDto.from(reg, visible, linkedExisting);
    }

    @Transactional
    public TenantVehicleRegistrationDto revoke(UUID vehicleId) {
        UUID tenantId = requireTenant();
        TenantVehicleRegistration.TenantVehicleRegistrationId pk =
                new TenantVehicleRegistration.TenantVehicleRegistrationId(vehicleId, tenantId);
        TenantVehicleRegistration reg = registrationRepository.findById(pk)
                .orElseThrow(() -> new ResourceNotFoundException("Registration not found"));
        reg.setStatus(TenantVehicleRegistration.Status.REVOKED);
        registrationRepository.save(reg);
        Vehicle v = vehicleRepository.findById(vehicleId).orElse(null);
        return TenantVehicleRegistrationDto.from(reg, v, true);
    }

    @Transactional
    public void ensureRegistrationForVehicle(UUID vehicleId, UUID siteId) {
        UUID tenantId = requireTenant();
        upsertRegistration(vehicleId, tenantId, siteId);
    }

    public boolean isActivelyRegistered(UUID vehicleId, UUID tenantId) {
        if (vehicleId == null || tenantId == null) {
            return false;
        }
        return registrationRepository.existsActive(vehicleId, tenantId);
    }

    private Vehicle createLocalVehicle(TenantVehicleRegisterRequest request) {
        if (request.getVehicleType() == null) {
            throw new IllegalArgumentException("vehicleType is required when the plate is new on the platform");
        }
        User owner = null;
        if (request.getOwnerId() != null) {
            owner = userRepository.findById(request.getOwnerId())
                    .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + request.getOwnerId()));
            if (owner.getRole() != User.Role.MEMBER) {
                throw new IllegalArgumentException("Vehicle owner must be a MEMBER");
            }
        }
        Vehicle vehicle = new Vehicle();
        vehicle.setOwner(owner);
        vehicle.setLicensePlate(request.getLicensePlate().trim());
        vehicle.setVehicleType(request.getVehicleType());
        vehicle.setBrand(request.getBrand());
        vehicle.setModel(request.getModel());
        vehicle.setColor(request.getColor());
        vehicle.setYear(request.getYear());
        vehicle.setRegistrationDate(LocalDate.now());
        vehicle.setStatus(Vehicle.VehicleStatus.approved);
        vehicle.setCurrentSiteId(request.getSiteId());
        return vehicleRepository.saveAndFlush(vehicle);
    }

    private TenantVehicleRegistration upsertRegistration(UUID vehicleId, UUID tenantId, UUID siteId) {
        TenantVehicleRegistration.TenantVehicleRegistrationId pk =
                new TenantVehicleRegistration.TenantVehicleRegistrationId(vehicleId, tenantId);
        Optional<TenantVehicleRegistration> existing = registrationRepository.findById(pk);
        if (existing.isPresent()) {
            TenantVehicleRegistration row = existing.get();
            row.setStatus(TenantVehicleRegistration.Status.ACTIVE);
            if (siteId != null) {
                row.setSiteId(siteId);
            }
            return registrationRepository.save(row);
        }
        TenantVehicleRegistration created = TenantVehicleRegistration.builder()
                .id(pk)
                .siteId(siteId)
                .status(TenantVehicleRegistration.Status.ACTIVE)
                .build();
        return registrationRepository.save(created);
    }

    private void ensureAffiliation(UUID userId, UUID tenantId) {
        MemberAffiliation.MemberAffiliationId pk =
                new MemberAffiliation.MemberAffiliationId(userId, tenantId);
        Optional<MemberAffiliation> existing = memberAffiliationRepository.findById(pk);
        if (existing.isPresent()) {
            MemberAffiliation row = existing.get();
            if (row.getStatus() != MemberAffiliation.Status.ACTIVE) {
                row.setStatus(MemberAffiliation.Status.ACTIVE);
                memberAffiliationRepository.save(row);
            }
            return;
        }
        memberAffiliationRepository.save(MemberAffiliation.builder()
                .userId(userId)
                .tenantId(tenantId)
                .status(MemberAffiliation.Status.ACTIVE)
                .build());
    }

    private static UUID requireTenant() {
        UUID tenantId = TenantContext.getTenantId();
        if (tenantId == null) {
            throw new IllegalStateException("Tenant context required");
        }
        return tenantId;
    }
}
