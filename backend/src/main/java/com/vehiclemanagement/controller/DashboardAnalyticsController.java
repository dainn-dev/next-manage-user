package com.vehiclemanagement.controller;

import com.vehiclemanagement.dto.AverageDwellDto;
import com.vehiclemanagement.repository.AverageDwellReadRepository;
import com.vehiclemanagement.security.SiteAccess;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;

@RestController
@RequestMapping("/api/sites/{siteId}/analytics")
public class DashboardAnalyticsController {
    private final AverageDwellReadRepository repository;
    private final SiteAccess siteAccess;

    public DashboardAnalyticsController(AverageDwellReadRepository repository, SiteAccess siteAccess) {
        this.repository = repository;
        this.siteAccess = siteAccess;
    }

    @GetMapping("/average-dwell")
    @PreAuthorize("hasAnyRole('TENANT_ADMIN','SITE_MANAGER','SECURITY_GUARD')")
    public ResponseEntity<AverageDwellDto> averageDwell(
            @PathVariable UUID siteId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime to) {
        siteAccess.assertSiteAllowed(siteId);
        OffsetDateTime effectiveTo = to == null ? OffsetDateTime.now(ZoneOffset.UTC) : to;
        OffsetDateTime effectiveFrom = from == null ? effectiveTo.minusDays(7) : from;
        Duration range = Duration.between(effectiveFrom, effectiveTo);
        if (range.isNegative() || range.isZero() || range.compareTo(Duration.ofDays(90)) > 0) {
            throw new IllegalArgumentException("Average dwell range must be between 1 second and 90 days");
        }
        return ResponseEntity.ok(repository.calculate(siteId, effectiveFrom, effectiveTo));
    }
}
