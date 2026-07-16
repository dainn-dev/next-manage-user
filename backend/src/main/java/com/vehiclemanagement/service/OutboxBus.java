package com.vehiclemanagement.service;

import com.fasterxml.jackson.databind.JsonNode;

import java.util.UUID;

/**
 * Adapter boundary for the application event bus used by the durable outbox
 * relay.
 */
public interface OutboxBus {
    void publish(OutboxEvent event);

    record OutboxEvent(UUID messageId, UUID tenantId, String routingKey, JsonNode payload) {
    }
}
