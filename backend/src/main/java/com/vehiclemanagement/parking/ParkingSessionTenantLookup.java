package com.vehiclemanagement.parking;

import com.vehiclemanagement.config.PlatformAdminOperation;
import com.vehiclemanagement.exception.ResourceNotFoundException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.UUID;

@Component
public class ParkingSessionTenantLookup {

    private final JdbcTemplate jdbcTemplate;

    public ParkingSessionTenantLookup(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @PlatformAdminOperation
    public UUID requireTenantId(UUID sessionId) {
        UUID tenantId = jdbcTemplate.query(
                "SELECT tenant_id FROM parking_session WHERE id = ? LIMIT 1",
                rs -> rs.next() ? (UUID) rs.getObject(1) : null,
                sessionId);
        if (tenantId == null) {
            throw new ResourceNotFoundException("Parking session not found");
        }
        return tenantId;
    }
}
