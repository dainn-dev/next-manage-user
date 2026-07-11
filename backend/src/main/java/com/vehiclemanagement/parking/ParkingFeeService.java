package com.vehiclemanagement.parking;

import com.vehiclemanagement.config.PlatformAdminOperation;
import com.vehiclemanagement.config.TenantContext;
import com.vehiclemanagement.entity.ParkingPayment;
import com.vehiclemanagement.entity.ParkingSession;
import com.vehiclemanagement.entity.SiteParkingBankAccount;
import com.vehiclemanagement.exception.ResourceNotFoundException;
import com.vehiclemanagement.repository.ParkingPaymentRepository;
import com.vehiclemanagement.repository.ParkingSessionRepository;
import com.vehiclemanagement.repository.SiteParkingBankAccountRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Duration;
import java.time.Instant;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

/**
 * Public-site parking fees collected via Vietnamese bank transfer (SePay / VietQR).
 * Separate from SaaS Stripe billing in {@code com.vehiclemanagement.billing}.
 */
@Service
public class ParkingFeeService {

    /** Default rate VND / hour until site rate cards exist. */
    private static final long DEFAULT_RATE_VND_PER_HOUR = 5_000L;
    private static final long MIN_FEE_VND = 5_000L;

    private final ParkingSessionRepository parkingSessionRepository;
    private final ParkingPaymentRepository parkingPaymentRepository;
    private final SiteParkingBankAccountRepository bankAccountRepository;
    private final ParkingSessionTenantLookup sessionTenantLookup;
    private final JdbcTemplate jdbcTemplate;
    private final PlatformTransactionManager transactionManager;

    public ParkingFeeService(
            ParkingSessionRepository parkingSessionRepository,
            ParkingPaymentRepository parkingPaymentRepository,
            SiteParkingBankAccountRepository bankAccountRepository,
            ParkingSessionTenantLookup sessionTenantLookup,
            JdbcTemplate jdbcTemplate,
            PlatformTransactionManager transactionManager) {
        this.parkingSessionRepository = parkingSessionRepository;
        this.parkingPaymentRepository = parkingPaymentRepository;
        this.bankAccountRepository = bankAccountRepository;
        this.sessionTenantLookup = sessionTenantLookup;
        this.jdbcTemplate = jdbcTemplate;
        this.transactionManager = transactionManager;
    }

    @Transactional
    public ParkingSession openSession(UUID siteId, String licensePlate, UUID gateInId) {
        ParkingSession session = ParkingSession.builder()
                .siteId(siteId)
                .licensePlate(normalizePlate(licensePlate))
                .gateInId(gateInId)
                .status(ParkingSession.Status.OPEN)
                .qrTokenJti(UUID.randomUUID().toString().replace("-", ""))
                .build();
        return parkingSessionRepository.save(session);
    }

    /**
     * Bind tenant from session row before opening a TX so RLS GUC is correct for MEMBER
     * tokens that omit {@code tenant_id}.
     */
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public ParkingSession claimSession(UUID sessionId, UUID memberUserId) {
        UUID tenantId = sessionTenantLookup.requireTenantId(sessionId);
        return runInTenant(tenantId, () -> {
            ParkingSession session = parkingSessionRepository.findByIdAndStatus(sessionId, ParkingSession.Status.OPEN)
                    .orElseThrow(() -> new ResourceNotFoundException("Open parking session not found"));
            if (session.getClaimedByUserId() != null && !session.getClaimedByUserId().equals(memberUserId)) {
                throw new IllegalStateException("Session already claimed by another user");
            }
            session.setClaimedByUserId(memberUserId);
            return parkingSessionRepository.save(session);
        });
    }

    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public BankTransferInstructions createTransferInstructions(UUID sessionId) {
        UUID tenantId = sessionTenantLookup.requireTenantId(sessionId);
        return runInTenant(tenantId, () -> {
            ParkingSession session = parkingSessionRepository.findById(sessionId)
                    .orElseThrow(() -> new ResourceNotFoundException("Parking session not found"));
            if (session.getStatus() != ParkingSession.Status.OPEN) {
                throw new IllegalStateException("Session is not open");
            }

            SiteParkingBankAccount bank = bankAccountRepository.findBySiteIdAndActiveTrue(session.getSiteId())
                    .orElseThrow(() -> new IllegalStateException(
                            "No active bank account configured for site " + session.getSiteId()));

            long amount = quoteAmountVnd(session);
            String content = buildTransferContent(session.getId());

            ParkingPayment payment = parkingPaymentRepository
                    .findBySessionIdAndStatus(sessionId, ParkingPayment.Status.AWAITING_TRANSFER)
                    .orElseGet(() -> ParkingPayment.builder()
                            .sessionId(sessionId)
                            .transferContent(content)
                            .build());
            payment.setAmountVnd(amount);
            payment.setBankAccountId(bank.getId());
            payment.setStatus(ParkingPayment.Status.AWAITING_TRANSFER);
            payment.setProvider("SEPAY");
            if (payment.getTransferContent() == null || payment.getTransferContent().isBlank()) {
                payment.setTransferContent(content);
            }
            payment = parkingPaymentRepository.save(payment);

            return new BankTransferInstructions(
                    payment.getId(),
                    session.getId(),
                    payment.getAmountVnd(),
                    payment.getCurrency(),
                    payment.getTransferContent(),
                    bank.getBankCode(),
                    bank.getAccountNumber(),
                    bank.getAccountName(),
                    payment.getStatus().name());
        });
    }

