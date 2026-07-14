package com.vehiclemanagement.billing;

import com.vehiclemanagement.config.TenantContext;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.lang.NonNull;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.UUID;

/** Rejects tenant API access after billing dunning has suspended the tenant. */
public class TenantBillingAccessFilter extends OncePerRequestFilter {
    private final TenantAccessStatusResolver resolver;

    public TenantBillingAccessFilter(TenantAccessStatusResolver resolver) {
        this.resolver = resolver;
    }

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response, @NonNull FilterChain chain)
            throws ServletException, IOException {
        UUID tenantId = TenantContext.getTenantId();
        if (tenantId != null && !isRecoveryPath(request.getRequestURI()) && resolver.isSuspended(tenantId)) {
            response.setStatus(HttpServletResponse.SC_PAYMENT_REQUIRED);
            response.setContentType("application/json");
            response.getWriter().write("{\"code\":\"BILLING_SUSPENDED\","
                    + "\"message\":\"Tenant access is suspended due to an overdue subscription\"}");
            return;
        }
        chain.doFilter(request, response);
    }

    private boolean isRecoveryPath(String path) {
        return path.startsWith("/api/v1/billing/") || path.startsWith("/api/auth/");
    }
}
