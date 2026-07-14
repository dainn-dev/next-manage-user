package com.vehiclemanagement.repository;

import com.vehiclemanagement.entity.CameraIngestEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * PostgreSQL-backed durable idempotency ledger for per-camera edge events.
 *
 * <p>{@link #insertIfAbsent} deliberately relies on the existing
 * {@code uq_camera_event(camera_id, event_id)} constraint. A pre-insert lookup is
 * not safe when edge retries hit different application instances concurrently.</p>
 */
@Repository
public interface CameraIngestEventRepository extends JpaRepository<CameraIngestEvent, UUID> {

    @Modifying
    @Query(value = """
            INSERT INTO camera_ingest_event (camera_id, event_id, event_type, occurred_at, payload)
            VALUES (:cameraId, :eventId, :eventType, :occurredAt, :payload)
            ON CONFLICT (camera_id, event_id) DO NOTHING
            """, nativeQuery = true)
    int insertIfAbsent(
            @Param("cameraId") UUID cameraId,
            @Param("eventId") String eventId,
            @Param("eventType") String eventType,
            @Param("occurredAt") OffsetDateTime occurredAt,
            @Param("payload") String payload);

    @Modifying
    @Query(value = """
            UPDATE camera_ingest_event
               SET snapshot_path = :snapshotPath
             WHERE camera_id = :cameraId
               AND event_id = :eventId
            """, nativeQuery = true)
    int updateSnapshotPath(
            @Param("cameraId") UUID cameraId,
            @Param("eventId") String eventId,
            @Param("snapshotPath") String snapshotPath);

    @Modifying
    @Query(value = """
            INSERT INTO camera_ingest_snapshot(tenant_id,event_id,kind,object_key)
            SELECT event.tenant_id,event.id,:kind,:objectKey
              FROM camera_ingest_event event
             WHERE event.camera_id=:cameraId AND event.event_id=:eventId
            ON CONFLICT(event_id,kind) DO NOTHING
            """, nativeQuery = true)
    int insertSnapshot(@Param("cameraId") UUID cameraId, @Param("eventId") String eventId,
                       @Param("kind") String kind, @Param("objectKey") String objectKey);

    @Modifying
    @Query(value = """
            INSERT INTO outbox_message
                (id, tenant_id, routing_key, payload, aggregate_type, source_event_id, camera_id)
            SELECT gen_random_uuid(), event.tenant_id, :routingKey, CAST(:payload AS jsonb),
                   'camera_ingest', event.event_id, event.camera_id
              FROM camera_ingest_event event
             WHERE event.camera_id = :cameraId AND event.event_id = :eventId
            ON CONFLICT (camera_id, source_event_id)
                WHERE aggregate_type = 'camera_ingest' DO NOTHING
            """, nativeQuery = true)
    int insertOutboxMessage(@Param("cameraId") UUID cameraId,
                            @Param("eventId") String eventId,
                            @Param("routingKey") String routingKey,
                            @Param("payload") String payload);
}
