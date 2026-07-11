package com.vehiclemanagement.platform;

import com.vehiclemanagement.config.PlatformAdminOperation;
import com.vehiclemanagement.dto.TenantStatisticsResponse;
import com.vehiclemanagement.service.TenantAdminService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class PlatformOverviewService {

    private final TenantAdminService tenantAdminService;
    private final PlatformBillingService billingService;
    private final PlatformAdminUserService adminUserService;
    private final PlatformAuditService auditService;

    public PlatformOverviewService(
            TenantAdminService tenantAdminService,
            PlatformBillingService billingService,
            PlatformAdminUserService adminUserService,
            PlatformAuditService auditService) {
        this.tenantAdminService = tenantAdminService;
        this.billingService = billingService;
        this.adminUserService = adminUserService;
        this.auditService = auditService;
    }

    @PlatformAdminOperation
    @Transactional(readOnly = true)
    public PlatformOverviewResponse overview() {
        TenantStatisticsResponse tenants = tenantAdminService.summary();
        PlatformBillingService.PlatformBillingSummaryResponse billing = billingService.summary();
        long platformAdminCount = adminUserService.count();
        List<PlatformAuditService.PlatformAuditEntryDto> recentAudit = auditService.recent(8);
        return new PlatformOverviewResponse(tenants, billing, platformAdminCount, recentAudit);
    }

    public record PlatformOverviewResponse(
            TenantStatisticsResponse tenants,
            PlatformBillingService.PlatformBillingSummaryResponse billing,
            long platformAdminCount,
            List<PlatformAuditService.PlatformAuditEntryDto> recentAudit) {
    }
}
