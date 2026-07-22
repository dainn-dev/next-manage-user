package com.vehiclemanagement.agent;

import com.vehiclemanagement.config.TenantContext;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * Authentication filter for agent JWT tokens.
 * Validates Bearer token and sets tenant context for RLS.
 */
@Component
@Slf4j
@RequiredArgsConstructor
public class AgentTokenAuthenticationFilter extends OncePerRequestFilter {

    private final AgentAuthenticationService authService;
    private final SiteAgentRepository agentRepository;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {

        if (!isAgentEndpoint(request)) {
            filterChain.doFilter(request, response);
            return;
        }

        // Skip authentication for enroll and refresh endpoints
        String path = request.getRequestURI();
        if (path.endsWith("/enroll") || path.endsWith("/token/refresh")) {
            filterChain.doFilter(request, response);
            return;
        }

        String authHeader = request.getHeader("Authorization");
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            unauthorized(response, "Missing or invalid Authorization header");
            return;
        }

        String token = authHeader.substring(7);

        try {
            // Validate token and extract claims
            AgentAuthenticationService.AgentClaims claims = authService.validateAccessToken(token);

            // Bind tenant before any RLS-scoped repository access.
            TenantContext.setTenantId(claims.tenantId());

            try {
                // Verify agent is not revoked
                SiteAgent agent = agentRepository.findById(claims.agentId())
                    .orElseThrow(() -> new IllegalArgumentException("Agent not found"));

                if (agent.getStatus() == SiteAgent.AgentStatus.revoked) {
                    unauthorized(response, "Agent revoked");
                    return;
                }

                // Set authentication principal
                AgentRuntimeController.AgentPrincipal principal =
                    new AgentRuntimeController.AgentPrincipal(
                        claims.agentId(),
                        claims.siteId(),
                        claims.tenantId()
                    );

                UsernamePasswordAuthenticationToken authentication =
                    new UsernamePasswordAuthenticationToken(principal, null, null);
                SecurityContextHolder.getContext().setAuthentication(authentication);

                filterChain.doFilter(request, response);
            } finally {
                TenantContext.clear();
                SecurityContextHolder.clearContext();
            }

        } catch (Exception e) {
            log.warn("Agent token validation failed: {}", e.getMessage());
            unauthorized(response, "Invalid token");
        }
    }

    private boolean isAgentEndpoint(HttpServletRequest request) {
        String path = request.getRequestURI();
        return path.startsWith("/api/agent/");
    }

    private void unauthorized(HttpServletResponse response, String message) throws IOException {
        response.setStatus(HttpStatus.UNAUTHORIZED.value());
        response.setHeader("WWW-Authenticate", "Bearer");
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");
        response.getWriter().write("{\"error\":\"" + message + "\"}");
    }
}
