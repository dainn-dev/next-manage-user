package com.vehiclemanagement.analytics;

import com.vehiclemanagement.security.SiteAccess;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/analytics")
@PreAuthorize("hasAnyRole('TENANT_ADMIN','SITE_MANAGER')")
public class AnalyticsController {
    private final AnalyticsReadRepository repository;
    private final SiteAccess siteAccess;
    public AnalyticsController(AnalyticsReadRepository repository, SiteAccess siteAccess) {
        this.repository = repository; this.siteAccess = siteAccess;
    }
    @GetMapping("/summary")
    public AnalyticsSummary summary(@RequestParam UUID siteId,
            @RequestParam(required=false) @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required=false) @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(defaultValue="10") int topLimit) {
        siteAccess.assertSiteAllowed(siteId);
        LocalDate end=to==null?LocalDate.now(ZoneOffset.UTC):to;
        LocalDate start=from==null?end.minusDays(29):from;
        if(start.isAfter(end)||start.isBefore(end.minusDays(365)))
            throw new IllegalArgumentException("Analytics range must be between 1 and 366 days");
        if(topLimit<1||topLimit>100) throw new IllegalArgumentException("topLimit must be between 1 and 100");
        return repository.summary(siteId,start,end,topLimit);
    }
}
