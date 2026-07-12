package com.vehiclemanagement.repository;

import com.vehiclemanagement.entity.Camera;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Cameras are tenant-scoped by RLS: every query is implicitly confined to the
 * current transaction's tenant. Site-scoped listing adds an explicit site_id
 * filter on top.
 */
@Repository
public interface CameraRepository extends JpaRepository<Camera, UUID> {

    List<Camera> findBySiteId(UUID siteId);

    long countBySiteId(UUID siteId);

    boolean existsBySiteIdAndName(UUID siteId, String name);

    boolean existsBySiteIdAndNameAndIdNot(UUID siteId, String name, UUID id);

    /**
     * Online cameras whose last heartbeat is older than the cutoff — candidates to
     * mark offline. Disabled/provisioned cameras are excluded by the status filter.
     */
    List<Camera> findByStatusAndLastHeartbeatAtBefore(Camera.CameraStatus status, LocalDateTime cutoff);

    long countByStatus(Camera.CameraStatus status);

    /** Serializes rotations so every returned key becomes the active credential. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from Camera c where c.id = :id")
    Optional<Camera> findByIdForUpdate(@Param("id") UUID id);

}
