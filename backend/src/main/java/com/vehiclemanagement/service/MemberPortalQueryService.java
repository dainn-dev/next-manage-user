package com.vehiclemanagement.service;

import com.vehiclemanagement.config.PlatformAdminOperation;
import com.vehiclemanagement.dto.MemberParkingSessionDto;
import com.vehiclemanagement.dto.MemberVehicleGarageDto;
import com.vehiclemanagement.exception.ResourceNotFoundException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Cross-tenant MEMBER garage / visit reads (ADR-0604). Admin datasource.
 */
@Service
public class MemberPortalQueryService {

    private final JdbcTemplate jdbc;

    public MemberPortalQueryService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @PlatformAdminOperation
    @Transactional(propagation = Propagation.REQUIRES_NEW, readOnly = true)
    public List<MemberVehicleGarageDto> listGarage(UUID memberUserId) {
        List<Map<String, Object>> rows = jdbc.queryForList("""
                SELECT v.id AS vehicle_id, v.license_plate, v.vehicle_type, v.brand, v.model, v.color, v.status,
                       tvr.tenant_id, t.name AS tenant_name, tvr.site_id, tvr.status AS reg_status
                FROM vehicles v
                LEFT JOIN tenant_vehicle_registration tvr
                  ON tvr.vehicle_id = v.id AND tvr.status = 'ACTIVE'
                LEFT JOIN tenant t ON t.id = tvr.tenant_id
                WHERE v.owner_id = ?
                ORDER BY v.license_plate, t.name NULLS LAST
                """, memberUserId);

        Map<UUID, MemberVehicleGarageDto.MemberVehicleGarageDtoBuilder> builders = new LinkedHashMap<>();
        Map<UUID, List<MemberVehicleGarageDto.RegistrationOrg>> regs = new LinkedHashMap<>();

        for (Map<String, Object> row : rows) {
            UUID vehicleId = (UUID) row.get("vehicle_id");
            builders.computeIfAbsent(vehicleId, id -> MemberVehicleGarageDto.builder()
                    .vehicleId(id)
                    .licensePlate((String) row.get("license_plate"))
                    .vehicleType(stringOrNull(row.get("vehicle_type")))
                    .brand((String) row.get("brand"))
                    .model((String) row.get("model"))
                    .color((String) row.get("color"))
                    .status(stringOrNull(row.get("status"))));
            regs.computeIfAbsent(vehicleId, id -> new ArrayList<>());
            if (row.get("tenant_id") != null) {
                regs.get(vehicleId).add(MemberVehicleGarageDto.RegistrationOrg.builder()
                        .tenantId((UUID) row.get("tenant_id"))
                        .tenantName((String) row.get("tenant_name"))
                        .siteId((UUID) row.get("site_id"))
                        .status(stringOrNull(row.get("reg_status")))
                        .build());
            }
        }

        List<MemberVehicleGarageDto> out = new ArrayList<>();
        for (Map.Entry<UUID, MemberVehicleGarageDto.MemberVehicleGarageDtoBuilder> e : builders.entrySet()) {
            out.add(e.getValue().registeredAt(regs.getOrDefault(e.getKey(), List.of())).build());
        }
        return out;
    }

    @PlatformAdminOperation
    @Transactional(propagation = Propagation.REQUIRES_NEW, readOnly = true)
    public List<MemberParkingSessionDto> listSessions(UUID memberUserId) {
        return jdbc.query("""
                SELECT ps.id, ps.tenant_id, t.name AS tenant_name, ps.site_id, ps.license_plate,
                       ps.status, ps.started_at, ps.ended_at, ps.qr_token_jti
                FROM parking_session ps
                LEFT JOIN tenant t ON t.id = ps.tenant_id
                WHERE ps.claimed_by_user_id = ?
                ORDER BY ps.started_at DESC
                LIMIT 100
                """, (rs, i) -> MemberParkingSessionDto.builder()
                .sessionId((UUID) rs.getObject("id"))
                .tenantId((UUID) rs.getObject("tenant_id"))
                .tenantName(rs.getString("tenant_name"))
                .siteId((UUID) rs.getObject("site_id"))
                .licensePlate(rs.getString("license_plate"))
                .status(rs.getString("status"))
                .startedAt(toInstant(rs.getTimestamp("started_at")))
                .endedAt(toInstant(rs.getTimestamp("ended_at")))
                .qrTokenJti(rs.getString("qr_token_jti"))
                .locationLabel(null)
                .build(), memberUserId);
    }

    @PlatformAdminOperation
    @Transactional(propagation = Propagation.REQUIRES_NEW, readOnly = true)
    public MemberParkingSessionDto requireOwnedSession(UUID memberUserId, UUID sessionId) {
        List<MemberParkingSessionDto> rows = jdbc.query("""
                SELECT ps.id, ps.tenant_id, t.name AS tenant_name, ps.site_id, ps.license_plate,
                       ps.status, ps.started_at, ps.ended_at, ps.qr_token_jti
                FROM parking_session ps
                LEFT JOIN tenant t ON t.id = ps.tenant_id
                WHERE ps.id = ? AND ps.claimed_by_user_id = ?
                """, (rs, i) -> MemberParkingSessionDto.builder()
                .sessionId((UUID) rs.getObject("id"))
                .tenantId((UUID) rs.getObject("tenant_id"))
                .tenantName(rs.getString("tenant_name"))
                .siteId((UUID) rs.getObject("site_id"))
                .licensePlate(rs.getString("license_plate"))
                .status(rs.getString("status"))
                .startedAt(toInstant(rs.getTimestamp("started_at")))
                .endedAt(toInstant(rs.getTimestamp("ended_at")))
                .qrTokenJti(rs.getString("qr_token_jti"))
                .locationLabel(null)
                .build(), sessionId, memberUserId);
        if (rows.isEmpty()) {
            throw new ResourceNotFoundException("Parking session not found");
        }
        return rows.get(0);
    }

    @PlatformAdminOperation
    @Transactional(propagation = Propagation.REQUIRES_NEW, readOnly = true)
    public UUID resolveSessionIdFromCode(String code) {
        String trimmed = code == null ? "" : code.trim();
        if (trimmed.isEmpty()) {
            throw new IllegalArgumentException("Claim code is required");
        }
        try {
            UUID asUuid = UUID.fromString(trimmed);
            Long count = jdbc.queryForObject(
                    "SELECT count(*) FROM parking_session WHERE id = ?", Long.class, asUuid);
            if (count != null && count > 0) {
                return asUuid;
            }
        } catch (IllegalArgumentException ignored) {
            // not a UUID — treat as QR jti
        }
        List<UUID> ids = jdbc.query("""
                SELECT id FROM parking_session
                WHERE lower(qr_token_jti) = lower(?) AND status = 'OPEN'
                LIMIT 1
                """, (rs, i) -> (UUID) rs.getObject(1), trimmed);
        if (ids.isEmpty()) {
            throw new ResourceNotFoundException("No open parking session for this QR code");
        }
        return ids.get(0);
    }

    private static String stringOrNull(Object value) {
        return value == null ? null : value.toString();
    }

    private static Instant toInstant(Timestamp ts) {
        return ts == null ? null : ts.toInstant();
    }
}
