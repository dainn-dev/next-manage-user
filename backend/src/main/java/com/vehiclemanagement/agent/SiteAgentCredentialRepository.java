package com.vehiclemanagement.agent;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Repository
public interface SiteAgentCredentialRepository extends JpaRepository<SiteAgentCredential, UUID> {

    List<SiteAgentCredential> findByAgentId(UUID agentId);

    @Query("SELECT c FROM SiteAgentCredential c WHERE c.agentId = :agentId " +
           "AND c.revokedAt IS NULL AND c.expiresAt > :now")
    List<SiteAgentCredential> findActiveCredentials(@Param("agentId") UUID agentId,
                                                      @Param("now") LocalDateTime now);

    @Modifying
    @Query("UPDATE SiteAgentCredential c SET c.revokedAt = :now WHERE c.agentId = :agentId")
    void revokeAllByAgentId(@Param("agentId") UUID agentId, @Param("now") LocalDateTime now);

    @Modifying
    @Query("UPDATE SiteAgentCredential c SET c.lastUsedAt = :now WHERE c.id = :credentialId")
    void updateLastUsedAt(@Param("credentialId") UUID credentialId, @Param("now") LocalDateTime now);
}
