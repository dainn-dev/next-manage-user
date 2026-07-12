package com.vehiclemanagement.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;
import java.util.UUID;

/**
 * Authenticates edge requests with an ADR-0602 per-camera credential.
 *
 * <p>The caller supplies a non-secret camera identity in {@code X-Camera-Id}
 * and the bearer secret in {@code X-Camera-Key}. A successful lookup binds the
 * camera tenant/site before the downstream transactional service starts, so
 * forced PostgreSQL RLS evaluates under the correct tenant. The legacy
 * {@code X-Gate-Key} filter remains a migration fallback when neither camera
 * credential header is present.</p>
 */
public class CameraKeyAuthFilter extends OncePerRequestFilter {

    public static final String CAMERA_ID_HEADER = "X-Camera-Id";
    public static final String CAMERA_KEY_HEADER = "X-Camera-Key";
    public static final String AUTHENTICATED_CAMERA_ATTRIBUTE =
            CameraKeyAuthFilter.class.getName() + ".cameraId";

    private final CameraCredentialResolver credentialResolver;

    public CameraKeyAuthFilter(CameraCredentialResolver credentialResolver) {
        this.credentialResolver = credentialResolver;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        if (!isProtectedRequest(request)) {
            filterChain.doFilter(request, response);
            return;
        }

        // Device requests must not be upgraded to a user-JWT request. The camera
        // credential is the complete machine identity for this endpoint.
        if (request.getHeader("Authorization") != null) {
            unauthorized(response);
            return;
        }

        String cameraIdHeader = request.getHeader(CAMERA_ID_HEADER);
        String cameraKey = request.getHeader(CAMERA_KEY_HEADER);

        UUID cameraId;
        try {
            cameraId = UUID.fromString(cameraIdHeader == null ? "" : cameraIdHeader);
        } catch (IllegalArgumentException ex) {
            unauthorized(response);
            return;
        }

        var authenticated = credentialResolver.authenticate(cameraId, cameraKey);
        if (authenticated.isEmpty()) {
            unauthorized(response);
            return;
        }

        var camera = authenticated.get();
        TenantContext.setTenantId(camera.tenantId());
        SiteContext.setSiteIds(List.of(camera.siteId()));
        request.setAttribute(AUTHENTICATED_CAMERA_ATTRIBUTE, camera.cameraId());
        try {
            filterChain.doFilter(request, response);
        } finally {
            SiteContext.clear();
            TenantContext.clear();
        }
    }

    private boolean isProtectedRequest(HttpServletRequest request) {
        String path = request.getRequestURI();
        return "POST".equalsIgnoreCase(request.getMethod())
                && path.startsWith("/api/cameras/")
                && path.endsWith("/heartbeat");
    }

    private void unauthorized(HttpServletResponse response) throws IOException {
        response.setStatus(HttpStatus.UNAUTHORIZED.value());
        response.setHeader("WWW-Authenticate", "Camera");
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");
        response.getWriter().write("{\"error\":\"Missing or invalid camera credential\"}");
    }
}
