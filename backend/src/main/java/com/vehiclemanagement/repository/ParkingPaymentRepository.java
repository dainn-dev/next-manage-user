package com.vehiclemanagement.repository;

import com.vehiclemanagement.entity.ParkingPayment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface ParkingPaymentRepository extends JpaRepository<ParkingPayment, UUID> {
    Optional<ParkingPayment> findByTransferContent(String transferContent);

    Optional<ParkingPayment> findBySessionIdAndStatus(UUID sessionId, ParkingPayment.Status status);
}
