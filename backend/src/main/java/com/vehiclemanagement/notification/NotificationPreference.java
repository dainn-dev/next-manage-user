package com.vehiclemanagement.notification;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.time.*;
import java.util.UUID;

@Entity
@Table(name = "notification_preference")
@Getter
@Setter
public class NotificationPreference {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    @Column(name = "tenant_id", nullable = false)
    private UUID tenantId;
    @Column(name = "user_id", nullable = false)
    private UUID userId;
    @Column(name = "site_id")
    private UUID siteId;
    @Column(name = "event_type", nullable = false)
    private String eventType;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private NotificationRecord.Channel channel;
    @Column(nullable = false)
    private boolean enabled = true;
    @Column(name = "quiet_start")
    private LocalTime quietStart;
    @Column(name = "quiet_end")
    private LocalTime quietEnd;
    @Column(nullable = false)
    private String timezone = "UTC";
    @Column(name = "created_at", insertable = false, updatable = false)
    private OffsetDateTime createdAt;
    @Column(name = "updated_at", insertable = false)
    private OffsetDateTime updatedAt;

    @PreUpdate
    void touch() {
        updatedAt = OffsetDateTime.now();
    }
}
