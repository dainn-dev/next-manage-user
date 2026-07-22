package com.vehiclemanagement.service;

import com.vehiclemanagement.dto.ParkingFloorDto;
import com.vehiclemanagement.entity.ParkingFloor;
import com.vehiclemanagement.exception.ConflictException;
import com.vehiclemanagement.exception.ResourceNotFoundException;
import com.vehiclemanagement.repository.ParkingFloorRepository;
import com.vehiclemanagement.repository.SiteRepository;
import com.vehiclemanagement.repository.ZoneRepository;
import com.vehiclemanagement.security.SiteAccess;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@Transactional
public class ParkingFloorService {
    private final ParkingFloorRepository floorRepository;
    private final SiteRepository siteRepository;
    private final ZoneRepository zoneRepository;
    private final SiteAccess siteAccess;

    public ParkingFloorService(ParkingFloorRepository floorRepository,
                               SiteRepository siteRepository,
                               ZoneRepository zoneRepository,
                               SiteAccess siteAccess) {
        this.floorRepository = floorRepository;
        this.siteRepository = siteRepository;
        this.zoneRepository = zoneRepository;
        this.siteAccess = siteAccess;
    }

    @Transactional(readOnly = true)
    public List<ParkingFloorDto> list(UUID siteId) {
        requireSite(siteId);
        return floorRepository.findBySiteIdOrderBySortOrderAscLevelNumberAscNameAsc(siteId)
                .stream().map(ParkingFloorDto::new).toList();
    }

    @Transactional(readOnly = true)
    public ParkingFloorDto get(UUID id) {
        ParkingFloor floor = findOrThrow(id);
        siteAccess.assertSiteAllowed(floor.getSiteId());
        return new ParkingFloorDto(floor);
    }

    public ParkingFloorDto create(ParkingFloorDto request) {
        requireSite(request.getSiteId());
        ensureUnique(request.getSiteId(), request.getName(), request.getLevelNumber(), null);
        ParkingFloor floor = ParkingFloor.builder()
                .siteId(request.getSiteId())
                .name(request.getName().trim())
                .levelNumber(request.getLevelNumber())
                .sortOrder(request.getSortOrder() == null ? request.getLevelNumber() : request.getSortOrder())
                .backgroundImageUrl(request.getBackgroundImageUrl())
                .build();
        return new ParkingFloorDto(floorRepository.save(floor));
    }

    public ParkingFloorDto update(UUID id, ParkingFloorDto request) {
        ParkingFloor floor = findOrThrow(id);
        siteAccess.assertSiteAllowed(floor.getSiteId());
        String name = request.getName() == null || request.getName().isBlank() ? floor.getName() : request.getName().trim();
        Integer level = request.getLevelNumber() == null ? floor.getLevelNumber() : request.getLevelNumber();
        ensureUnique(floor.getSiteId(), name, level, id);
        floor.setName(name);
        floor.setLevelNumber(level);
        if (request.getSortOrder() != null) floor.setSortOrder(request.getSortOrder());
        if (request.getBackgroundImageUrl() != null) floor.setBackgroundImageUrl(request.getBackgroundImageUrl());
        return new ParkingFloorDto(floorRepository.save(floor));
    }

    public void delete(UUID id) {
        ParkingFloor floor = findOrThrow(id);
        siteAccess.assertSiteAllowed(floor.getSiteId());
        if (zoneRepository.existsByFloorId(id)) {
            throw new ConflictException("Cannot delete a floor that still contains zones");
        }
        floorRepository.delete(floor);
    }

    private void ensureUnique(UUID siteId, String name, Integer level, UUID excludingId) {
        boolean duplicateName = excludingId == null
                ? floorRepository.existsBySiteIdAndName(siteId, name)
                : floorRepository.existsBySiteIdAndNameAndIdNot(siteId, name, excludingId);
        if (duplicateName) throw new ConflictException("Floor name already exists in this site");
        boolean duplicateLevel = excludingId == null
                ? floorRepository.existsBySiteIdAndLevelNumber(siteId, level)
                : floorRepository.existsBySiteIdAndLevelNumberAndIdNot(siteId, level, excludingId);
        if (duplicateLevel) throw new ConflictException("Floor level already exists in this site");
    }

    private ParkingFloor findOrThrow(UUID id) {
        return floorRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Parking floor not found with id: " + id));
    }

    private void requireSite(UUID siteId) {
        if (!siteRepository.existsById(siteId)) {
            throw new ResourceNotFoundException("Site not found with id: " + siteId);
        }
        siteAccess.assertSiteAllowed(siteId);
    }
}
