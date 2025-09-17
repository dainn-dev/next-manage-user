package com.vehiclemanagement;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class VehicleManagementApiApplication {

    public static void main(String[] args) {
        SpringApplication.run(VehicleManagementApiApplication.class, args);
    }

}
