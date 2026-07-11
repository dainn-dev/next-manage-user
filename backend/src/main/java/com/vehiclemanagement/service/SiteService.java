package com.vehiclemanagement.service;

import com.vehiclemanagement.billing.EntitlementGuard;
import com.vehiclemanagement.dto.SiteDto;
import com.vehiclemanagement.entity.Site;
import com.vehiclemanagement.exception.ConflictException;
import com.vehiclemanagement.exception.ResourceNotFoundException;
import com.vehiclemanagement.repository.SiteRepository;
import com.vehiclemanagement.security.SiteAccess;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Tenant-scoped Site CRUD. Every query runs under the current transaction's tenant
 * (RLS), so no explicit tenant_id filter is needed — cross-tenant rows are simply
 * invisible. Site names are unique within a tenant.
 */
@Service
@Transactional
public class SiteService {

    @Autowired
    private SiteRepository siteRepository;

    @Autowired
    private EntitlementGuard entitlementGuard;

    @Autowired
    private SiteAccess siteAccess;

    @Transactional(readOnly = true)
    public List<SiteDto> list() {
        List<Site> sites = siteRepository.findAll(Sort.by(Sort.Direction.ASC, "name"));
        if (siteAccess.isRestricted()) {
            List<UUID> allowed = siteAccess.allowedSiteIds();
            sites = sites.stream().filter(s -> allowed.contains(s.getId())).collect(Collectors.toList());
        }
        return sites.stream().map(SiteDto::new).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public SiteDto get(UUID id) {
        siteAccess.assertSiteAllowed(id);
        return new SiteDto(findOrThrow(id));
    }

    public SiteDto create(SiteDto request) {
        if (siteRepository.existsByName(request.getName())) {
            throw new ConflictException("Site with name '" + request.getName() + "' already exists");
        }
        entitlementGuard.assertSiteCreationAllowed();
        Site site = Site.builder()
                .name(request.getName())
                .location(request.getLocation())
                .build();
        return new SiteDto(siteRepository.save(site));
    }

    public SiteDto update(UUID id, SiteDto request) {
        Site site = findOrThrow(id);
        if (request.getName() != null && !request.getName().isBlank()
                && !site.getName().equals(request.getName())
                && siteRepository.existsByNameAndIdNot(request.getName(), id)) {
            throw new ConflictException("Site with name '" + request.getName() + "' already exists");
        }
        if (request.getName() != null && !request.getName().isBlank()) {
            site.setName(request.getName());
        }
        if (request.getLocation() != null) {
            site.setLocation(request.getLocation());
        }
        return new SiteDto(siteRepository.save(site));
    }

    public void delete(UUID id) {
        Site site = findOrThrow(id);
        siteRepository.delete(site);
    }

    private Site findOrThrow(UUID id) {
        return siteRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Site not found with id: " + id));
    }
}
