package com.vehiclemanagement.controller;

import com.vehiclemanagement.dto.EventTimelinePageDto;
import com.vehiclemanagement.service.EventTimelineQueryService;
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
    private final EventTimelineQueryService service;

    public EventTimelineController(EventTimelineQueryService service) {
        this.service = service;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('TENANT_ADMIN','SITE_MANAGER','SECURITY_GUARD')")
    public ResponseEntity<EventTimelinePageDto> list(
            @PathVariable UUID siteId,
            @RequestParam(required = false) UUID zoneId,
            @RequestParam(required = false) String type,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        return ResponseEntity.ok(service.find(siteId, zoneId, type, page, size));
    }
}
