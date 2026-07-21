package com.vehiclemanagement.agent;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface CameraRuntimeHealthRepository extends JpaRepository<CameraRuntimeHealth, UUID> {

    Optional<CameraRuntimeHealth> findByCameraId(UUID cameraId);

    List<CameraRuntimeHealth> findByAgentId(UUID agentId);

    @Query("SELECT h FROM CameraRuntimeHealth h WHERE h.connectionState = 'streaming' " +
           "AND h.lastFrameAt < :threshold")
    List<CameraRuntimeHealth> findStaleStreamingCameras(@Param("threshold") LocalDateTime threshold);

    @Query("SELECT h FROM CameraRuntimeHealth h " +
           "JOIN SiteAgent a ON h.agentId = a.id " +
           "WHERE a.siteId = :siteId")
    List<CameraRuntimeHealth> findBySiteId(@Param("siteId") UUID siteId);

    long countByAgentId(UUID agentId);
}