    @Transactional
    public ParkingSession closeSession(UUID sessionId, UUID gateOutId) {
        ParkingSession session = parkingSessionRepository.findByIdAndStatus(sessionId, ParkingSession.Status.OPEN)
                .orElseThrow(() -> new ResourceNotFoundException("Open parking session not found"));
        session.setStatus(ParkingSession.Status.CLOSED);
        session.setEndedAt(Instant.now());
        session.setGateOutId(gateOutId);
        session.setQrTokenJti(null);
        return parkingSessionRepository.save(session);
    }

    @Transactional
    public SiteParkingBankAccount upsertBankAccount(UpsertSiteBankAccountRequest request) {
        SiteParkingBankAccount account = bankAccountRepository.findBySiteId(request.getSiteId())
                .orElseGet(() -> SiteParkingBankAccount.builder().siteId(request.getSiteId()).build());
        account.setBankCode(request.getBankCode().trim());
        account.setAccountNumber(request.getAccountNumber().trim());
        account.setAccountName(request.getAccountName().trim());
        account.setActive(true);
        return bankAccountRepository.save(account);
    }

    /**
     * SePay (or manual ops) confirms an inbound transfer by matching {@code transfer_content}.
     * Runs on admin datasource to resolve the payment across tenants.
     */
    @PlatformAdminOperation
    @Transactional
    public void markPaidByTransferContent(String transferContent, String providerRef, Long amountVnd) {
        String content = transferContent == null ? "" : transferContent.trim().toUpperCase(Locale.ROOT);
        Map<String, Object> row = jdbcTemplate.query(
                """
                SELECT id, tenant_id, amount_vnd, status
                FROM parking_payment
                WHERE UPPER(transfer_content) = ?
                LIMIT 1
                """,
                rs -> {
                    if (!rs.next()) {
                        return null;
                    }
                    return Map.of(
                            "id", (UUID) rs.getObject("id"),
                            "tenant_id", (UUID) rs.getObject("tenant_id"),
                            "amount_vnd", rs.getLong("amount_vnd"),
                            "status", rs.getString("status"));
                },
                content);
        if (row == null) {
            throw new ResourceNotFoundException("No payment for transfer content: " + content);
        }
        if (!"AWAITING_TRANSFER".equals(row.get("status"))) {
            return; // idempotent
        }
        if (amountVnd != null && amountVnd > 0 && amountVnd < (Long) row.get("amount_vnd")) {
            throw new IllegalArgumentException("Transferred amount is less than required fee");
        }
        UUID tenantId = (UUID) row.get("tenant_id");
        UUID previous = TenantContext.getTenantId();
        TenantContext.setTenantId(tenantId);
        try {
            ParkingPayment payment = parkingPaymentRepository.findById((UUID) row.get("id"))
                    .orElseThrow();
            payment.setStatus(ParkingPayment.Status.PAID);
            payment.setPaidAt(Instant.now());
            payment.setProviderRef(providerRef);
            parkingPaymentRepository.save(payment);
        } finally {
            if (previous == null) {
                TenantContext.clear();
            } else {
                TenantContext.setTenantId(previous);
            }
        }
    }

    public long quoteAmountVnd(ParkingSession session) {
        Instant end = session.getEndedAt() != null ? session.getEndedAt() : Instant.now();
        long minutes = Math.max(1, Duration.between(session.getStartedAt(), end).toMinutes());
        long hoursCeil = (minutes + 59) / 60;
        return Math.max(MIN_FEE_VND, hoursCeil * DEFAULT_RATE_VND_PER_HOUR);
    }

    static String buildTransferContent(UUID sessionId) {
        String shortId = sessionId.toString().replace("-", "").substring(0, 10).toUpperCase(Locale.ROOT);
        return "PV" + shortId;
    }

    private static String normalizePlate(String plate) {
        return plate == null ? "" : plate.trim().toUpperCase(Locale.ROOT);
    }

    private <T> T runInTenant(UUID tenantId, java.util.function.Supplier<T> action) {
        UUID previous = TenantContext.getTenantId();
        TenantContext.setTenantId(tenantId);
        try {
            TransactionTemplate tx = new TransactionTemplate(transactionManager);
            return tx.execute(status -> action.get());
        } finally {
            restoreTenant(previous);
        }
    }

    private static void restoreTenant(UUID previous) {
        if (previous == null) {
            TenantContext.clear();
        } else {
            TenantContext.setTenantId(previous);
        }
    }

    public record BankTransferInstructions(
            UUID paymentId,
            UUID sessionId,
            long amountVnd,
            String currency,
            String transferContent,
            String bankCode,
            String accountNumber,
            String accountName,
            String status) {
    }
}
