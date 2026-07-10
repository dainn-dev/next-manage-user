package com.vehiclemanagement.repository;

import com.vehiclemanagement.entity.Zone;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

/**
 * Zones are tenant-scoped by RLS. Site-scoped reads add an explicit site_id filter
 * on top (a tenant can own several sites).
 */
@Repository
public interface ZoneRepository extends JpaRepository<Zone, UUID> {

    List<Zone> findBySiteId(UUID siteId);

    boolean existsBySiteIdAndName(UUID siteId, String name);

    boolean existsBySiteIdAndNameAndIdNot(UUID siteId, String name, UUID id);
}
