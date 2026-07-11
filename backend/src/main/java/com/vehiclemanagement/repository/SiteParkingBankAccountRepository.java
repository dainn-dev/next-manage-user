package com.vehiclemanagement.repository;

import com.vehiclemanagement.entity.SiteParkingBankAccount;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface SiteParkingBankAccountRepository extends JpaRepository<SiteParkingBankAccount, UUID> {
    Optional<SiteParkingBankAccount> findBySiteIdAndActiveTrue(UUID siteId);

    Optional<SiteParkingBankAccount> findBySiteId(UUID siteId);
}
