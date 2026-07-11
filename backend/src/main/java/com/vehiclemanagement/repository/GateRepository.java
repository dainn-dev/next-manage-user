package com.vehiclemanagement.repository;

import com.vehiclemanagement.entity.Gate;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface GateRepository extends JpaRepository<Gate, UUID> {

    /**
     * Find a gate by its unique name (used by register upsert).
     */
    Optional<Gate> findByName(String name);

    /**
     * Check whether another gate (excluding the given id) already uses the name.
     */
    boolean existsByNameAndIdNot(String name, UUID id);

    /**
     * Gates whose status is online but whose last heartbeat is older than the
     * given cutoff — candidates to mark offline. Disabled gates are excluded.
     */
    List<Gate> findByStatusAndLastHeartbeatAtBefore(Gate.GateStatus status, LocalDateTime cutoff);

    List<Gate> findBySiteIdIn(List<UUID> siteIds, Sort sort);

    /**
     * Count gates in the given status. Backs the {@code gate_up} Prometheus gauge.
     */
    long countByStatus(Gate.GateStatus status);
}
