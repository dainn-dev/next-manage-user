package com.vehiclemanagement.service;

import com.vehiclemanagement.entity.Vehicle;
import com.vehiclemanagement.entity.VehicleLog;
import com.vehiclemanagement.repository.VehicleLogRepository;
import com.vehiclemanagement.repository.VehicleRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Service
public class VehicleSchedulerService {

    @Autowired
    private VehicleRepository vehicleRepository;

    @Autowired
    private VehicleLogRepository vehicleLogRepository;

    /**
     * At 1:00 AM daily, mark any still-entered vehicles as exited and write an audit log.
     * Vehicles with approved/rejected/exited status are not touched.
     */
    @Scheduled(cron = "0 0 1 * * *")
    @Transactional
    public void resetEnteredVehicleStatuses() {
        try {
            List<Vehicle> enteredVehicles = vehicleRepository.findByStatus(Vehicle.VehicleStatus.entered);
            if (enteredVehicles.isEmpty()) {
                System.out.println("Daily vehicle status reset: No vehicles in 'entered' status.");
                return;
            }

            List<VehicleLog> logs = new ArrayList<>();
            LocalDateTime now = LocalDateTime.now();

            for (Vehicle vehicle : enteredVehicles) {
                vehicle.setStatus(Vehicle.VehicleStatus.exited);

                VehicleLog log = VehicleLog.builder()
                        .licensePlateNumber(vehicle.getLicensePlate())
                        .vehicle(vehicle)
                        .employee(vehicle.getEmployee())
                        .entryExitTime(now)
                        .type(VehicleLog.LogType.exit)
                        .vehicleType(VehicleLog.VehicleCategory.internal)
                        .notes("Auto end-of-day reset by scheduler")
                        .createdAt(now)
                        .build();
                logs.add(log);
            }

            vehicleRepository.saveAll(enteredVehicles);
            vehicleLogRepository.saveAll(logs);

            System.out.println("Daily vehicle status reset completed. " + enteredVehicles.size() + " vehicle(s) set to 'exited'.");

        } catch (Exception e) {
            System.err.println("Error during daily vehicle status reset: " + e.getMessage());
            e.printStackTrace();
        }
    }
}
