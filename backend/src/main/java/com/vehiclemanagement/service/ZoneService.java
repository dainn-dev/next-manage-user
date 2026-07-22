package com.vehiclemanagement.service;

import com.vehiclemanagement.dto.ZoneDto;
import com.vehiclemanagement.entity.Zone;
import com.vehiclemanagement.exception.ConflictException;
import com.vehiclemanagement.exception.ResourceNotFoundException;
import com.vehiclemanagement.repository.SiteRepository;
import com.vehiclemanagement.repository.ParkingFloorRepository;
import com.vehiclemanagement.repository.ZoneRepository;
import com.vehiclemanagement.security.SiteAccess;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Tenant-scoped Zone CRUD. Zones belong to a {@link com.vehiclemanagement.entity.Site};
 * both are confined to the current tenant by RLS. Zone names are unique within a site.
 */
@Service
@Transactional
public class ZoneService {

    @Autowired
    private ZoneRepository zoneRepository;

    @Autowired
    private SiteRepository siteRepository;

    @Autowired
    private ParkingFloorRepository floorRepository;

    @Autowired
    private SiteAccess siteAccess;

    @Transactional(readOnly = true)
    public List<ZoneDto> list(UUID siteId) {
        if (siteId != null) {
            siteAccess.assertSiteAllowed(siteId);
        }
        List<Zone> zones = siteId != null
                ? zoneRepository.findBySiteId(siteId)
                : zoneRepository.findAll();
        if (siteId == null && siteAccess.isRestricted()) {
            List<UUID> allowed = siteAccess.allowedSiteIds();
            zones = zones.stream()
                    .filter(z -> allowed.contains(z.getSiteId()))
                    .collect(Collectors.toList());
        }
        return zones.stream().map(ZoneDto::new).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public ZoneDto get(UUID id) {
        Zone zone = findOrThrow(id);
        siteAccess.assertSiteAllowed(zone.getSiteId());
        return new ZoneDto(zone);
    }

    public ZoneDto create(ZoneDto request) {
        requireSite(request.getSiteId());
        if (zoneRepository.existsBySiteIdAndName(request.getSiteId(), request.getName())) {
            throw new ConflictException("Zone with name '" + request.getName()
                    + "' already exists in this site");
        }
        Zone zone = Zone.builder()
                .siteId(request.getSiteId())
                .floorId(validatedFloorId(request.getSiteId(), request.getFloorId()))
                .name(request.getName())
                .build();
        return new ZoneDto(zoneRepository.save(zone));
    }

    public ZoneDto update(UUID id, ZoneDto request) {
        Zone zone = findOrThrow(id);
        siteAccess.assertSiteAllowed(zone.getSiteId());
        // The owning site is immutable; only the name can change.
        if (request.getName() != null && !request.getName().isBlank()
                && !zone.getName().equals(request.getName())) {
            if (zoneRepository.existsBySiteIdAndNameAndIdNot(zone.getSiteId(), request.getName(), id)) {
                throw new ConflictException("Zone with name '" + request.getName()
                        + "' already exists in this site");
            }
            zone.setName(request.getName());
        }
        if (request.getFloorId() != null) {
            zone.setFloorId(validatedFloorId(zone.getSiteId(), request.getFloorId()));
        }
        return new ZoneDto(zoneRepository.save(zone));
    }

    public void delete(UUID id) {
        Zone zone = findOrThrow(id);
        siteAccess.assertSiteAllowed(zone.getSiteId());
        zoneRepository.delete(zone);
    }

    private Zone findOrThrow(UUID id) {
        return zoneRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Zone not found with id: " + id));
    }

    private void requireSite(UUID siteId) {
        // RLS confines this lookup to the current tenant, so a site owned by another
        // tenant reads as absent — a zone can never attach to a cross-tenant site.
        if (!siteRepository.existsById(siteId)) {
            throw new ResourceNotFoundException("Site not found with id: " + siteId);
        }
        siteAccess.assertSiteAllowed(siteId);
    }

    private UUID validatedFloorId(UUID siteId, UUID floorId) {
        if (floorId == null) return null;
        return floorRepository.findById(floorId)
                .filter(floor -> floor.getSiteId().equals(siteId))
                .map(floor -> floor.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Parking floor not found in this site: " + floorId));
    }
}
