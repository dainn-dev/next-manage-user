package com.vehiclemanagement.dto;

import com.vehiclemanagement.entity.CustomField;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public class CustomFieldDto {
    
    private UUID id;
    
    @NotBlank(message = "Field name is required")
    private String name;
    
    @NotNull(message = "Field type is required")
    private String type;
    
    private List<String> options;
    
    @NotNull(message = "Required flag is required")
    private Boolean required;
    
    @NotBlank(message = "Category is required")
    private String category;
    
    @NotNull(message = "Order is required")
    private Integer order;
    
    private String description;
    
    private String defaultValue;
    
    private String validationRules;
    
    private Boolean isActive;
    
    private LocalDateTime createdAt;
    
    private LocalDateTime updatedAt;
    
    // Constructors
    public CustomFieldDto() {}
    
    public CustomFieldDto(UUID id, String name, String type, List<String> options, Boolean required, 
                         String category, Integer order, String description, String defaultValue, 
                         String validationRules, Boolean isActive, LocalDateTime createdAt, LocalDateTime updatedAt) {
        this.id = id;
        this.name = name;
        this.type = type;
        this.options = options;
        this.required = required;
        this.category = category;
        this.order = order;
        this.description = description;
        this.defaultValue = defaultValue;
        this.validationRules = validationRules;
        this.isActive = isActive;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }
    
    // Static factory method to create DTO from entity
    public static CustomFieldDto fromEntity(CustomField entity) {
        CustomFieldDto dto = new CustomFieldDto();
        dto.setId(entity.getId());
        dto.setName(entity.getName());
        dto.setType(entity.getType().getValue());
        dto.setRequired(entity.getRequired());
        dto.setCategory(entity.getCategory());
        dto.setOrder(entity.getOrder());
        dto.setDescription(entity.getDescription());
        dto.setDefaultValue(entity.getDefaultValue());
        dto.setValidationRules(entity.getValidationRules());
        dto.setIsActive(entity.getIsActive());
        dto.setCreatedAt(entity.getCreatedAt());
        dto.setUpdatedAt(entity.getUpdatedAt());
        
        // Parse options JSON string to List<String>
        if (entity.getOptions() != null && !entity.getOptions().trim().isEmpty()) {
            try {
                // Simple JSON parsing for options array
                String optionsStr = entity.getOptions().trim();
                if (optionsStr.startsWith("[") && optionsStr.endsWith("]")) {
                    optionsStr = optionsStr.substring(1, optionsStr.length() - 1);
                    if (!optionsStr.trim().isEmpty()) {
                        String[] optionArray = optionsStr.split(",");
                        dto.setOptions(List.of(optionArray));
                    }
                }
            } catch (Exception e) {
                // If parsing fails, set empty list
                dto.setOptions(List.of());
            }
        }
        
        return dto;
    }
    
    // Method to convert DTO to entity
    public CustomField toEntity() {
        CustomField entity = new CustomField();
        entity.setId(this.id);
        entity.setName(this.name);
        entity.setType(CustomField.FieldType.fromValue(this.type));
        entity.setRequired(this.required);
        entity.setCategory(this.category);
        entity.setOrder(this.order);
        entity.setDescription(this.description);
        entity.setDefaultValue(this.defaultValue);
        entity.setValidationRules(this.validationRules);
        entity.setIsActive(this.isActive);
        
        // Convert options List to JSON string
        if (this.options != null && !this.options.isEmpty()) {
            entity.setOptions("[" + String.join(",", this.options) + "]");
        }
        
        return entity;
    }
    
    // Getters and Setters
    public UUID getId() {
        return id;
    }
    
    public void setId(UUID id) {
        this.id = id;
    }
    
    public String getName() {
        return name;
    }
    
    public void setName(String name) {
        this.name = name;
    }
    
    public String getType() {
        return type;
    }
    
    public void setType(String type) {
        this.type = type;
    }
    
    public List<String> getOptions() {
        return options;
    }
    
    public void setOptions(List<String> options) {
        this.options = options;
    }
    
    public Boolean getRequired() {
        return required;
    }
    
    public void setRequired(Boolean required) {
        this.required = required;
    }
    
    public String getCategory() {
        return category;
    }
    
    public void setCategory(String category) {
        this.category = category;
    }
    
    public Integer getOrder() {
        return order;
    }
    
    public void setOrder(Integer order) {
        this.order = order;
    }
    
    public String getDescription() {
        return description;
    }
    
    public void setDescription(String description) {
        this.description = description;
    }
    
    public String getDefaultValue() {
        return defaultValue;
    }
    
    public void setDefaultValue(String defaultValue) {
        this.defaultValue = defaultValue;
    }
    
    public String getValidationRules() {
        return validationRules;
    }
    
    public void setValidationRules(String validationRules) {
        this.validationRules = validationRules;
    }
    
    public Boolean getIsActive() {
        return isActive;
    }
    
    public void setIsActive(Boolean isActive) {
        this.isActive = isActive;
    }
    
    public LocalDateTime getCreatedAt() {
        return createdAt;
    }
    
    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
    
    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }
    
    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }
}
