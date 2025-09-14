package com.vehiclemanagement.controller;

import com.vehiclemanagement.dto.CustomFieldDto;
import com.vehiclemanagement.entity.CustomField;
import com.vehiclemanagement.service.CustomFieldService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/custom-fields")
@Tag(name = "Custom Fields Management", description = "APIs for managing custom fields")
@CrossOrigin(origins = "*")
public class CustomFieldController {
    
    @Autowired
    private CustomFieldService customFieldService;
    
    @GetMapping
    @Operation(summary = "Get all custom fields", description = "Retrieve all custom fields with optional pagination and sorting")
    public ResponseEntity<Page<CustomFieldDto>> getAllCustomFields(
            @Parameter(description = "Page number (0-based)") @RequestParam(defaultValue = "0") int page,
            @Parameter(description = "Page size") @RequestParam(defaultValue = "10") int size,
            @Parameter(description = "Sort field") @RequestParam(defaultValue = "order") String sortBy,
            @Parameter(description = "Sort direction") @RequestParam(defaultValue = "asc") String sortDir) {
        
        Page<CustomFieldDto> fields = customFieldService.getAllCustomFields(page, size, sortBy, sortDir);
        return ResponseEntity.ok(fields);
    }
    
    @GetMapping("/list")
    @Operation(summary = "Get all custom fields as list", description = "Retrieve all custom fields without pagination")
    public ResponseEntity<List<CustomFieldDto>> getAllCustomFieldsList() {
        List<CustomFieldDto> fields = customFieldService.getAllCustomFields();
        return ResponseEntity.ok(fields);
    }
    
    @GetMapping("/active")
    @Operation(summary = "Get all active custom fields", description = "Retrieve all active custom fields")
    public ResponseEntity<List<CustomFieldDto>> getAllActiveCustomFields() {
        List<CustomFieldDto> fields = customFieldService.getAllActiveCustomFields();
        return ResponseEntity.ok(fields);
    }
    
    @GetMapping("/active/paginated")
    @Operation(summary = "Get active custom fields with pagination", description = "Retrieve active custom fields with pagination")
    public ResponseEntity<Page<CustomFieldDto>> getActiveCustomFields(
            @Parameter(description = "Page number (0-based)") @RequestParam(defaultValue = "0") int page,
            @Parameter(description = "Page size") @RequestParam(defaultValue = "10") int size,
            @Parameter(description = "Sort field") @RequestParam(defaultValue = "order") String sortBy,
            @Parameter(description = "Sort direction") @RequestParam(defaultValue = "asc") String sortDir) {
        
        Page<CustomFieldDto> fields = customFieldService.getActiveCustomFields(page, size, sortBy, sortDir);
        return ResponseEntity.ok(fields);
    }
    
    @GetMapping("/{id}")
    @Operation(summary = "Get custom field by ID", description = "Retrieve a specific custom field by its ID")
    public ResponseEntity<CustomFieldDto> getCustomFieldById(@PathVariable UUID id) {
        CustomFieldDto field = customFieldService.getCustomFieldById(id);
        return ResponseEntity.ok(field);
    }
    
    @GetMapping("/category/{category}")
    @Operation(summary = "Get custom fields by category", description = "Retrieve all custom fields in a specific category")
    public ResponseEntity<List<CustomFieldDto>> getCustomFieldsByCategory(@PathVariable String category) {
        List<CustomFieldDto> fields = customFieldService.getCustomFieldsByCategory(category);
        return ResponseEntity.ok(fields);
    }
    
    @GetMapping("/category/{category}/active")
    @Operation(summary = "Get active custom fields by category", description = "Retrieve all active custom fields in a specific category")
    public ResponseEntity<List<CustomFieldDto>> getActiveCustomFieldsByCategory(@PathVariable String category) {
        List<CustomFieldDto> fields = customFieldService.getActiveCustomFieldsByCategory(category);
        return ResponseEntity.ok(fields);
    }
    
    @GetMapping("/type/{type}")
    @Operation(summary = "Get custom fields by type", description = "Retrieve all custom fields of a specific type")
    public ResponseEntity<List<CustomFieldDto>> getCustomFieldsByType(@PathVariable CustomField.FieldType type) {
        List<CustomFieldDto> fields = customFieldService.getCustomFieldsByType(type);
        return ResponseEntity.ok(fields);
    }
    
    @GetMapping("/type/{type}/active")
    @Operation(summary = "Get active custom fields by type", description = "Retrieve all active custom fields of a specific type")
    public ResponseEntity<List<CustomFieldDto>> getActiveCustomFieldsByType(@PathVariable CustomField.FieldType type) {
        List<CustomFieldDto> fields = customFieldService.getActiveCustomFieldsByType(type);
        return ResponseEntity.ok(fields);
    }
    
    @GetMapping("/required/{required}")
    @Operation(summary = "Get custom fields by required flag", description = "Retrieve all custom fields with a specific required flag")
    public ResponseEntity<List<CustomFieldDto>> getCustomFieldsByRequired(@PathVariable Boolean required) {
        List<CustomFieldDto> fields = customFieldService.getCustomFieldsByRequired(required);
        return ResponseEntity.ok(fields);
    }
    
    @GetMapping("/required/{required}/active")
    @Operation(summary = "Get active custom fields by required flag", description = "Retrieve all active custom fields with a specific required flag")
    public ResponseEntity<List<CustomFieldDto>> getActiveCustomFieldsByRequired(@PathVariable Boolean required) {
        List<CustomFieldDto> fields = customFieldService.getActiveCustomFieldsByRequired(required);
        return ResponseEntity.ok(fields);
    }
    
