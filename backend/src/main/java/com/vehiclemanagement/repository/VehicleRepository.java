package com.vehiclemanagement.repository;

import com.vehiclemanagement.entity.Vehicle;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface VehicleRepository extends JpaRepository<Vehicle, UUID> {
    
    Optional<Vehicle> findByLicensePlate(String licensePlate);
    
    List<Vehicle> findByEmployeeId(UUID employeeId);
    
    List<Vehicle> findByVehicleType(Vehicle.VehicleType vehicleType);
    
    List<Vehicle> findByStatus(Vehicle.VehicleStatus status);
    
    @Query("SELECT v FROM Vehicle v WHERE " +
           "LOWER(v.licensePlate) LIKE LOWER(CONCAT('%', :searchTerm, '%')) OR " +
           "LOWER(v.brand) LIKE LOWER(CONCAT('%', :searchTerm, '%')) OR " +
           "LOWER(v.model) LIKE LOWER(CONCAT('%', :searchTerm, '%')) OR " +
           "LOWER(v.employee.name) LIKE LOWER(CONCAT('%', :searchTerm, '%'))")
    Page<Vehicle> findBySearchTerm(@Param("searchTerm") String searchTerm, Pageable pageable);
    
    @Query("SELECT v FROM Vehicle v WHERE " +
           "v.vehicleType = :vehicleType AND " +
           "(LOWER(v.licensePlate) LIKE LOWER(CONCAT('%', :searchTerm, '%')) OR " +
           "LOWER(v.brand) LIKE LOWER(CONCAT('%', :searchTerm, '%')) OR " +
           "LOWER(v.model) LIKE LOWER(CONCAT('%', :searchTerm, '%')))")
    Page<Vehicle> findByVehicleTypeAndSearchTerm(@Param("vehicleType") Vehicle.VehicleType vehicleType,
                                                 @Param("searchTerm") String searchTerm,
                                                 Pageable pageable);
    
    @Query("SELECT v FROM Vehicle v WHERE " +
           "v.status = :status AND " +
           "(LOWER(v.licensePlate) LIKE LOWER(CONCAT('%', :searchTerm, '%')) OR " +
           "LOWER(v.brand) LIKE LOWER(CONCAT('%', :searchTerm, '%')) OR " +
           "LOWER(v.model) LIKE LOWER(CONCAT('%', :searchTerm, '%')))")
    Page<Vehicle> findByStatusAndSearchTerm(@Param("status") Vehicle.VehicleStatus status,
                                           @Param("searchTerm") String searchTerm,
                                           Pageable pageable);
    
    boolean existsByLicensePlate(String licensePlate);
    
    @Query("SELECT COUNT(v) FROM Vehicle v WHERE v.status = :status")
    long countByStatus(@Param("status") Vehicle.VehicleStatus status);
    
    @Query("SELECT v.vehicleType, COUNT(v) FROM Vehicle v GROUP BY v.vehicleType")
    List<Object[]> countByVehicleType();
    
    @Query("SELECT v.fuelType, COUNT(v) FROM Vehicle v WHERE v.fuelType IS NOT NULL GROUP BY v.fuelType")
    List<Object[]> countByFuelType();
    
    @Query("SELECT v FROM Vehicle v WHERE v.employee.id = :employeeId")
    List<Vehicle> findByEmployee(@Param("employeeId") UUID employeeId);
}
