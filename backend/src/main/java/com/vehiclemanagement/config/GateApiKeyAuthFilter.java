package com.vehiclemanagement.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * Gates the public (permitAll) endpoints that mutate gate state with a shared
 * API key sent in the {@code X-Gate-Key} header.
 *
 * <p>Protected paths:
 * <ul>
 *     <li>{@code /api/vehicles/check-vehicle} (any method) &mdash; mutates vehicle status, creates a VehicleLog and pushes a WebSocket event.</li>
 *     <li>{@code POST /api/vehicle-logs} &mdash; lets the gate app write log entries; unauthenticated otherwise, which invites forged logs.</li>
 *     <li>{@code POST /api/gates/register} &mdash; edge gate self-registration.</li>
 *     <li>{@code POST /api/gates/{id}/heartbeat} &mdash; edge liveness ping.</li>
 * </ul>
 *
 * <p>The expected key is read from {@code gate.api-key} (env {@code GATE_API_KEY}).
 * When the key is empty (e.g. local dev without a configured secret) the filter
 * runs in "open" mode and only logs a warning, so a fresh checkout still works.
 * In production {@code GATE_API_KEY} must be set; requests with a missing or
 * mismatching {@code X-Gate-Key} header are rejected with 401.
 */
public class GateApiKeyAuthFilter extends OncePerRequestFilter {

    private static final String GATE_KEY_HEADER = "X-Gate-Key";
    private static final String CHECK_VEHICLE_PATH = "/api/vehicles/check-vehicle";
    private static final String VEHICLE_LOGS_PATH = "/api/vehicle-logs";
    private static final String GATE_REGISTER_PATH = "/api/gates/register";
    private static final String GATE_HEARTBEAT_SUFFIX = "/heartbeat";
    private static final String GATE_PATH_PREFIX = "/api/gates/";

    @Value("${gate.api-key:}")
    private String gateApiKey;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        if (isProtected(request)) {
            if (gateApiKey == null || gateApiKey.isEmpty()) {
                logger.warn("gate.api-key is not configured (GATE_API_KEY env). Gate endpoints "
                        + CHECK_VEHICLE_PATH + " / " + VEHICLE_LOGS_PATH
                        + " are running OPEN. Set GATE_API_KEY in production.");
            } else {
                String provided = request.getHeader(GATE_KEY_HEADER);
                if (provided == null || provided.isEmpty() || !gateApiKey.equals(provided)) {
                    response.setStatus(HttpStatus.UNAUTHORIZED.value());
                    response.setContentType(MediaType.APPLICATION_JSON_VALUE);
                    response.setCharacterEncoding("UTF-8");
                    response.getWriter().write("{\"error\":\"Missing or invalid X-Gate-Key header\"}");
                    return;
                }
            }
        }
        filterChain.doFilter(request, response);
    }

    private boolean isProtected(HttpServletRequest request) {
        String path = request.getRequestURI();
        if (CHECK_VEHICLE_PATH.equals(path)) {
            return true;
        }
        boolean isPost = "POST".equalsIgnoreCase(request.getMethod());
        if (VEHICLE_LOGS_PATH.equals(path) && isPost) {
            return true;
        }
        if (!isPost) {
            return false;
        }
        // Edge gate endpoints: POST /api/gates/register and POST /api/gates/{id}/heartbeat
        return GATE_REGISTER_PATH.equals(path)
                || (path.startsWith(GATE_PATH_PREFIX) && path.endsWith(GATE_HEARTBEAT_SUFFIX));
    }
}