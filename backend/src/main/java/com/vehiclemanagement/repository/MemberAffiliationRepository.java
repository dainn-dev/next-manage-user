package com.vehiclemanagement.repository;

import com.vehiclemanagement.entity.MemberAffiliation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface MemberAffiliationRepository extends JpaRepository<MemberAffiliation, MemberAffiliation.MemberAffiliationId> {

    List<MemberAffiliation> findByUserId(UUID userId);

    List<MemberAffiliation> findByTenantId(UUID tenantId);

    @Query("SELECT ma.tenantId FROM MemberAffiliation ma WHERE ma.userId = :userId AND ma.status = 'ACTIVE'")
    List<UUID> findActiveTenantIdsByUserId(@Param("userId") UUID userId);

    boolean existsByUserIdAndTenantIdAndStatus(UUID userId, UUID tenantId, MemberAffiliation.Status status);
}
