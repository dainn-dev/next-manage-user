package com.vehiclemanagement.platform;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/platform")
@Tag(name = "Platform Console", description = "PLATFORM_ADMIN SaaS operator APIs")
@PreAuthorize("hasRole('PLATFORM_ADMIN')")
public class PlatformConsoleController {

    private final PlatformOverviewService overviewService;
    private final PlatformBillingService billingService;
    private final PlatformAdminUserService adminUserService;
    private final PlatformAuditService auditService;

    public PlatformConsoleController(
            PlatformOverviewService overviewService,
            PlatformBillingService billingService,
            PlatformAdminUserService adminUserService,
            PlatformAuditService auditService) {
        this.overviewService = overviewService;
        this.billingService = billingService;
        this.adminUserService = adminUserService;
        this.auditService = auditService;
    }

    @GetMapping("/overview")
    @Operation(summary = "Platform overview metrics")
    public PlatformOverviewService.PlatformOverviewResponse overview() {
        return overviewService.overview();
    }

    @GetMapping("/billing/subscriptions")
    @Operation(summary = "List tenant subscriptions across the platform")
    public PlatformBillingService.PlatformSubscriptionPageResponse listSubscriptions(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String searchTerm) {
        return billingService.listSubscriptions(page, size, status, searchTerm);
    }

    @GetMapping("/billing/summary")
    @Operation(summary = "Subscription status counts")
    public PlatformBillingService.PlatformBillingSummaryResponse billingSummary() {
        return billingService.summary();
    }

    @GetMapping("/admins")
    @Operation(summary = "List platform admins")
    public List<PlatformAdminUserService.PlatformAdminDto> listAdmins() {
        return adminUserService.list();
    }

    @PostMapping("/admins")
    @Operation(summary = "Create a platform admin")
    public ResponseEntity<PlatformAdminUserService.PlatformAdminDto> createAdmin(
            @Valid @RequestBody PlatformAdminUserService.CreatePlatformAdminRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(adminUserService.create(request));
    }

    @PatchMapping("/admins/{id}")
    @Operation(summary = "Update a platform admin")
    public PlatformAdminUserService.PlatformAdminDto updateAdmin(
            @PathVariable UUID id,
            @Valid @RequestBody PlatformAdminUserService.UpdatePlatformAdminRequest request) {
        return adminUserService.update(id, request);
    }

    @GetMapping("/audit")
    @Operation(summary = "List platform audit log entries")
    public PlatformAuditService.PlatformAuditPageResponse listAudit(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String action,
            @RequestParam(required = false) String resourceType) {
        return auditService.list(page, size, action, resourceType);
    }
}
