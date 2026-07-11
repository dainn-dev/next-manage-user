package com.vehiclemanagement.repository;

import com.vehiclemanagement.entity.UserSite;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface UserSiteRepository extends JpaRepository<UserSite, UserSite.UserSiteId> {

    @Query("SELECT us.siteId FROM UserSite us WHERE us.userId = :userId")
    List<UUID> findSiteIdsByUserId(@Param("userId") UUID userId);

    List<UserSite> findByUserId(UUID userId);

    @Modifying(clearAutomatically = true)
    @Query("DELETE FROM UserSite us WHERE us.userId = :userId")
    void deleteByUserId(@Param("userId") UUID userId);
}
