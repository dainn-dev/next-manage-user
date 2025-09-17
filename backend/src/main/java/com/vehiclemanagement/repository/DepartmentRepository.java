package com.vehiclemanagement.repository;

import com.vehiclemanagement.entity.Department;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface DepartmentRepository extends JpaRepository<Department, UUID> {
    
    /**
     * Find department by name (case-insensitive)
     */
    Optional<Department> findByNameIgnoreCase(String name);
    
    /**
     * Check if department name exists (excluding specific ID)
     */
    @Query("SELECT COUNT(d) > 0 FROM Department d WHERE LOWER(d.name) = LOWER(:name) AND (:excludeId IS NULL OR d.id != :excludeId)")
    boolean existsByNameIgnoreCaseAndIdNot(@Param("name") String name, @Param("excludeId") UUID excludeId);
    
    /**
     * Find departments by parent ID
     */
    List<Department> findByParentIdOrderByName(UUID parentId);
    
    /**
     * Find root departments (no parent)
     */
    @Query("SELECT d FROM Department d WHERE d.parentId IS NULL ORDER BY d.name")
    List<Department> findRootDepartments();
    
    /**
     * Find departments by manager ID
     */
    List<Department> findByManagerId(UUID managerId);
    
    /**
     * Search departments by name or description
     */
    @Query("SELECT d FROM Department d WHERE LOWER(d.name) LIKE LOWER(CONCAT('%', :query, '%')) OR LOWER(d.description) LIKE LOWER(CONCAT('%', :query, '%')) ORDER BY d.name")
    List<Department> searchByNameOrDescription(@Param("query") String query);
    
    /**
     * Find departments with employee count greater than specified value
     */
    @Query("SELECT d FROM Department d WHERE d.employeeCount > :minCount ORDER BY d.employeeCount DESC")
    List<Department> findByEmployeeCountGreaterThan(@Param("minCount") Integer minCount);
    
    /**
     * Note: Removed queries with non-existent JPA relationships (children, parent)
     * Use findRootDepartments() and findByParentIdOrderByName() instead for hierarchical queries
     */
    
    /**
     * Count total employees across all departments
     */
    @Query("SELECT SUM(d.employeeCount) FROM Department d")
    Long getTotalEmployeeCount();
    
    /**
     * Find department with maximum employee count
     */
    @Query("SELECT d FROM Department d WHERE d.employeeCount = (SELECT MAX(d2.employeeCount) FROM Department d2)")
    Optional<Department> findDepartmentWithMaxEmployees();
    
    /**
     * Get departments ordered by employee count
     */
    @Query("SELECT d FROM Department d ORDER BY d.employeeCount DESC")
    List<Department> findAllOrderByEmployeeCountDesc();
    
    /**
     * Count departments by parent ID
     */
    @Query("SELECT COUNT(d) FROM Department d WHERE d.parentId = :parentId")
    Long countByParentId(@Param("parentId") UUID parentId);
    
    /**
     * Find departments created after specific date
     */
    @Query("SELECT d FROM Department d WHERE d.createdAt >= :fromDate ORDER BY d.createdAt DESC")
    List<Department> findDepartmentsCreatedAfter(@Param("fromDate") LocalDateTime fromDate);
    
    /**
     * Get department hierarchy depth
     */
    @Query(value = """
        WITH RECURSIVE dept_hierarchy AS (
            SELECT id, name, parent_id, 0 as depth
            FROM departments
            WHERE parent_id IS NULL
            UNION ALL
            SELECT d.id, d.name, d.parent_id, dh.depth + 1
            FROM departments d
            INNER JOIN dept_hierarchy dh ON d.parent_id = dh.id
        )
        SELECT MAX(depth) FROM dept_hierarchy
        """, nativeQuery = true)
    Integer getMaxHierarchyDepth();
    
    /**
     * Update employee count for a department
     */
    @Query("UPDATE Department d SET d.employeeCount = :count, d.updatedAt = CURRENT_TIMESTAMP WHERE d.id = :departmentId")
    void updateEmployeeCount(@Param("departmentId") UUID departmentId, @Param("count") Integer count);
}
