package com.vehiclemanagement.repository;

import com.vehiclemanagement.entity.Site;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.UUID;

/**
 * Sites are tenant-scoped by RLS: every query below is implicitly confined to the
 * current transaction's tenant, so no explicit tenant_id filter is needed.
 */
@Repository
public interface SiteRepository extends JpaRepository<Site, UUID> {

    boolean existsByNameAndIdNot(String name, UUID id);

    boolean existsByName(String name);
}
