package com.vehiclemanagement.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.net.InetAddress;
import java.net.UnknownHostException;
import java.util.Arrays;

public class RegistrationRateLimitFilter extends OncePerRequestFilter {

    private static final String REGISTER_PATH = "/api/auth/register";
    private static final String FORWARDED_FOR = "X-Forwarded-For";

    private final RegistrationRateLimitService rateLimitService;
    private final RegistrationRateLimitProperties properties;

    public RegistrationRateLimitFilter(
            RegistrationRateLimitService rateLimitService,
            RegistrationRateLimitProperties properties) {
        this.rateLimitService = rateLimitService;
        this.properties = properties;
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain) throws ServletException, IOException {
        if (!isRegistrationPost(request) || !properties.isEnabled()) {
            filterChain.doFilter(request, response);
            return;
        }

        RegistrationRateLimitService.Decision decision = rateLimitService.tryAcquire(resolveClientKey(request));
        response.setHeader("RateLimit-Limit", Integer.toString(Math.max(1, properties.getCapacity())));
        response.setHeader("RateLimit-Remaining", Integer.toString(decision.remaining()));
        if (!decision.allowed()) {
            response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
            response.setHeader("Retry-After", Long.toString(decision.retryAfterSeconds()));
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            response.setCharacterEncoding("UTF-8");
            response.getWriter().write("{\"status\":429,\"message\":\"Too many registration attempts. Please try again later.\"}");
            return;
        }

        filterChain.doFilter(request, response);
    }

    private boolean isRegistrationPost(HttpServletRequest request) {
        return "POST".equalsIgnoreCase(request.getMethod())
                && REGISTER_PATH.equals(request.getRequestURI());
    }

    private String resolveClientKey(HttpServletRequest request) {
        String remoteAddress = normalizeAddress(request.getRemoteAddr());
        if (!properties.isTrustForwardedHeaders() || !isTrustedProxy(remoteAddress)) {
            return remoteAddress;
        }

        String forwarded = request.getHeader(FORWARDED_FOR);
        if (forwarded == null || forwarded.isBlank()) {
            return remoteAddress;
        }

        String[] hops = forwarded.split(",");
        for (int i = hops.length - 1; i >= 0; i--) {
            String candidate = normalizeAddress(hops[i].trim());
            if (!isTrustedProxy(candidate)) {
                return candidate;
            }
        }
        return remoteAddress;
    }

    private boolean isTrustedProxy(String address) {
        return properties.getTrustedProxies().stream()
                .map(this::normalizeAddress)
                .anyMatch(address::equals);
    }

    private String normalizeAddress(String rawAddress) {
        if (rawAddress == null || rawAddress.isBlank()) {
            return "unknown";
        }
        String candidate = rawAddress.trim();
        if (candidate.startsWith("[") && candidate.endsWith("]")) {
            candidate = candidate.substring(1, candidate.length() - 1);
        }
        try {
            return InetAddress.getByName(candidate).getHostAddress();
        } catch (UnknownHostException ex) {
            return "unknown";
        }
    }
}
