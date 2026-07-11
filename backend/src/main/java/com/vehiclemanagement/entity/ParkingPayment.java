package com.vehiclemanagement.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "parking_payment")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ParkingPayment {

    @Id
    @Column(columnDefinition = "uuid")
    private UUID id;

    @Column(name = "tenant_id", insertable = false, updatable = false)
    private UUID tenantId;

    @Column(name = "session_id", nullable = false, updatable = false)
    private UUID sessionId;

    @Column(name = "amount_vnd", nullable = false)
    private long amountVnd;

    @Column(nullable = false, length = 3)
    @Builder.Default
    private String currency = "VND";

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 24)
    @Builder.Default
    private Status status = Status.AWAITING_TRANSFER;

    @Column(name = "transfer_content", nullable = false, length = 64, unique = true)
    private String transferContent;

    @Column(name = "bank_account_id")
    private UUID bankAccountId;

    @Column(name = "paid_at")
    private Instant paidAt;

    @Column(nullable = false, length = 20)
    @Builder.Default
    private String provider = "SEPAY";

    @Column(name = "provider_ref", length = 128)
    private String providerRef;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public enum Status {
        AWAITING_TRANSFER,
        PAID,
        EXPIRED,
        CANCELLED
    }

    @PrePersist
    void prePersist() {
        if (id == null) {
            id = UUID.randomUUID();
        }
        Instant now = Instant.now();
        createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = Instant.now();
    }
}
