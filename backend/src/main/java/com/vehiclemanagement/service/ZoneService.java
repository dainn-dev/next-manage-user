package com.vehiclemanagement.service;

import com.vehiclemanagement.dto.ZoneDto;
import com.vehiclemanagement.entity.Zone;
import com.vehiclemanagement.exception.ConflictException;
import com.vehiclemanagement.exception.ResourceNotFoundException;
import com.vehiclemanagement.repository.SiteRepository;
import com.vehiclemanagement.repository.ZoneRepository;
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

    @Transactional(readOnly = true)
    public List<ZoneDto> list(UUID siteId) {
        List<Zone> zones = siteId != null
                ? zoneRepository.findBySiteId(siteId)
                : zoneRepository.findAll();
        return zones.stream().map(ZoneDto::new).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public ZoneDto get(UUID id) {
        return new ZoneDto(findOrThrow(id));
    }

    public ZoneDto create(ZoneDto request) {
        requireSite(request.getSiteId());
        if (zoneRepository.existsBySiteIdAndName(request.getSiteId(), request.getName())) {
            throw new ConflictException("Zone with name '" + request.getName()
                    + "' already exists in this site");
        }
        Zone zone = Zone.builder()
                .siteId(request.getSiteId())
                .name(request.getName())
                .build();
        return new ZoneDto(zoneRepository.save(zone));
    }

    public ZoneDto update(UUID id, ZoneDto request) {
        Zone zone = findOrThrow(id);
        // The owning site is immutable; only the name can change.
        if (request.getName() != null && !request.getName().isBlank()
                && !zone.getName().equals(request.getName())) {
            if (zoneRepository.existsBySiteIdAndNameAndIdNot(zone.getSiteId(), request.getName(), id)) {
                throw new ConflictException("Zone with name '" + request.getName()
                        + "' already exists in this site");
            }
            zone.setName(request.getName());
        }
        return new ZoneDto(zoneRepository.save(zone));
    }

    public void delete(UUID id) {
        zoneRepository.delete(findOrThrow(id));
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
    }
}
