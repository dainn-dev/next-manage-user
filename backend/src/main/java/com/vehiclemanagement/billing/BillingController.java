package com.vehiclemanagement.billing;

import com.vehiclemanagement.billing.dto.BillingCheckoutRequest;
import com.vehiclemanagement.billing.dto.BillingCheckoutResponse;
import com.vehiclemanagement.billing.dto.BillingPortalRequest;
import com.vehiclemanagement.billing.dto.BillingPortalResponse;
import com.vehiclemanagement.billing.dto.BillingStatusResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import io.micrometer.core.instrument.MeterRegistry;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/billing")
@Tag(name = "Billing", description = "Tenant subscription billing APIs")
public class BillingController {

    private final BillingService billingService;
    private final MeterRegistry meterRegistry;

    public BillingController(BillingService billingService, MeterRegistry meterRegistry) {
        this.billingService = billingService;
        this.meterRegistry = meterRegistry;
    }

    @GetMapping({"/subscription", "/status"})
    @Operation(summary = "Get tenant billing status")
    public BillingStatusResponse getStatus() {
        return billingService.getBillingStatus();
    }

    @PostMapping("/checkout-session")
    @Operation(summary = "Create Stripe Checkout session")
    public BillingCheckoutResponse createCheckoutSession(
            @Valid @RequestBody BillingCheckoutRequest request,
            Authentication authentication) {
        return billingService.createCheckoutSession(request, authentication == null ? null : authentication.getName());
    }

    @PostMapping("/portal-session")
    @Operation(summary = "Create Stripe Customer Portal session")
    public BillingPortalResponse createPortalSession(@Valid @RequestBody BillingPortalRequest request) {
        return billingService.createPortalSession(request);
    }

    @PostMapping("/webhooks")
    @Operation(summary = "Receive Stripe webhook events")
    public ResponseEntity<Void> handleWebhook(
            @RequestBody String payload,
            @RequestHeader("Stripe-Signature") String signature) {
        try {
            billingService.handleWebhook(payload, signature);
            meterRegistry.counter("billing.webhook.requests", "outcome", "accepted").increment();
            return ResponseEntity.ok().build();
        } catch (RuntimeException ex) {
            meterRegistry.counter("billing.webhook.requests", "outcome", "failed").increment();
            throw ex;
        }
    }
}
