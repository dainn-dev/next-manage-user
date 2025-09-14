package com.vehiclemanagement.service;

import com.vehiclemanagement.dto.CustomFieldDto;
import com.vehiclemanagement.entity.CustomField;
import com.vehiclemanagement.exception.ResourceNotFoundException;
import com.vehiclemanagement.repository.CustomFieldRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@Transactional
public class CustomFieldService {
    
    @Autowired
    private CustomFieldRepository customFieldRepository;
    
    /**
     * Get all custom fields
     */
    @Transactional(readOnly = true)
    public List<CustomFieldDto> getAllCustomFields() {
        List<CustomField> fields = customFieldRepository.findAllByOrderByOrderAsc();
        return fields.stream()
                .map(CustomFieldDto::fromEntity)
                .collect(Collectors.toList());
    }
    
    /**
     * Get all active custom fields
     */
    @Transactional(readOnly = true)
    public List<CustomFieldDto> getAllActiveCustomFields() {
        List<CustomField> fields = customFieldRepository.findByIsActiveTrueOrderByOrderAsc();
        return fields.stream()
                .map(CustomFieldDto::fromEntity)
                .collect(Collectors.toList());
    }
    
    /**
     * Get custom fields with pagination
     */
    @Transactional(readOnly = true)
    public Page<CustomFieldDto> getAllCustomFields(int page, int size, String sortBy, String sortDir) {
        Sort sort = sortDir.equalsIgnoreCase("desc") ? Sort.by(sortBy).descending() : Sort.by(sortBy).ascending();
        Pageable pageable = PageRequest.of(page, size, sort);
        
        Page<CustomField> fields = customFieldRepository.findAllByOrderByOrderAsc(pageable);
        return fields.map(CustomFieldDto::fromEntity);
    }
    
    /**
     * Get active custom fields with pagination
     */
    @Transactional(readOnly = true)
    public Page<CustomFieldDto> getActiveCustomFields(int page, int size, String sortBy, String sortDir) {
        Sort sort = sortDir.equalsIgnoreCase("desc") ? Sort.by(sortBy).descending() : Sort.by(sortBy).ascending();
        Pageable pageable = PageRequest.of(page, size, sort);
        
        Page<CustomField> fields = customFieldRepository.findByIsActiveTrueOrderByOrderAsc(pageable);
        return fields.map(CustomFieldDto::fromEntity);
    }
    
    /**
     * Get custom field by ID
     */
    @Transactional(readOnly = true)
    public CustomFieldDto getCustomFieldById(UUID id) {
        CustomField field = customFieldRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Custom field not found with id: " + id));
        return CustomFieldDto.fromEntity(field);
    }
    
    /**
     * Get custom fields by category
     */
    @Transactional(readOnly = true)
    public List<CustomFieldDto> getCustomFieldsByCategory(String category) {
        List<CustomField> fields = customFieldRepository.findByCategoryOrderByOrderAsc(category);
        return fields.stream()
                .map(CustomFieldDto::fromEntity)
                .collect(Collectors.toList());
    }
    
    /**
     * Get active custom fields by category
     */
    @Transactional(readOnly = true)
    public List<CustomFieldDto> getActiveCustomFieldsByCategory(String category) {
        List<CustomField> fields = customFieldRepository.findByCategoryAndIsActiveTrueOrderByOrderAsc(category);
        return fields.stream()
                .map(CustomFieldDto::fromEntity)
                .collect(Collectors.toList());
    }
    
    /**
     * Get custom fields by type
     */
    @Transactional(readOnly = true)
    public List<CustomFieldDto> getCustomFieldsByType(CustomField.FieldType type) {
        List<CustomField> fields = customFieldRepository.findByTypeOrderByOrderAsc(type);
        return fields.stream()
                .map(CustomFieldDto::fromEntity)
                .collect(Collectors.toList());
    }
    
    /**
     * Get active custom fields by type
     */
    @Transactional(readOnly = true)
    public List<CustomFieldDto> getActiveCustomFieldsByType(CustomField.FieldType type) {
        List<CustomField> fields = customFieldRepository.findByTypeAndIsActiveTrueOrderByOrderAsc(type);
        return fields.stream()
                .map(CustomFieldDto::fromEntity)
                .collect(Collectors.toList());
    }
    
    /**
     * Get custom fields by required flag
     */
    @Transactional(readOnly = true)
    public List<CustomFieldDto> getCustomFieldsByRequired(Boolean required) {
        List<CustomField> fields = customFieldRepository.findByRequiredOrderByOrderAsc(required);
        return fields.stream()
                .map(CustomFieldDto::fromEntity)
                .collect(Collectors.toList());
    }
    
    /**
     * Get active custom fields by required flag
     */
    @Transactional(readOnly = true)
    public List<CustomFieldDto> getActiveCustomFieldsByRequired(Boolean required) {
        List<CustomField> fields = customFieldRepository.findByRequiredAndIsActiveTrueOrderByOrderAsc(required);
        return fields.stream()
                .map(CustomFieldDto::fromEntity)
                .collect(Collectors.toList());
    }
    
    /**
     * Search custom fields
     */
    @Transactional(readOnly = true)
    public Page<CustomFieldDto> searchCustomFields(String searchTerm, int page, int size, String sortBy, String sortDir) {
        Sort sort = sortDir.equalsIgnoreCase("desc") ? Sort.by(sortBy).descending() : Sort.by(sortBy).ascending();
        Pageable pageable = PageRequest.of(page, size, sort);
        
        Page<CustomField> fields = customFieldRepository.findByNameOrCategoryContainingIgnoreCase(searchTerm, pageable);
        return fields.map(CustomFieldDto::fromEntity);
    }
    
