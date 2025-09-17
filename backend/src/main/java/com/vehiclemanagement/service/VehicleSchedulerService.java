package com.vehiclemanagement.service;

import com.vehiclemanagement.entity.Vehicle;
import com.vehiclemanagement.repository.VehicleRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class VehicleSchedulerService {
    
    @Autowired
    private VehicleRepository vehicleRepository;
    
    /**
     * Reset all vehicle statuses to rejected at 1:00 AM daily
     * This ensures vehicles need daily approval for access
     */
    @Scheduled(cron = "0 0 1 * * *") // Runs at 1:00 AM every day
    @Transactional
    public void resetAllVehicleStatuses() {
        try {
            List<Vehicle> vehicles = vehicleRepository.findAll();
            int updatedCount = 0;
            
            for (Vehicle vehicle : vehicles) {
                // Only update if not already rejected
                if (vehicle.getStatus() != Vehicle.VehicleStatus.rejected) {
                    vehicle.setStatus(Vehicle.VehicleStatus.rejected);
                    updatedCount++;
                }
            }
            
            if (updatedCount > 0) {
                vehicleRepository.saveAll(vehicles);
                System.out.println("Daily vehicle status reset completed. Updated " + updatedCount + " vehicles to 'rejected' status.");
            } else {
                System.out.println("Daily vehicle status reset: No vehicles needed status update.");
            }
            
        } catch (Exception e) {
            System.err.println("Error during daily vehicle status reset: " + e.getMessage());
            e.printStackTrace();
        }
    }
}
