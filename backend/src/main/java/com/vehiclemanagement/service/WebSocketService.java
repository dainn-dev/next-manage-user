package com.vehiclemanagement.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

@Service
public class WebSocketService {
    
    @Autowired
    private SimpMessagingTemplate messagingTemplate;
    
    /**
     * Send vehicle check message to WebSocket topic
     */
    public void sendVehicleCheckMessage(String licensePlateNumber, String type, String message) {
        VehicleCheckMessage vehicleCheckMessage = new VehicleCheckMessage(
            licensePlateNumber, 
            type, 
            LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME),
            message
        );
        
        messagingTemplate.convertAndSend("/topic/vehicle-check", vehicleCheckMessage);
    }
    
    /**
     * Send vehicle check message with employee info to WebSocket topic
     */
    public void sendVehicleCheckMessage(Object employeeInfo) {
        System.out.println("=== Sending WebSocket Message ===");
        System.out.println("Employee info object: " + employeeInfo);
        System.out.println("Employee info class: " + employeeInfo.getClass().getName());
        messagingTemplate.convertAndSend("/topic/vehicle-check", employeeInfo);
        System.out.println("WebSocket message sent to /topic/vehicle-check");
    }
    
    /**
     * Data class for vehicle check messages
     */
    public static class VehicleCheckMessage {
        private String licensePlateNumber;
        private String type;
        private String timestamp;
        private String message;
        
        public VehicleCheckMessage() {}
        
        public VehicleCheckMessage(String licensePlateNumber, String type, String timestamp, String message) {
            this.licensePlateNumber = licensePlateNumber;
            this.type = type;
            this.timestamp = timestamp;
            this.message = message;
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
    }
}
