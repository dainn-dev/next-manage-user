package com.vehiclemanagement.parking;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vehiclemanagement.config.TenantContext;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.nio.charset.StandardCharsets;
import java.sql.Types;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Writes relocation events and their outbox messages in the occupancy transaction. */
@Repository
public class RelocationEventStore {
    private final NamedParameterJdbcTemplate jdbc;
    private final ObjectMapper objectMapper;

    public RelocationEventStore(NamedParameterJdbcTemplate jdbc, ObjectMapper objectMapper) {
        this.jdbc = jdbc;
        this.objectMapper = objectMapper;
    }

    public RelocationEvent append(SlotOccupancyView oldOccupancy, SlotOccupancyObservation observation) {
        UUID tenantId = TenantContext.getTenantId();
        if (tenantId == null) {
            throw new IllegalStateException("Tenant context is required to emit a relocation event");
        }
        UUID eventId = UUID.randomUUID();
        UUID causationId = observation.observationId() == null ? UUID.randomUUID() : observation.observationId();
        UUID correlationId = UUID.nameUUIDFromBytes((observation.siteId() + ":" + observation.trackId())
                .getBytes(StandardCharsets.UTF_8));
        long sequence = nextTransitionSequence(observation.siteId(), observation.trackId());
        String plate = observation.plate() == null || observation.plate().isBlank()
                ? oldOccupancy.plate() : observation.plate();
        List<SnapshotReference> snapshots = new ArrayList<>();
        addSnapshot(snapshots, "relocation_old", oldOccupancy.snapshotReference());
        addSnapshot(snapshots, "relocation_new", observation.snapshotReference());

        Map<String, Object> payload = new LinkedHashMap<>();
        Map<String, Object> identity = new LinkedHashMap<>();
        identity.put("track_id", observation.trackId());
        if (plate != null && !plate.isBlank()) identity.put("license_plate", plate);
        payload.put("identity", identity);
        payload.put("old_slot_id", oldOccupancy.slotId());
        payload.put("old_zone_id", oldOccupancy.zoneId());
        payload.put("old_last_seen_at", oldOccupancy.lastSeenAt());
        payload.put("new_slot_id", observation.slotId());
        payload.put("new_zone_id", observation.zoneId());
        payload.put("new_observed_at", observation.occurredAt());
        payload.put("transition_sequence", sequence);
        payload.put("evidence", Map.of("status", evidenceStatus(snapshots), "snapshots", snapshots.stream()
                .map(snapshot -> Map.of("snapshot_id", snapshot.id(), "kind", snapshot.kind())).toList()));

        Map<String, Object> envelope = new LinkedHashMap<>();
        envelope.put("event_id", eventId);
        envelope.put("event_type", "VehicleRelocated");
        envelope.put("event_version", 1);
        envelope.put("tenant_id", tenantId);
        envelope.put("site_id", observation.siteId());
        envelope.put("occurred_at", observation.occurredAt());
        envelope.put("correlation_id", correlationId);
        envelope.put("causation_id", causationId);
        envelope.put("payload", payload);
        String body = json(envelope);

        jdbc.update("""
                INSERT INTO parking_event(id, tenant_id, site_id, event_type, identity_key,
                                          transition_sequence, occurred_at, correlation_id, causation_id, payload)
                VALUES (:id, :tenantId, :siteId, 'VehicleRelocated', :identityKey,
                        :sequence, :occurredAt, :correlationId, :causationId, CAST(:payload AS jsonb))
                """, parameters().addValue("id", eventId, Types.OTHER).addValue("tenantId", tenantId, Types.OTHER)
                .addValue("siteId", observation.siteId(), Types.OTHER).addValue("identityKey", observation.trackId())
                .addValue("sequence", sequence).addValue("occurredAt", observation.occurredAt())
                .addValue("correlationId", correlationId, Types.OTHER).addValue("causationId", causationId, Types.OTHER)
                .addValue("payload", body));
        snapshots.forEach(snapshot -> persistSnapshot(snapshot, eventId, tenantId));
        jdbc.update("""
                INSERT INTO outbox_message(id, tenant_id, event_id, routing_key, payload)
                VALUES (:id, :tenantId, :eventId, :routingKey, CAST(:payload AS jsonb))
                """, parameters().addValue("id", UUID.randomUUID(), Types.OTHER).addValue("tenantId", tenantId, Types.OTHER)
                .addValue("eventId", eventId, Types.OTHER)
                .addValue("routingKey", tenantId + "." + observation.siteId() + ".VehicleRelocated")
                .addValue("payload", body));
        return new RelocationEvent(eventId, observation.siteId(), oldOccupancy.slotId(), observation.slotId(),
                observation.trackId(), plate, observation.occurredAt(), sequence);
    }

    private long nextTransitionSequence(UUID siteId, String trackId) {
        Long last = jdbc.queryForObject("SELECT COALESCE(MAX(transition_sequence), 0) FROM parking_event WHERE site_id = :siteId AND identity_key = :trackId",
                parameters().addValue("siteId", siteId, Types.OTHER).addValue("trackId", trackId), Long.class);
        return (last == null ? 0 : last) + 1;
    }

    private void addSnapshot(List<SnapshotReference> snapshots, String kind, String reference) {
        if (reference == null || reference.isBlank()) return;
        snapshots.add(new SnapshotReference(UUID.randomUUID(), kind, reference));
    }

    private void persistSnapshot(SnapshotReference snapshot, UUID eventId, UUID tenantId) {
        jdbc.update("""
                INSERT INTO parking_event_snapshot(id, tenant_id, event_id, kind, snapshot_reference)
                VALUES (:id, :tenantId, :eventId, :kind, :reference)
                """, parameters().addValue("id", snapshot.id(), Types.OTHER).addValue("tenantId", tenantId, Types.OTHER)
                .addValue("eventId", eventId, Types.OTHER).addValue("kind", snapshot.kind())
                .addValue("reference", snapshot.reference()));
    }

    private String evidenceStatus(List<SnapshotReference> snapshots) {
        return snapshots.size() == 2 ? "complete" : snapshots.isEmpty() ? "unavailable" : "partial";
    }

    private String json(Map<String, Object> document) {
        try {
            return objectMapper.writeValueAsString(document);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Unable to serialize relocation event", e);
        }
    }

    private MapSqlParameterSource parameters() { return new MapSqlParameterSource(); }

    private record SnapshotReference(UUID id, String kind, String reference) { }
}
