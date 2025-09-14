package com.vehiclemanagement.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "custom_fields")
public class CustomField {
    
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    
    @NotBlank(message = "Field name is required")
    @Column(name = "name", nullable = false)
    private String name;
    
    @NotNull(message = "Field type is required")
    @Enumerated(EnumType.STRING)
    @Column(name = "type", nullable = false)
    private FieldType type;
    
    @Column(name = "options", columnDefinition = "TEXT")
    private String options; // JSON string for select options
    
    @NotNull(message = "Required flag is required")
    @Column(name = "required", nullable = false)
    private Boolean required = false;
    
    @NotBlank(message = "Category is required")
    @Column(name = "category", nullable = false)
    private String category;
    
    @NotNull(message = "Order is required")
    @Column(name = "field_order", nullable = false)
    private Integer order;
    
    @Column(name = "description", columnDefinition = "TEXT")
    private String description;
    
    @Column(name = "default_value", columnDefinition = "TEXT")
    private String defaultValue;
    
    @Column(name = "validation_rules", columnDefinition = "TEXT")
    private String validationRules; // JSON string for validation rules
    
    @Column(name = "is_active", nullable = false)
    private Boolean isActive = true;
    
    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
    
    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
    
    // Constructors
    public CustomField() {}
    
    public CustomField(String name, FieldType type, String category, Integer order) {
        this.name = name;
        this.type = type;
        this.category = category;
        this.order = order;
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
    
    public FieldType getType() {
        return type;
    }
    
    public void setType(FieldType type) {
        this.type = type;
    }
    
    public String getOptions() {
        return options;
    }
    
    public void setOptions(String options) {
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
    
    // Enum for field types
    public enum FieldType {
        TEXT("text", "Văn bản"),
        NUMBER("number", "Số"),
        DATE("date", "Ngày"),
        SELECT("select", "Danh sách kéo"),
        CHECKBOX("checkbox", "Hộp kiểm"),
        TEXTAREA("textarea", "Văn bản dài");
        
        private final String value;
        private final String label;
        
        FieldType(String value, String label) {
            this.value = value;
            this.label = label;
        }
        
        public String getValue() {
            return value;
        }
        
        public String getLabel() {
            return label;
        }
        
        public static FieldType fromValue(String value) {
            for (FieldType type : FieldType.values()) {
                if (type.value.equals(value)) {
                    return type;
                }
            }
            throw new IllegalArgumentException("Unknown field type: " + value);
        }
    }
}
