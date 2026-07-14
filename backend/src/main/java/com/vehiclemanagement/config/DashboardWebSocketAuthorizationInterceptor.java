package com.vehiclemanagement.config;

import com.vehiclemanagement.util.JwtUtil;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Authenticates STOMP CONNECT and authorizes subscriptions to site dashboard topics. */
@Component
public class DashboardWebSocketAuthorizationInterceptor implements ChannelInterceptor {
    private static final Pattern SITE_TOPIC = Pattern.compile("^/topic/site/([0-9a-fA-F-]{36})/(slots|events)$");
    private static final String TOKEN = "dashboard.jwt";
    private final JwtUtil jwtUtil;
    private final JdbcTemplate jdbc;
    private final TransactionTemplate transactions;

    public DashboardWebSocketAuthorizationInterceptor(JwtUtil jwtUtil, JdbcTemplate jdbc,
                                                       PlatformTransactionManager transactionManager) {
        this.jwtUtil = jwtUtil;
        this.jdbc = jdbc;
        this.transactions = new TransactionTemplate(transactionManager);
    }

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
        if (accessor == null) return message;
        if (StompCommand.CONNECT.equals(accessor.getCommand())) authenticate(accessor);
        if (StompCommand.SUBSCRIBE.equals(accessor.getCommand())) authorizeSubscription(accessor);
        return message;
    }

    private void authenticate(StompHeaderAccessor accessor) {
        String authorization = accessor.getFirstNativeHeader("Authorization");
        if (authorization == null || !authorization.startsWith("Bearer ")) return;
        String token = authorization.substring(7);
        if (!jwtUtil.validateToken(token)) throw new AccessDeniedException("Invalid WebSocket token");
        String role = jwtUtil.extractRole(token);
        accessor.setUser(new UsernamePasswordAuthenticationToken(jwtUtil.extractUsername(token), token,
                List.of(new SimpleGrantedAuthority("ROLE_" + role))));
        Map<String, Object> attributes = accessor.getSessionAttributes();
        if (attributes != null) attributes.put(TOKEN, token);
    }

    private void authorizeSubscription(StompHeaderAccessor accessor) {
        String destination = accessor.getDestination();
        Matcher matcher = SITE_TOPIC.matcher(destination == null ? "" : destination);
        if (!matcher.matches()) return;
        Map<String, Object> attributes = accessor.getSessionAttributes();
        String token = attributes == null ? null : (String) attributes.get(TOKEN);
        if (token == null || !jwtUtil.validateToken(token)) {
            throw new AccessDeniedException("Authentication required for site topic");
        }
        UUID siteId = UUID.fromString(matcher.group(1));
        UUID tenantId = jwtUtil.extractTenantId(token);
        String role = jwtUtil.extractRole(token);
        if (tenantId == null || !List.of("TENANT_ADMIN", "SITE_MANAGER", "SECURITY_GUARD").contains(role)) {
            throw new AccessDeniedException("Role cannot subscribe to site topic");
        }
        if (!"TENANT_ADMIN".equals(role) && !jwtUtil.extractSiteIds(token).contains(siteId)) {
            throw new AccessDeniedException("Site is outside token scope");
        }
        if (!siteBelongsToTenant(siteId, tenantId)) {
            throw new AccessDeniedException("Site is outside tenant scope");
        }
    }

    private boolean siteBelongsToTenant(UUID siteId, UUID tenantId) {
        try {
            TenantContext.setTenantId(tenantId);
            Boolean exists = transactions.execute(status -> jdbc.queryForObject(
                    "SELECT EXISTS(SELECT 1 FROM site WHERE id = ?)", Boolean.class, siteId));
            return Boolean.TRUE.equals(exists);
        } finally {
            TenantContext.clear();
        }
    }
}
