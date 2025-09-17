package com.vehiclemanagement.repository;

import com.vehiclemanagement.entity.Position;
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
public interface PositionRepository extends JpaRepository<Position, UUID> {
    
    // Basic queries
    Optional<Position> findByName(String name);
    
    List<Position> findByIsActiveTrue();
    
    List<Position> findByIsActiveTrueOrderByDisplayOrderAsc();
    
    List<Position> findByLevel(Position.PositionLevel level);
    
    List<Position> findByParentId(UUID parentId);
    
    List<Position> findByParentIdIsNull();
    
    // Search queries
    @Query("SELECT p FROM Position p WHERE " +
           "LOWER(p.name) LIKE LOWER(CONCAT('%', :searchTerm, '%')) OR " +
           "LOWER(p.description) LIKE LOWER(CONCAT('%', :searchTerm, '%'))")
    Page<Position> findBySearchTerm(@Param("searchTerm") String searchTerm, Pageable pageable);
    
    @Query("SELECT p FROM Position p WHERE " +
           "p.level = :level AND " +
           "(LOWER(p.name) LIKE LOWER(CONCAT('%', :searchTerm, '%')) OR " +
           "LOWER(p.description) LIKE LOWER(CONCAT('%', :searchTerm, '%')))")
    Page<Position> findByLevelAndSearchTerm(@Param("level") Position.PositionLevel level, 
                                           @Param("searchTerm") String searchTerm, 
                                           Pageable pageable);
    
    @Query("SELECT p FROM Position p WHERE " +
           "p.isActive = :isActive AND " +
           "(LOWER(p.name) LIKE LOWER(CONCAT('%', :searchTerm, '%')) OR " +
           "LOWER(p.description) LIKE LOWER(CONCAT('%', :searchTerm, '%')))")
    Page<Position> findByIsActiveAndSearchTerm(@Param("isActive") Boolean isActive, 
                                              @Param("searchTerm") String searchTerm, 
                                              Pageable pageable);
    
    // Hierarchy queries
    @Query("SELECT p FROM Position p WHERE p.parentId IS NULL ORDER BY p.displayOrder ASC")
    List<Position> findRootPositions();
    
    @Query("SELECT p FROM Position p WHERE p.parentId = :parentId ORDER BY p.displayOrder ASC")
    List<Position> findByParentIdOrderByDisplayOrder(@Param("parentId") UUID parentId);
    
    @Query("SELECT p FROM Position p LEFT JOIN FETCH p.children WHERE p.parentId IS NULL ORDER BY p.displayOrder ASC")
    List<Position> findRootPositionsWithChildren();
    
    @Query("SELECT p FROM Position p LEFT JOIN FETCH p.parent WHERE p.id = :id")
    Optional<Position> findByIdWithParent(@Param("id") UUID id);
    
    // Statistics queries
    Long countByLevel(Position.PositionLevel level);
    
    Long countByIsActive(Boolean isActive);
    
    Long countByParentId(UUID parentId);
    
    @Query("SELECT COUNT(p) FROM Position p WHERE p.parentId IS NULL")
    Long countRootPositions();
    
    @Query("SELECT p.level, COUNT(p) FROM Position p WHERE p.isActive = true GROUP BY p.level")
    List<Object[]> countByLevelActive();
    
    @Query("SELECT p FROM Position p WHERE p.createdAt >= :startDate AND p.createdAt <= :endDate")
    List<Position> findByCreatedAtBetween(@Param("startDate") LocalDateTime startDate, 
                                         @Param("endDate") LocalDateTime endDate);
    
    // Validation queries
    boolean existsByName(String name);
    
    boolean existsByNameAndIdNot(String name, UUID id);
    
    @Query("SELECT CASE WHEN COUNT(p) > 0 THEN true ELSE false END FROM Position p WHERE p.parentId = :positionId")
    boolean hasChildren(@Param("positionId") UUID positionId);
    
    // Salary range queries
    @Query("SELECT p FROM Position p WHERE " +
           "(:minSalary IS NULL OR p.maxSalary IS NULL OR p.maxSalary >= :minSalary) AND " +
           "(:maxSalary IS NULL OR p.minSalary IS NULL OR p.minSalary <= :maxSalary)")
    List<Position> findBySalaryRange(@Param("minSalary") java.math.BigDecimal minSalary, 
                                    @Param("maxSalary") java.math.BigDecimal maxSalary);
    
    // Advanced queries
    @Query("SELECT p FROM Position p WHERE p.isActive = true AND " +
           "(:level IS NULL OR p.level = :level) AND " +
           "(:parentId IS NULL OR p.parentId = :parentId) " +
           "ORDER BY p.displayOrder ASC")
    Page<Position> findWithFilters(@Param("level") Position.PositionLevel level,
                                  @Param("parentId") UUID parentId,
                                  Pageable pageable);
    
    @Query("SELECT MAX(p.displayOrder) FROM Position p WHERE " +
           "(:parentId IS NULL AND p.parentId IS NULL) OR p.parentId = :parentId")
    Integer getMaxDisplayOrderByParent(@Param("parentId") UUID parentId);
}
