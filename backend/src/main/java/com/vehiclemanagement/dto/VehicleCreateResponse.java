package com.vehiclemanagement.dto;

public class VehicleCreateResponse {
    private VehicleDto vehicle;
    private boolean alreadyExists;
    private String message;
    
    public VehicleCreateResponse() {}
    
    public VehicleCreateResponse(VehicleDto vehicle, boolean alreadyExists, String message) {
        this.vehicle = vehicle;
        this.alreadyExists = alreadyExists;
        this.message = message;
    }
    
    public VehicleDto getVehicle() {
        return vehicle;
    }
    
    public void setVehicle(VehicleDto vehicle) {
        this.vehicle = vehicle;
    }
    
    public boolean isAlreadyExists() {
        return alreadyExists;
    }
    
    public void setAlreadyExists(boolean alreadyExists) {
        this.alreadyExists = alreadyExists;
    }
    
    public String getMessage() {
        return message;
    }
    
    public void setMessage(String message) {
        this.message = message;
    }
}
