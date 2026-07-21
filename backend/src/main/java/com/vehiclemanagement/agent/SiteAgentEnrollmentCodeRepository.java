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
public interface SiteAgentEnrollmentCodeRepository extends JpaRepository<SiteAgentEnrollmentCode, UUID> {

    Optional<SiteAgentEnrollmentCode> findByCode(String code);

    @Query("SELECT e FROM SiteAgentEnrollmentCode e WHERE e.siteId = :siteId " +
           "AND e.usedAt IS NULL AND e.expiresAt > :now")
    List<SiteAgentEnrollmentCode> findUnusedValidCodes(@Param("siteId") UUID siteId,
                                                        @Param("now") LocalDateTime now);

    List<SiteAgentEnrollmentCode> findBySiteIdOrderByCreatedAtDesc(UUID siteId);
}
