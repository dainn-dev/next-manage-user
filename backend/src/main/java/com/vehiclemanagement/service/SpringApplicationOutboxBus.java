package com.vehiclemanagement.service;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Component;

/** Default in-process bus adapter; replaceable by a Kafka/RabbitMQ adapter. */
@Component
public class SpringApplicationOutboxBus implements OutboxBus {
    private final ApplicationEventPublisher publisher;

    public SpringApplicationOutboxBus(ApplicationEventPublisher publisher) {
        this.publisher = publisher;
    }

    @Override
    public void publish(OutboxEvent event) {
        publisher.publishEvent(event);
    }
}
