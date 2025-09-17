package com.vehiclemanagement.repository;

import com.vehiclemanagement.entity.VehicleLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Repository
public interface VehicleLogRepository extends JpaRepository<VehicleLog, UUID> {
    
    // Find by license plate
    List<VehicleLog> findByLicensePlateNumber(String licensePlateNumber);
    
    // Find by vehicle ID
    List<VehicleLog> findByVehicleId(UUID vehicleId);
    
    // Find by employee ID
    List<VehicleLog> findByEmployeeId(UUID employeeId);
    
    // Find by type
    List<VehicleLog> findByType(VehicleLog.LogType type);
    
    // Find by vehicle category
    List<VehicleLog> findByVehicleType(VehicleLog.VehicleCategory vehicleType);
    
    // Find by date range
    @Query("SELECT vl FROM VehicleLog vl WHERE vl.entryExitTime BETWEEN :startDate AND :endDate ORDER BY vl.entryExitTime DESC")
    Page<VehicleLog> findByEntryExitTimeBetween(@Param("startDate") LocalDateTime startDate, 
                                               @Param("endDate") LocalDateTime endDate, 
                                               Pageable pageable);
    
    // Find today's logs
    @Query("SELECT vl FROM VehicleLog vl WHERE DATE(vl.entryExitTime) = :date ORDER BY vl.entryExitTime DESC")
    Page<VehicleLog> findByDate(@Param("date") LocalDate date, Pageable pageable);
    
    // Search with filters
    @Query("SELECT vl FROM VehicleLog vl WHERE " +
           "(:licensePlate IS NULL OR LOWER(vl.licensePlateNumber) LIKE LOWER(CONCAT('%', :licensePlate, '%'))) AND " +
           "(:type IS NULL OR vl.type = :type) AND " +
           "(:vehicleType IS NULL OR vl.vehicleType = :vehicleType) AND " +
           "(:driverName IS NULL OR LOWER(vl.driverName) LIKE LOWER(CONCAT('%', :driverName, '%'))) AND " +
           "vl.entryExitTime BETWEEN :startDate AND :endDate " +
           "ORDER BY vl.entryExitTime DESC")
    Page<VehicleLog> findWithFilters(@Param("licensePlate") String licensePlate,
                                    @Param("type") VehicleLog.LogType type,
                                    @Param("vehicleType") VehicleLog.VehicleCategory vehicleType,
                                    @Param("driverName") String driverName,
                                    @Param("startDate") LocalDateTime startDate,
                                    @Param("endDate") LocalDateTime endDate,
                                    Pageable pageable);
    
    // Statistics queries
    @Query("SELECT COUNT(vl) FROM VehicleLog vl WHERE vl.type = :type AND DATE(vl.entryExitTime) = :date")
    long countByTypeAndDate(@Param("type") VehicleLog.LogType type, @Param("date") LocalDate date);
    
    @Query("SELECT COUNT(DISTINCT vl.licensePlateNumber) FROM VehicleLog vl WHERE DATE(vl.entryExitTime) = :date")
    long countDistinctVehiclesByDate(@Param("date") LocalDate date);
    
    @Query("SELECT vl.vehicleType, COUNT(vl) FROM VehicleLog vl WHERE DATE(vl.entryExitTime) = :date GROUP BY vl.vehicleType")
    List<Object[]> countByVehicleTypeAndDate(@Param("date") LocalDate date);
    
    // Weekly statistics
    @Query("SELECT COUNT(vl) FROM VehicleLog vl WHERE vl.type = :type AND vl.entryExitTime BETWEEN :startDate AND :endDate")
    long countByTypeAndDateRange(@Param("type") VehicleLog.LogType type, 
                                @Param("startDate") LocalDateTime startDate, 
                                @Param("endDate") LocalDateTime endDate);
    
    // Monthly statistics  
    @Query("SELECT DATE(vl.entryExitTime), COUNT(vl) FROM VehicleLog vl WHERE " +
           "vl.entryExitTime BETWEEN :startDate AND :endDate " +
           "GROUP BY DATE(vl.entryExitTime) ORDER BY DATE(vl.entryExitTime)")
    List<Object[]> getDailyStatsForPeriod(@Param("startDate") LocalDateTime startDate, 
                                         @Param("endDate") LocalDateTime endDate);
}
