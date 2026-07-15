package com.vehiclemanagement.notification;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "notification", uniqueConstraints = @UniqueConstraint(columnNames = {"tenant_id", "source_event_id", "user_id", "channel"}))
@Getter @Setter
public class NotificationRecord {
    public enum Channel { IN_APP, EMAIL, PUSH }
    public enum Status { PENDING, DELIVERED, FAILED, DEAD_LETTER, SUPPRESSED }
    @Id @GeneratedValue(strategy = GenerationType.UUID) private UUID id;
    @Column(name="tenant_id", nullable=false) private UUID tenantId;
    @Column(name="site_id") private UUID siteId;
    @Column(name="user_id", nullable=false) private UUID userId;
    @Column(name="source_event_id", nullable=false) private UUID sourceEventId;
    @Column(name="event_type", nullable=false) private String eventType;
    @Enumerated(EnumType.STRING) @Column(nullable=false) private Channel channel;
    @Column(name="template_key", nullable=false) private String templateKey;
    @Column(nullable=false) private String locale = "en";
    @Column(nullable=false, columnDefinition="jsonb") private String payload;
    @Enumerated(EnumType.STRING) @Column(nullable=false) private Status status = Status.PENDING;
    @Column(nullable=false) private int attempts;
    @Column(name="next_attempt_at") private OffsetDateTime nextAttemptAt;
    @Column(name="last_error") private String lastError;
    @Column(name="read_at") private OffsetDateTime readAt;
    @Column(name="acknowledged_at") private OffsetDateTime acknowledgedAt;
    @Column(name="delivered_at") private OffsetDateTime deliveredAt;
    @Column(name="created_at", insertable=false, updatable=false) private OffsetDateTime createdAt;
    @Column(name="updated_at", insertable=false) private OffsetDateTime updatedAt;
    @PreUpdate void touch() { updatedAt = OffsetDateTime.now(); }
}
