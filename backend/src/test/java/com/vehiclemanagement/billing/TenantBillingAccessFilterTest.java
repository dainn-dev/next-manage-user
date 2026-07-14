package com.vehiclemanagement.billing;

import com.vehiclemanagement.config.TenantContext;
import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class TenantBillingAccessFilterTest {
    private static final UUID TENANT_ID = UUID.fromString("20000000-0000-0000-0000-000000000262");

    @AfterEach
    void cleanup() {
        TenantContext.clear();
    }

    @Test
    void suspendedTenantIsRejectedFromApplicationApis() throws Exception {
        TenantAccessStatusResolver resolver = mock(TenantAccessStatusResolver.class);
        FilterChain chain = mock(FilterChain.class);
        when(resolver.isSuspended(TENANT_ID)).thenReturn(true);
        TenantContext.setTenantId(TENANT_ID);
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/sites");
        MockHttpServletResponse response = new MockHttpServletResponse();

        new TenantBillingAccessFilter(resolver).doFilter(request, response, chain);

        assertThat(response.getStatus()).isEqualTo(402);
        assertThat(response.getContentAsString()).contains("BILLING_SUSPENDED");
        verify(chain, never()).doFilter(request, response);
    }

    @Test
    void suspendedTenantCanStillReachBillingRecoveryApis() throws Exception {
        TenantAccessStatusResolver resolver = mock(TenantAccessStatusResolver.class);
        FilterChain chain = mock(FilterChain.class);
        TenantContext.setTenantId(TENANT_ID);
        MockHttpServletRequest request = new MockHttpServletRequest(
                "POST", "/api/v1/billing/portal-session");
        MockHttpServletResponse response = new MockHttpServletResponse();

        new TenantBillingAccessFilter(resolver).doFilter(request, response, chain);

        verify(chain).doFilter(request, response);
        verify(resolver, never()).isSuspended(TENANT_ID);
    }
}