    @GetMapping("/search")
    @Operation(summary = "Search custom fields", description = "Search custom fields by name or category")
    public ResponseEntity<Page<CustomFieldDto>> searchCustomFields(
            @Parameter(description = "Search term") @RequestParam String searchTerm,
            @Parameter(description = "Page number (0-based)") @RequestParam(defaultValue = "0") int page,
            @Parameter(description = "Page size") @RequestParam(defaultValue = "10") int size,
            @Parameter(description = "Sort field") @RequestParam(defaultValue = "order") String sortBy,
            @Parameter(description = "Sort direction") @RequestParam(defaultValue = "asc") String sortDir) {
        
        Page<CustomFieldDto> fields = customFieldService.searchCustomFields(searchTerm, page, size, sortBy, sortDir);
        return ResponseEntity.ok(fields);
    }
    
    @PostMapping
    @Operation(summary = "Create a new custom field", description = "Create a new custom field record")
    public ResponseEntity<CustomFieldDto> createCustomField(@Valid @RequestBody CustomFieldDto customFieldDto) {
        CustomFieldDto createdField = customFieldService.createCustomField(customFieldDto);
        return new ResponseEntity<>(createdField, HttpStatus.CREATED);
    }
    
    @PutMapping("/{id}")
    @Operation(summary = "Update custom field", description = "Update an existing custom field")
    public ResponseEntity<CustomFieldDto> updateCustomField(@PathVariable UUID id, @Valid @RequestBody CustomFieldDto customFieldDto) {
        CustomFieldDto updatedField = customFieldService.updateCustomField(id, customFieldDto);
        return ResponseEntity.ok(updatedField);
    }
    
    @DeleteMapping("/{id}")
    @Operation(summary = "Delete custom field", description = "Delete a custom field by ID")
    public ResponseEntity<Void> deleteCustomField(@PathVariable UUID id) {
        customFieldService.deleteCustomField(id);
        return ResponseEntity.noContent().build();
    }
    
    @PatchMapping("/{id}/toggle-status")
    @Operation(summary = "Toggle custom field status", description = "Toggle the active status of a custom field")
    public ResponseEntity<CustomFieldDto> toggleCustomFieldStatus(@PathVariable UUID id) {
        CustomFieldDto updatedField = customFieldService.toggleCustomFieldStatus(id);
        return ResponseEntity.ok(updatedField);
    }
    
    @PutMapping("/reorder")
    @Operation(summary = "Reorder custom fields", description = "Reorder custom fields by providing a list of field IDs in the desired order")
    public ResponseEntity<List<CustomFieldDto>> reorderCustomFields(@RequestBody List<UUID> fieldIds) {
        List<CustomFieldDto> reorderedFields = customFieldService.reorderCustomFields(fieldIds);
        return ResponseEntity.ok(reorderedFields);
    }
    
    @GetMapping("/categories")
    @Operation(summary = "Get all categories", description = "Get all unique categories")
    public ResponseEntity<List<String>> getAllCategories() {
        List<String> categories = customFieldService.getAllCategories();
        return ResponseEntity.ok(categories);
    }
    
    @GetMapping("/categories/active")
    @Operation(summary = "Get active categories", description = "Get all unique categories for active fields")
    public ResponseEntity<List<String>> getActiveCategories() {
        List<String> categories = customFieldService.getActiveCategories();
        return ResponseEntity.ok(categories);
    }
    
    @GetMapping("/stats/category")
    @Operation(summary = "Get statistics by category", description = "Get count of custom fields grouped by category")
    public ResponseEntity<List<Object[]>> getStatisticsByCategory() {
        List<Object[]> stats = customFieldService.getStatisticsByCategory();
        return ResponseEntity.ok(stats);
    }
    
    @GetMapping("/stats/category/active")
    @Operation(summary = "Get active statistics by category", description = "Get count of active custom fields grouped by category")
    public ResponseEntity<List<Object[]>> getActiveStatisticsByCategory() {
        List<Object[]> stats = customFieldService.getActiveStatisticsByCategory();
        return ResponseEntity.ok(stats);
    }
    
    @GetMapping("/stats/type")
    @Operation(summary = "Get statistics by type", description = "Get count of custom fields grouped by type")
    public ResponseEntity<List<Object[]>> getStatisticsByType() {
        List<Object[]> stats = customFieldService.getStatisticsByType();
        return ResponseEntity.ok(stats);
    }
    
    @GetMapping("/stats/type/active")
    @Operation(summary = "Get active statistics by type", description = "Get count of active custom fields grouped by type")
    public ResponseEntity<List<Object[]>> getActiveStatisticsByType() {
        List<Object[]> stats = customFieldService.getActiveStatisticsByType();
        return ResponseEntity.ok(stats);
    }
    
    @GetMapping("/exists/name/{name}")
    @Operation(summary = "Check if custom field name exists", description = "Check if a custom field with the given name already exists")
    public ResponseEntity<Boolean> existsByName(@PathVariable String name) {
        boolean exists = customFieldService.existsByName(name);
        return ResponseEntity.ok(exists);
    }
    
    @GetMapping("/exists/name/{name}/exclude/{id}")
    @Operation(summary = "Check if custom field name exists (excluding ID)", description = "Check if a custom field with the given name exists, excluding the specified ID")
    public ResponseEntity<Boolean> existsByNameAndIdNot(@PathVariable String name, @PathVariable UUID id) {
        boolean exists = customFieldService.existsByNameAndIdNot(name, id);
        return ResponseEntity.ok(exists);
    }
}
