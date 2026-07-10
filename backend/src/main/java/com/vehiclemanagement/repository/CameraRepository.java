package com.vehiclemanagement.repository;

import com.vehiclemanagement.entity.Camera;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Cameras are tenant-scoped by RLS: every query is implicitly confined to the
 * current transaction's tenant. Site-scoped listing adds an explicit site_id
 * filter on top.
 */
@Repository
public interface CameraRepository extends JpaRepository<Camera, UUID> {

    List<Camera> findBySiteId(UUID siteId);

    boolean existsBySiteIdAndName(UUID siteId, String name);

    boolean existsBySiteIdAndNameAndIdNot(UUID siteId, String name, UUID id);

    /**
     * Online cameras whose last heartbeat is older than the cutoff — candidates to
     * mark offline. Disabled/provisioned cameras are excluded by the status filter.
     */
    List<Camera> findByStatusAndLastHeartbeatAtBefore(Camera.CameraStatus status, LocalDateTime cutoff);

    long countByStatus(Camera.CameraStatus status);
}
