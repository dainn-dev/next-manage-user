package com.vehiclemanagement.parking;

import com.vehiclemanagement.entity.ParkingSession;
import com.vehiclemanagement.entity.SiteParkingBankAccount;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@RestController
@RequestMapping("/api/v1/parking")
public class ParkingFeeController {

    private static final Pattern TRANSFER_CODE = Pattern.compile("(PV[A-F0-9]{10})", Pattern.CASE_INSENSITIVE);

    private final ParkingFeeService parkingFeeService;

    public ParkingFeeController(ParkingFeeService parkingFeeService) {
        this.parkingFeeService = parkingFeeService;
    }

    @PostMapping("/sessions")
    @PreAuthorize("hasAnyRole('TENANT_ADMIN', 'SITE_MANAGER')")
    public ResponseEntity<ParkingSession> openSession(@Valid @RequestBody OpenParkingSessionRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(parkingFeeService.openSession(
                        request.getSiteId(), request.getLicensePlate(), request.getGateInId()));
    }

    @PostMapping("/sessions/{sessionId}/claim")
    @PreAuthorize("hasRole('MEMBER')")
    public ParkingSession claim(
            @PathVariable UUID sessionId, Authentication authentication) {
        UUID userId = extractUserId(authentication);
        return parkingFeeService.claimSession(sessionId, userId);
    }

    @PostMapping("/sessions/{sessionId}/bank-transfer")
    @PreAuthorize("hasAnyRole('MEMBER', 'TENANT_ADMIN', 'SITE_MANAGER')")
    public ParkingFeeService.BankTransferInstructions bankTransfer(@PathVariable UUID sessionId) {
        return parkingFeeService.createTransferInstructions(sessionId);
    }

    @PostMapping("/sessions/{sessionId}/close")
    @PreAuthorize("hasAnyRole('TENANT_ADMIN', 'SITE_MANAGER')")
    public ParkingSession close(@PathVariable UUID sessionId, @RequestBody(required = false) Map<String, String> body) {
        UUID gateOutId = null;
        if (body != null && body.get("gateOutId") != null) {
            gateOutId = UUID.fromString(body.get("gateOutId"));
        }
        return parkingFeeService.closeSession(sessionId, gateOutId);
    }

    @PostMapping("/bank-accounts")
    @PreAuthorize("hasRole('TENANT_ADMIN')")
    public ResponseEntity<SiteParkingBankAccount> upsertBank(
            @Valid @RequestBody UpsertSiteBankAccountRequest request) {
        return ResponseEntity.ok(parkingFeeService.upsertBankAccount(request));
    }

    /**
     * SePay (or compatible) bank-transfer webhook. Matches {@code PV…} in content.
     */
    @PostMapping("/webhooks/sepay")
    public ResponseEntity<Map<String, String>> sepayWebhook(
            @Valid @RequestBody SepayParkingWebhookRequest request) {
        String content = request.getContent() == null ? "" : request.getContent();
        Matcher m = TRANSFER_CODE.matcher(content.toUpperCase(Locale.ROOT));
        if (!m.find()) {
            return ResponseEntity.badRequest().body(Map.of("error", "No PV transfer code in content"));
        }
        Long amount = null;
        if (request.getTransferAmount() != null && !request.getTransferAmount().isBlank()) {
            amount = Long.parseLong(request.getTransferAmount().replaceAll("[^0-9]", ""));
        }
        parkingFeeService.markPaidByTransferContent(m.group(1), request.getReferenceCode(), amount);
        return ResponseEntity.ok(Map.of("status", "ok"));
    }

    private UUID extractUserId(Authentication authentication) {
        Object principal = authentication.getPrincipal();
        if (principal instanceof com.vehiclemanagement.entity.User user) {
            return user.getId();
        }
        throw new IllegalStateException("Authenticated principal is not a User");
    }
}
