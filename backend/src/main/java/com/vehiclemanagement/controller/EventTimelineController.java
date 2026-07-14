package com.vehiclemanagement.controller;

import com.vehiclemanagement.dto.EventTimelinePageDto;
import com.vehiclemanagement.repository.EventTimelineReadRepository;
import com.vehiclemanagement.security.SiteAccess;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/sites/{siteId}/events")
public class EventTimelineController {
    private final EventTimelineReadRepository repository;
    private final SiteAccess siteAccess;

    public EventTimelineController(EventTimelineReadRepository repository, SiteAccess siteAccess) {
        this.repository = repository;
        this.siteAccess = siteAccess;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('TENANT_ADMIN','SITE_MANAGER','SECURITY_GUARD')")
    public ResponseEntity<EventTimelinePageDto> list(
            @PathVariable UUID siteId,
            @RequestParam(required = false) UUID zoneId,
            @RequestParam(required = false) String type,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        siteAccess.assertSiteAllowed(siteId);
        if (page < 0 || size < 1 || size > 100) {
            throw new IllegalArgumentException("page must be >= 0 and size must be between 1 and 100");
        }
        return ResponseEntity.ok(repository.find(siteId, zoneId, type, page, size));
    }
}
