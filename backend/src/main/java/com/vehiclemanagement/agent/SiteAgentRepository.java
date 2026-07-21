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
public interface SiteAgentRepository extends JpaRepository<SiteAgent, UUID> {

    List<SiteAgent> findBySiteId(UUID siteId);

    List<SiteAgent> findBySiteIdAndStatus(UUID siteId, SiteAgent.AgentStatus status);

    Optional<SiteAgent> findBySiteIdAndName(UUID siteId, String name);

    @Query("SELECT a FROM SiteAgent a WHERE a.status = 'online' AND a.lastHeartbeatAt < :threshold")
    List<SiteAgent> findStaleOnlineAgents(@Param("threshold") LocalDateTime threshold);

    boolean existsBySiteIdAndStatusAndIdNot(UUID siteId, SiteAgent.AgentStatus status, UUID excludeAgentId);
}
