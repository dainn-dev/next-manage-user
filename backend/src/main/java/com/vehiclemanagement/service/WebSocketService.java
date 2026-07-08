package com.vehiclemanagement.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.UUID;

@Service
public class WebSocketService {

    /** Global topic kept for backward compatibility with the current monitoring UI. */
    public static final String GLOBAL_TOPIC = "/topic/vehicle-check";

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    /**
     * Send a simple vehicle check message to the global topic only.
     */
    public void sendVehicleCheckMessage(String licensePlateNumber, String type, String message) {
        sendVehicleCheckMessage(licensePlateNumber, type, message, null);
    }

    /**
     * Send a simple vehicle check message. When {@code gateId} is provided the
     * event is published both to the global topic and to the per-gate topic so a
     * UI can subscribe to a single gate.
     */
    public void sendVehicleCheckMessage(String licensePlateNumber, String type, String message, UUID gateId) {
        VehicleCheckMessage vehicleCheckMessage = new VehicleCheckMessage(
            licensePlateNumber,
            type,
            LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME),
            message,
            gateId != null ? gateId.toString() : null
        );

        publish(vehicleCheckMessage, gateId);
    }

    /**
     * Send a rich vehicle check payload (employee + vehicle info) to the global topic only.
     */
    public void sendVehicleCheckMessage(Object employeeInfo) {
        sendVehicleCheckMessage(employeeInfo, null);
    }

    /**
     * Send a rich vehicle check payload. When {@code gateId} is provided the event
     * is fanned out to both the global topic and the per-gate topic.
     */
    public void sendVehicleCheckMessage(Object employeeInfo, UUID gateId) {
        System.out.println("=== Sending WebSocket Message ===");
        System.out.println("Employee info object: " + employeeInfo);
        System.out.println("Employee info class: " + (employeeInfo != null ? employeeInfo.getClass().getName() : "null"));
        publish(employeeInfo, gateId);
    }

    /**
     * Build the per-gate topic destination for a given gate id.
     */
    public static String gateTopic(UUID gateId) {
        return "/topic/gate/" + gateId + "/check";
    }

    /**
     * Fan the payload out to the global topic and, when a gate is known, the
     * per-gate topic. Fire-and-forget: {@code SimpleBroker} does not persist or
     * replay; a client that missed the event replays it via
     * {@code GET /api/gates/{id}/recent-checks}.
     */
    private void publish(Object payload, UUID gateId) {
        messagingTemplate.convertAndSend(GLOBAL_TOPIC, payload);
        System.out.println("WebSocket message sent to " + GLOBAL_TOPIC);
        if (gateId != null) {
            String gateDestination = gateTopic(gateId);
            messagingTemplate.convertAndSend(gateDestination, payload);
            System.out.println("WebSocket message sent to " + gateDestination);
        }
    }

    /**
     * Data class for vehicle check messages
     */
    public static class VehicleCheckMessage {
        private String licensePlateNumber;
        private String type;
        private String timestamp;
        private String message;
        private String gateId;

        public VehicleCheckMessage() {}

        public VehicleCheckMessage(String licensePlateNumber, String type, String timestamp, String message) {
            this(licensePlateNumber, type, timestamp, message, null);
        }

        public VehicleCheckMessage(String licensePlateNumber, String type, String timestamp, String message, String gateId) {
            this.licensePlateNumber = licensePlateNumber;
            this.type = type;
            this.timestamp = timestamp;
            this.message = message;
            this.gateId = gateId;
        }

        // Getters and Setters
        public String getLicensePlateNumber() {
            return licensePlateNumber;
        }

        public void setLicensePlateNumber(String licensePlateNumber) {
            this.licensePlateNumber = licensePlateNumber;
        }

        public String getType() {
            return type;
        }

        public void setType(String type) {
            this.type = type;
        }

        public String getTimestamp() {
            return timestamp;
        }

        public void setTimestamp(String timestamp) {
            this.timestamp = timestamp;
        }

        public String getMessage() {
            return message;
        }

        public void setMessage(String message) {
            this.message = message;
        }

        public String getGateId() {
            return gateId;
        }

        public void setGateId(String gateId) {
            this.gateId = gateId;
        }
    }
}
