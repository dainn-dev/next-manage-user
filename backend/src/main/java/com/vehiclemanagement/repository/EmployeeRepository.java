package com.vehiclemanagement.repository;

import com.vehiclemanagement.entity.Employee;
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
public interface EmployeeRepository extends JpaRepository<Employee, UUID> {
    
    Optional<Employee> findByEmployeeId(String employeeId);
    
    Optional<Employee> findByEmail(String email);
    
    List<Employee> findByDepartment(String department);
    
    List<Employee> findByDepartmentId(UUID departmentId);
    
    Long countByDepartment(String department);
    
    Long countByDepartmentId(UUID departmentId);
    
    List<Employee> findByStatus(Employee.EmployeeStatus status);
    
    @Query("SELECT e FROM Employee e WHERE " +
           "LOWER(e.name) LIKE LOWER(CONCAT('%', :searchTerm, '%')) OR " +
           "LOWER(e.email) LIKE LOWER(CONCAT('%', :searchTerm, '%')) OR " +
           "LOWER(e.employeeId) LIKE LOWER(CONCAT('%', :searchTerm, '%'))")
    Page<Employee> findBySearchTerm(@Param("searchTerm") String searchTerm, Pageable pageable);
    
    @Query("SELECT e FROM Employee e WHERE " +
           "e.department = :department AND " +
           "(LOWER(e.name) LIKE LOWER(CONCAT('%', :searchTerm, '%')) OR " +
           "LOWER(e.email) LIKE LOWER(CONCAT('%', :searchTerm, '%')) OR " +
           "LOWER(e.employeeId) LIKE LOWER(CONCAT('%', :searchTerm, '%')))")
    Page<Employee> findByDepartmentAndSearchTerm(@Param("department") String department, 
                                                 @Param("searchTerm") String searchTerm, 
                                                 Pageable pageable);
    
    boolean existsByEmployeeId(String employeeId);
    
    @Query("SELECT COUNT(e) FROM Employee e WHERE e.status = :status")
    long countByStatus(@Param("status") Employee.EmployeeStatus status);
    
    @Query("SELECT e.department, COUNT(e) FROM Employee e GROUP BY e.department")
    List<Object[]> countByDepartment();
    
    // Additional methods needed for the service
    Page<Employee> findByNameContainingIgnoreCaseOrEmailContainingIgnoreCaseOrEmployeeIdContainingIgnoreCase(
            String name, String email, String employeeId, Pageable pageable);
    
    Page<Employee> findByDepartmentIgnoreCase(String department, Pageable pageable);
    
    Page<Employee> findByStatus(Employee.EmployeeStatus status, Pageable pageable);
    
    long countByDepartmentIgnoreCase(String department);
    
    Optional<Employee> findByName(String name);
    
    // New methods to get employees with vehicle information
    @Query("SELECT e, v.vehicleType FROM Employee e " +
           "LEFT JOIN Vehicle v ON e.id = v.employee.id")
    Page<Object[]> findAllWithVehicleType(Pageable pageable);
    
    @Query("SELECT e, v.vehicleType FROM Employee e " +
           "LEFT JOIN Vehicle v ON e.id = v.employee.id")
    List<Object[]> findAllWithVehicleTypeList();
    
    @Query("SELECT e, v.vehicleType FROM Employee e " +
           "LEFT JOIN Vehicle v ON e.id = v.employee.id " +
           "WHERE LOWER(e.name) LIKE LOWER(CONCAT('%', :name, '%')) OR " +
           "LOWER(e.email) LIKE LOWER(CONCAT('%', :email, '%')) OR " +
           "LOWER(e.employeeId) LIKE LOWER(CONCAT('%', :employeeId, '%'))")
    Page<Object[]> findByNameContainingIgnoreCaseOrEmailContainingIgnoreCaseOrEmployeeIdContainingIgnoreCaseWithVehicleType(
            @Param("name") String name, 
            @Param("email") String email, 
            @Param("employeeId") String employeeId, 
            Pageable pageable);
    
    @Query("SELECT e, v.vehicleType FROM Employee e " +
           "LEFT JOIN Vehicle v ON e.id = v.employee.id " +
           "WHERE LOWER(e.department) = LOWER(:department)")
    Page<Object[]> findByDepartmentIgnoreCaseWithVehicleType(@Param("department") String department, Pageable pageable);
    
    @Query("SELECT e, v.vehicleType FROM Employee e " +
           "LEFT JOIN Vehicle v ON e.id = v.employee.id " +
           "WHERE e.status = :status")
    Page<Object[]> findByStatusWithVehicleType(@Param("status") Employee.EmployeeStatus status, Pageable pageable);
}
