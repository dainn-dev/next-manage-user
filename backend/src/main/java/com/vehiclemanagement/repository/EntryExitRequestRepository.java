package com.vehiclemanagement.repository;

import com.vehiclemanagement.entity.EntryExitRequest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Repository
public interface EntryExitRequestRepository extends JpaRepository<EntryExitRequest, UUID> {
    
    List<EntryExitRequest> findByEmployeeId(UUID employeeId);
    
    List<EntryExitRequest> findByVehicleId(UUID vehicleId);
    
    List<EntryExitRequest> findByRequestType(EntryExitRequest.RequestType requestType);
    
    List<EntryExitRequest> findByStatus(EntryExitRequest.RequestStatus status);
    
    @Query("SELECT r FROM EntryExitRequest r WHERE " +
           "r.employee.id = :employeeId AND " +
           "r.requestTime BETWEEN :startDate AND :endDate")
    List<EntryExitRequest> findByEmployeeAndDateRange(@Param("employeeId") UUID employeeId,
                                                      @Param("startDate") LocalDateTime startDate,
                                                      @Param("endDate") LocalDateTime endDate);
    
    @Query("SELECT r FROM EntryExitRequest r WHERE " +
           "r.vehicle.id = :vehicleId AND " +
           "r.requestTime BETWEEN :startDate AND :endDate")
    List<EntryExitRequest> findByVehicleAndDateRange(@Param("vehicleId") UUID vehicleId,
                                                     @Param("startDate") LocalDateTime startDate,
                                                     @Param("endDate") LocalDateTime endDate);
    
    @Query("SELECT r FROM EntryExitRequest r WHERE " +
           "LOWER(r.employee.name) LIKE LOWER(CONCAT('%', :searchTerm, '%')) OR " +
           "LOWER(r.vehicle.licensePlate) LIKE LOWER(CONCAT('%', :searchTerm, '%')) OR " +
           "LOWER(r.notes) LIKE LOWER(CONCAT('%', :searchTerm, '%'))")
    Page<EntryExitRequest> findBySearchTerm(@Param("searchTerm") String searchTerm, Pageable pageable);
    
    @Query("SELECT r FROM EntryExitRequest r WHERE " +
           "r.requestType = :requestType AND " +
           "(LOWER(r.employee.name) LIKE LOWER(CONCAT('%', :searchTerm, '%')) OR " +
           "LOWER(r.vehicle.licensePlate) LIKE LOWER(CONCAT('%', :searchTerm, '%')))")
    Page<EntryExitRequest> findByRequestTypeAndSearchTerm(@Param("requestType") EntryExitRequest.RequestType requestType,
                                                          @Param("searchTerm") String searchTerm,
                                                          Pageable pageable);
    
    @Query("SELECT r FROM EntryExitRequest r WHERE " +
           "r.status = :status AND " +
           "(LOWER(r.employee.name) LIKE LOWER(CONCAT('%', :searchTerm, '%')) OR " +
           "LOWER(r.vehicle.licensePlate) LIKE LOWER(CONCAT('%', :searchTerm, '%')))")
    Page<EntryExitRequest> findByStatusAndSearchTerm(@Param("status") EntryExitRequest.RequestStatus status,
                                                     @Param("searchTerm") String searchTerm,
                                                     Pageable pageable);
    
    @Query("SELECT COUNT(r) FROM EntryExitRequest r WHERE r.status = :status")
    long countByStatus(@Param("status") EntryExitRequest.RequestStatus status);
    
    @Query("SELECT COUNT(r) FROM EntryExitRequest r WHERE r.requestType = :requestType")
    long countByRequestType(@Param("requestType") EntryExitRequest.RequestType requestType);
    
    @Query("SELECT COUNT(DISTINCT r.vehicle.id) FROM EntryExitRequest r WHERE " +
           "r.requestTime BETWEEN :startDate AND :endDate")
    long countUniqueVehiclesInDateRange(@Param("startDate") LocalDateTime startDate,
                                        @Param("endDate") LocalDateTime endDate);
    
    @Query("SELECT DATE(r.requestTime) as date, COUNT(r) as count " +
           "FROM EntryExitRequest r WHERE " +
           "r.requestTime BETWEEN :startDate AND :endDate " +
           "GROUP BY DATE(r.requestTime) " +
           "ORDER BY date")
    List<Object[]> getDailyStats(@Param("startDate") LocalDateTime startDate,
                                 @Param("endDate") LocalDateTime endDate);
    
    @Query("SELECT r FROM EntryExitRequest r WHERE " +
           "r.requestTime BETWEEN :startDate AND :endDate " +
           "ORDER BY r.requestTime DESC")
    List<EntryExitRequest> findByDateRange(@Param("startDate") LocalDateTime startDate,
                                           @Param("endDate") LocalDateTime endDate);
}
