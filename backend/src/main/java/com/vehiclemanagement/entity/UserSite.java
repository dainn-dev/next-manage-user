package com.vehiclemanagement.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;
import java.util.UUID;

@Entity
@Table(name = "user_site")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@IdClass(UserSite.UserSiteId.class)
public class UserSite {

    @Id
    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Id
    @Column(name = "site_id", nullable = false)
    private UUID siteId;

    /** Stamped by DB session default; read-only in ORM. */
    @Column(name = "tenant_id", insertable = false, updatable = false)
    private UUID tenantId;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class UserSiteId implements Serializable {
        private UUID userId;
        private UUID siteId;
    }
}
