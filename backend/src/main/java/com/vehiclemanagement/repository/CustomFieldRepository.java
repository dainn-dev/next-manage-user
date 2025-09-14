package com.vehiclemanagement.repository;

import com.vehiclemanagement.entity.CustomField;
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
public interface CustomFieldRepository extends JpaRepository<CustomField, UUID> {
    
    /**
     * Find all custom fields ordered by field order
     */
    List<CustomField> findAllByOrderByOrderAsc();
    
    /**
     * Find all active custom fields ordered by field order
     */
    List<CustomField> findByIsActiveTrueOrderByOrderAsc();
    
    /**
     * Find custom fields by category ordered by field order
     */
    List<CustomField> findByCategoryOrderByOrderAsc(String category);
    
    /**
     * Find active custom fields by category ordered by field order
     */
    List<CustomField> findByCategoryAndIsActiveTrueOrderByOrderAsc(String category);
    
    /**
     * Find custom fields by type ordered by field order
     */
    List<CustomField> findByTypeOrderByOrderAsc(CustomField.FieldType type);
    
    /**
     * Find active custom fields by type ordered by field order
     */
    List<CustomField> findByTypeAndIsActiveTrueOrderByOrderAsc(CustomField.FieldType type);
    
    /**
     * Find custom fields by required flag ordered by field order
     */
    List<CustomField> findByRequiredOrderByOrderAsc(Boolean required);
    
    /**
     * Find active custom fields by required flag ordered by field order
     */
    List<CustomField> findByRequiredAndIsActiveTrueOrderByOrderAsc(Boolean required);
    
    /**
     * Check if a custom field with the same name exists (excluding the given ID)
     */
    boolean existsByNameAndIdNot(String name, UUID id);
    
    /**
     * Check if a custom field with the same name exists
     */
    boolean existsByName(String name);
    
    /**
     * Find the maximum order value for a given category
     */
    @Query("SELECT COALESCE(MAX(cf.order), 0) FROM CustomField cf WHERE cf.category = :category")
    Integer findMaxOrderByCategory(@Param("category") String category);
    
    /**
     * Find the maximum order value across all custom fields
     */
    @Query("SELECT COALESCE(MAX(cf.order), 0) FROM CustomField cf")
    Integer findMaxOrder();
    
    /**
     * Search custom fields by name (case-insensitive)
     */
    @Query("SELECT cf FROM CustomField cf WHERE LOWER(cf.name) LIKE LOWER(CONCAT('%', :searchTerm, '%')) ORDER BY cf.order ASC")
    Page<CustomField> findByNameContainingIgnoreCase(@Param("searchTerm") String searchTerm, Pageable pageable);
    
    /**
     * Search custom fields by category (case-insensitive)
     */
    @Query("SELECT cf FROM CustomField cf WHERE LOWER(cf.category) LIKE LOWER(CONCAT('%', :searchTerm, '%')) ORDER BY cf.order ASC")
    Page<CustomField> findByCategoryContainingIgnoreCase(@Param("searchTerm") String searchTerm, Pageable pageable);
    
    /**
     * Search custom fields by name or category (case-insensitive)
     */
    @Query("SELECT cf FROM CustomField cf WHERE " +
           "LOWER(cf.name) LIKE LOWER(CONCAT('%', :searchTerm, '%')) OR " +
           "LOWER(cf.category) LIKE LOWER(CONCAT('%', :searchTerm, '%')) " +
           "ORDER BY cf.order ASC")
    Page<CustomField> findByNameOrCategoryContainingIgnoreCase(@Param("searchTerm") String searchTerm, Pageable pageable);
    
    /**
     * Find custom fields with pagination and sorting
     */
    Page<CustomField> findAllByOrderByOrderAsc(Pageable pageable);
    
    /**
     * Find active custom fields with pagination and sorting
     */
    Page<CustomField> findByIsActiveTrueOrderByOrderAsc(Pageable pageable);
    
    /**
     * Find custom fields by category with pagination and sorting
     */
    Page<CustomField> findByCategoryOrderByOrderAsc(String category, Pageable pageable);
    
    /**
     * Find active custom fields by category with pagination and sorting
     */
    Page<CustomField> findByCategoryAndIsActiveTrueOrderByOrderAsc(String category, Pageable pageable);
    
    /**
     * Find custom fields by type with pagination and sorting
     */
    Page<CustomField> findByTypeOrderByOrderAsc(CustomField.FieldType type, Pageable pageable);
    
    /**
     * Find active custom fields by type with pagination and sorting
     */
    Page<CustomField> findByTypeAndIsActiveTrueOrderByOrderAsc(CustomField.FieldType type, Pageable pageable);
    
    /**
     * Find custom fields by required flag with pagination and sorting
     */
    Page<CustomField> findByRequiredOrderByOrderAsc(Boolean required, Pageable pageable);
    
    /**
     * Find active custom fields by required flag with pagination and sorting
     */
    Page<CustomField> findByRequiredAndIsActiveTrueOrderByOrderAsc(Boolean required, Pageable pageable);
    
    /**
     * Get all unique categories
     */
    @Query("SELECT DISTINCT cf.category FROM CustomField cf ORDER BY cf.category ASC")
    List<String> findDistinctCategories();
    
    /**
     * Get all unique categories for active fields
     */
    @Query("SELECT DISTINCT cf.category FROM CustomField cf WHERE cf.isActive = true ORDER BY cf.category ASC")
    List<String> findDistinctCategoriesForActiveFields();
    
    /**
     * Count custom fields by category
     */
    @Query("SELECT cf.category, COUNT(cf) FROM CustomField cf GROUP BY cf.category ORDER BY cf.category ASC")
    List<Object[]> countByCategory();
    
    /**
     * Count active custom fields by category
     */
    @Query("SELECT cf.category, COUNT(cf) FROM CustomField cf WHERE cf.isActive = true GROUP BY cf.category ORDER BY cf.category ASC")
    List<Object[]> countActiveByCategory();
    
    /**
     * Count custom fields by type
     */
    @Query("SELECT cf.type, COUNT(cf) FROM CustomField cf GROUP BY cf.type ORDER BY cf.type ASC")
    List<Object[]> countByType();
    
    /**
     * Count active custom fields by type
     */
    @Query("SELECT cf.type, COUNT(cf) FROM CustomField cf WHERE cf.isActive = true GROUP BY cf.type ORDER BY cf.type ASC")
    List<Object[]> countActiveByType();
}
