package com.vehiclemanagement.agent;

import com.vehiclemanagement.config.PlatformAdminOperation;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.Optional;
import java.util.UUID;

/**
 * Resolves tenant scope for public agent authentication calls before RLS-scoped
 * transactional work begins. Only the minimum identifiers needed to establish
 * tenant context are read through the admin datasource.
 */
@Component
public class AgentTenantResolver {

    private final JdbcTemplate jdbc;

    public AgentTenantResolver(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @PlatformAdminOperation
    public Optional<UUID> resolveByEnrollmentCode(String code) {
        return queryTenantId(
            "SELECT tenant_id FROM site_agent_enrollment_code WHERE code = ?",
            code);
    }

    @PlatformAdminOperation
    public Optional<UUID> resolveByAgentId(UUID agentId) {
        return queryTenantId("SELECT tenant_id FROM site_agent WHERE id = ?", agentId);
    }

    private Optional<UUID> queryTenantId(String sql, Object value) {
        try {
            return Optional.ofNullable(jdbc.queryForObject(sql, UUID.class, value));
        } catch (EmptyResultDataAccessException ex) {
            return Optional.empty();
        }
    }
}
