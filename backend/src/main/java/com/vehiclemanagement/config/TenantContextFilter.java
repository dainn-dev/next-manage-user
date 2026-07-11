package com.vehiclemanagement.config;

import com.vehiclemanagement.util.JwtUtil;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.lang.NonNull;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.UUID;

/**
 * Binds the request's tenant to {@link TenantContext} for the duration of the
 * request, reading the {@code tenant_id} claim from the bearer JWT. Registered
 * after {@link JwtAuthenticationFilter} in the chain so the token has already
 * been validated by the time this runs.
 *
 * <p>A legacy token with no {@code tenant_id} claim, an unauthenticated request,
 * or an edge/gate request (no JWT) leaves the context unbound; the fallback for
 * that case is decided centrally in {@link TenantRoutingJpaTransactionManager}
 * (Deploy 1: {@link TenantContext#DEFAULT_TENANT_ID}). The edge/gate path will
 * resolve tenant/site explicitly from the gate registration record in the
 * Deploy 2 work (R9) rather than relying on the default fallback.
 *
 * <p>The context is always cleared in a {@code finally} so a reused request
 * thread never carries a stale tenant into the next request.
 */
public class TenantContextFilter extends OncePerRequestFilter {

    private static final String PLATFORM_ADMIN = "PLATFORM_ADMIN";

    private final JwtUtil jwtUtil;
    // When RLS is enforced (Deploy 2, default-tenant fallback off) a validated
    // non-PLATFORM_ADMIN token that carries no tenant_id is rejected 401 — clearer
    // than the fail-closed empty results it would otherwise silently produce.
    private final boolean enforceTenantClaim;

    public TenantContextFilter(JwtUtil jwtUtil, boolean enforceTenantClaim) {
        this.jwtUtil = jwtUtil;
        this.enforceTenantClaim = enforceTenantClaim;
    }

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain) throws ServletException, IOException {
        try {
            final String authHeader = request.getHeader("Authorization");
            if (authHeader != null && authHeader.startsWith("Bearer ")
                    && SecurityContextHolder.getContext().getAuthentication() != null) {
                final String jwt = authHeader.substring(7);
                if (jwtUtil.validateToken(jwt)) {
                    UUID tenantId = jwtUtil.extractTenantId(jwt);
                    if (tenantId != null) {
                        TenantContext.setTenantId(tenantId);
                    } else if (enforceTenantClaim && !PLATFORM_ADMIN.equals(jwtUtil.extractRole(jwt))) {
                        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
                        response.setContentType("application/json");
                        response.setCharacterEncoding("UTF-8");
                        response.getWriter().write("{\"error\":\"Token is missing tenant_id\"}");
                        return;
                    }
                }
            }
            filterChain.doFilter(request, response);
        } finally {
            TenantContext.clear();
        }
    }
}
