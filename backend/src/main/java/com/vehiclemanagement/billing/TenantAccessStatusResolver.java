package com.vehiclemanagement.billing;

import com.vehiclemanagement.config.PlatformAdminOperation;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.UUID;

@Component
public class TenantAccessStatusResolver {
    private final JdbcTemplate jdbc;

    public TenantAccessStatusResolver(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @PlatformAdminOperation
    public boolean isSuspended(UUID tenantId) {
        return jdbc.query("SELECT status, billing_suspended_at FROM tenant WHERE id=?",
                (rs, row) -> "suspended".equals(rs.getString(1)) && rs.getObject(2) != null, tenantId)
                .stream().findFirst().orElse(false);
    }
}