    /**
     * Create a new custom field
     */
    public CustomFieldDto createCustomField(CustomFieldDto customFieldDto) {
        // Check if field name already exists
        if (customFieldRepository.existsByName(customFieldDto.getName())) {
            throw new IllegalArgumentException("Custom field with name '" + customFieldDto.getName() + "' already exists");
        }
        
        // Set order if not provided
        if (customFieldDto.getOrder() == null) {
            Integer maxOrder = customFieldRepository.findMaxOrder();
            customFieldDto.setOrder(maxOrder + 1);
        }
        
        CustomField field = customFieldDto.toEntity();
        field.setIsActive(true); // Set as active by default
        
        CustomField savedField = customFieldRepository.save(field);
        return CustomFieldDto.fromEntity(savedField);
    }
    
    /**
     * Update an existing custom field
     */
    public CustomFieldDto updateCustomField(UUID id, CustomFieldDto customFieldDto) {
        CustomField existingField = customFieldRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Custom field not found with id: " + id));
        
        // Check if field name already exists (excluding current field)
        if (customFieldRepository.existsByNameAndIdNot(customFieldDto.getName(), id)) {
            throw new IllegalArgumentException("Custom field with name '" + customFieldDto.getName() + "' already exists");
        }
        
        // Update fields
        existingField.setName(customFieldDto.getName());
        existingField.setType(CustomField.FieldType.fromValue(customFieldDto.getType()));
        existingField.setRequired(customFieldDto.getRequired());
        existingField.setCategory(customFieldDto.getCategory());
        existingField.setOrder(customFieldDto.getOrder());
        existingField.setDescription(customFieldDto.getDescription());
        existingField.setDefaultValue(customFieldDto.getDefaultValue());
        existingField.setValidationRules(customFieldDto.getValidationRules());
        existingField.setIsActive(customFieldDto.getIsActive());
        
        // Update options
        if (customFieldDto.getOptions() != null && !customFieldDto.getOptions().isEmpty()) {
            existingField.setOptions("[" + String.join(",", customFieldDto.getOptions()) + "]");
        } else {
            existingField.setOptions(null);
        }
        
        CustomField updatedField = customFieldRepository.save(existingField);
        return CustomFieldDto.fromEntity(updatedField);
    }
    
    /**
     * Delete a custom field
     */
    public void deleteCustomField(UUID id) {
        CustomField field = customFieldRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Custom field not found with id: " + id));
        
        customFieldRepository.delete(field);
    }
    
    /**
     * Toggle custom field active status
     */
    public CustomFieldDto toggleCustomFieldStatus(UUID id) {
        CustomField field = customFieldRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Custom field not found with id: " + id));
        
        field.setIsActive(!field.getIsActive());
        CustomField updatedField = customFieldRepository.save(field);
        return CustomFieldDto.fromEntity(updatedField);
    }
    
    /**
     * Reorder custom fields
     */
    public List<CustomFieldDto> reorderCustomFields(List<UUID> fieldIds) {
        List<CustomField> fields = customFieldRepository.findAllById(fieldIds);
        
        for (int i = 0; i < fieldIds.size(); i++) {
            UUID fieldId = fieldIds.get(i);
            CustomField field = fields.stream()
                    .filter(f -> f.getId().equals(fieldId))
                    .findFirst()
                    .orElse(null);
            
            if (field != null) {
                field.setOrder(i + 1);
            }
        }
        
        List<CustomField> updatedFields = customFieldRepository.saveAll(fields);
        return updatedFields.stream()
                .map(CustomFieldDto::fromEntity)
                .collect(Collectors.toList());
    }
    
    /**
     * Get all unique categories
     */
    @Transactional(readOnly = true)
    public List<String> getAllCategories() {
        return customFieldRepository.findDistinctCategories();
    }
    
    /**
     * Get all unique categories for active fields
     */
    @Transactional(readOnly = true)
    public List<String> getActiveCategories() {
        return customFieldRepository.findDistinctCategoriesForActiveFields();
    }
    
    /**
     * Get statistics
     */
    @Transactional(readOnly = true)
    public List<Object[]> getStatisticsByCategory() {
        return customFieldRepository.countByCategory();
    }
    
    /**
     * Get active statistics
     */
    @Transactional(readOnly = true)
    public List<Object[]> getActiveStatisticsByCategory() {
        return customFieldRepository.countActiveByCategory();
    }
    
    /**
     * Get statistics by type
     */
    @Transactional(readOnly = true)
    public List<Object[]> getStatisticsByType() {
        return customFieldRepository.countByType();
    }
    
    /**
     * Get active statistics by type
     */
    @Transactional(readOnly = true)
    public List<Object[]> getActiveStatisticsByType() {
        return customFieldRepository.countActiveByType();
    }
    
    /**
     * Check if custom field exists by name
     */
    @Transactional(readOnly = true)
    public boolean existsByName(String name) {
        return customFieldRepository.existsByName(name);
    }
    
    /**
     * Check if custom field exists by name (excluding given ID)
     */
    @Transactional(readOnly = true)
    public boolean existsByNameAndIdNot(String name, UUID id) {
        return customFieldRepository.existsByNameAndIdNot(name, id);
    }
}
