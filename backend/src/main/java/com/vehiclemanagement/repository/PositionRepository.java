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
    
    
    List<Position> findByParentId(UUID parentId);
    
    List<Position> findByParentIdIsNull();
    
    // Search queries
    @Query("SELECT p FROM Position p WHERE " +
           "LOWER(p.name) LIKE LOWER(CONCAT('%', :searchTerm, '%')) OR " +
           "LOWER(p.description) LIKE LOWER(CONCAT('%', :searchTerm, '%'))")
    Page<Position> findBySearchTerm(@Param("searchTerm") String searchTerm, Pageable pageable);
    
    
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
    
    // Note: Removed queries with non-existent JPA relationships (children, parent)
    // Use findRootPositions() and findByParentId() instead for hierarchical queries
    
    // Statistics queries
    
    Long countByIsActive(Boolean isActive);
    
    Long countByParentId(UUID parentId);
    
    @Query("SELECT COUNT(p) FROM Position p WHERE p.parentId IS NULL")
    Long countRootPositions();
    
    
    @Query("SELECT p FROM Position p WHERE p.createdAt >= :startDate AND p.createdAt <= :endDate")
    List<Position> findByCreatedAtBetween(@Param("startDate") LocalDateTime startDate, 
                                         @Param("endDate") LocalDateTime endDate);
    
    // Validation queries
    boolean existsByName(String name);
    
    boolean existsByNameAndIdNot(String name, UUID id);
    
    @Query("SELECT CASE WHEN COUNT(p) > 0 THEN true ELSE false END FROM Position p WHERE p.parentId = :positionId")
    boolean hasChildren(@Param("positionId") UUID positionId);
    
    
    // Advanced queries
    @Query("SELECT p FROM Position p WHERE p.isActive = true AND " +
           "(:parentId IS NULL OR p.parentId = :parentId) " +
           "ORDER BY p.displayOrder ASC")
    Page<Position> findWithFilters(@Param("parentId") UUID parentId,
                                  Pageable pageable);
    
    // Find all leaf positions (positions without children) recursively under a parent
    @Query("SELECT p FROM Position p WHERE p.isActive = true AND " +
           "NOT EXISTS (SELECT c FROM Position c WHERE c.parentId = p.id AND c.isActive = true) " +
           "ORDER BY p.displayOrder ASC")
    List<Position> findAllLeafPositions();
    
    // Find direct leaf positions under a parent (non-recursive)
    @Query("SELECT p FROM Position p WHERE p.isActive = true AND " +
           "(:parentId IS NULL OR p.parentId = :parentId) AND " +
           "NOT EXISTS (SELECT c FROM Position c WHERE c.parentId = p.id AND c.isActive = true) " +
           "ORDER BY p.displayOrder ASC")
    Page<Position> findLeafPositionsWithFilters(@Param("parentId") UUID parentId,
                                               Pageable pageable);
    
    @Query("SELECT MAX(p.displayOrder) FROM Position p WHERE p.parentId IS NULL")
    Integer getMaxDisplayOrderForRootPositions();
    
    @Query("SELECT MAX(p.displayOrder) FROM Position p WHERE p.parentId = :parentId")
    Integer getMaxDisplayOrderByParentId(@Param("parentId") UUID parentId);
    
    // Filter queries
    @Query("SELECT p FROM Position p WHERE p.filterBy = :filterBy AND " +
           "(:parentId IS NULL OR p.parentId = :parentId) AND " +
           "p.isActive = true ORDER BY p.displayOrder ASC")
    List<Position> findByFilterByAndParentId(@Param("filterBy") Position.FilterType filterBy,
                                           @Param("parentId") UUID parentId);
    
    @Query("SELECT p FROM Position p WHERE p.filterBy = :filterBy AND " +
           "p.isActive = true ORDER BY p.displayOrder ASC")
    List<Position> findByFilterBy(@Param("filterBy") Position.FilterType filterBy);
}
