package com.vehiclemanagement.service;

import com.vehiclemanagement.dto.PositionDto;
import com.vehiclemanagement.entity.Position;
import com.vehiclemanagement.exception.ResourceNotFoundException;
import com.vehiclemanagement.repository.PositionRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@Transactional
public class PositionService {
    
    @Autowired
    private PositionRepository positionRepository;
    
    /**
     * Get all positions
     */
    public List<PositionDto> getAllPositions() {
        List<Position> positions = positionRepository.findAll();
        return positions.stream()
                .map(this::convertToDto)
                .collect(Collectors.toList());
    }
    
    /**
     * Get all active positions ordered by display order
     */
    public List<PositionDto> getAllActivePositions() {
        List<Position> positions = positionRepository.findByIsActiveTrueOrderByDisplayOrderAsc();
        return positions.stream()
                .map(this::convertToDto)
                .collect(Collectors.toList());
    }
    
    /**
     * Get position by ID
     */
    public PositionDto getPositionById(UUID id) {
        Position position = positionRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Position not found with id: " + id));
        return convertToDto(position);
    }
    
    /**
     * Get position by name
     */
    public PositionDto getPositionByName(String name) {
        Position position = positionRepository.findByName(name)
                .orElseThrow(() -> new ResourceNotFoundException("Position not found with name: " + name));
        return convertToDto(position);
    }
    
    /**
     * Create new position
     */
    public PositionDto createPosition(PositionDto positionDto) {
        // Validate unique name
        if (positionRepository.existsByName(positionDto.getName())) {
            throw new IllegalArgumentException("Position name already exists: " + positionDto.getName());
        }
        
        // Validate parent exists (if provided)
        if (positionDto.getParentId() != null) {
            if (!positionRepository.existsById(positionDto.getParentId())) {
                throw new ResourceNotFoundException("Parent position not found with id: " + positionDto.getParentId());
            }
            
            // Check for circular reference
            if (isCircularReference(null, positionDto.getParentId())) {
                throw new IllegalArgumentException("Circular reference detected in position hierarchy");
            }
        }
        
        Position position = convertToEntity(positionDto);
        
        // Set display order if not provided
        if (position.getDisplayOrder() == null || position.getDisplayOrder() == 0) {
            Integer maxOrder = positionRepository.getMaxDisplayOrderByParent(position.getParentId());
            position.setDisplayOrder(maxOrder != null ? maxOrder + 1 : 1);
        }
        
        Position savedPosition = positionRepository.save(position);
        return convertToDto(savedPosition);
    }
    
    /**
     * Update position
     */
    public PositionDto updatePosition(UUID id, PositionDto positionDto) {
        Position existingPosition = positionRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Position not found with id: " + id));
        
        // Validate unique name (excluding current position)
        if (!existingPosition.getName().equals(positionDto.getName()) && 
            positionRepository.existsByNameAndIdNot(positionDto.getName(), id)) {
            throw new IllegalArgumentException("Position name already exists: " + positionDto.getName());
        }
        
        // Validate parent exists and no circular reference
        if (positionDto.getParentId() != null) {
            if (!positionRepository.existsById(positionDto.getParentId())) {
                throw new ResourceNotFoundException("Parent position not found with id: " + positionDto.getParentId());
            }
            
            if (isCircularReference(id, positionDto.getParentId())) {
                throw new IllegalArgumentException("Circular reference detected in position hierarchy");
            }
        }
        
        // Update fields
        existingPosition.setName(positionDto.getName());
        existingPosition.setDescription(positionDto.getDescription());
        existingPosition.setParentId(positionDto.getParentId());
        existingPosition.setLevel(positionDto.getLevel());
        existingPosition.setMinSalary(positionDto.getMinSalary());
        existingPosition.setMaxSalary(positionDto.getMaxSalary());
        existingPosition.setIsActive(positionDto.getIsActive());
        
        if (positionDto.getDisplayOrder() != null) {
            existingPosition.setDisplayOrder(positionDto.getDisplayOrder());
        }
        
        Position updatedPosition = positionRepository.save(existingPosition);
        return convertToDto(updatedPosition);
    }
    
    /**
     * Delete position
     */
    public void deletePosition(UUID id) {
        Position position = positionRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Position not found with id: " + id));
        
        // Check if position has child positions
        if (positionRepository.hasChildren(id)) {
            throw new IllegalStateException("Cannot delete position with child positions. Please delete or reassign child positions first.");
        }
        
        // TODO: Check if position is assigned to employees
        // This would require an EmployeeRepository method to check position assignments
        
        positionRepository.delete(position);
    }
    
    /**
     * Search positions
     */
    public Page<PositionDto> searchPositions(String searchTerm, Pageable pageable) {
        Page<Position> positions = positionRepository.findBySearchTerm(searchTerm, pageable);
        return positions.map(this::convertToDto);
    }
    
    /**
     * Get positions by level
     */
    public List<PositionDto> getPositionsByLevel(Position.PositionLevel level) {
        List<Position> positions = positionRepository.findByLevel(level);
        return positions.stream()
                .map(this::convertToDto)
                .collect(Collectors.toList());
    }
    
    /**
     * Get root positions (positions without parent)
     */
    public List<PositionDto> getRootPositions() {
        List<Position> positions = positionRepository.findRootPositions();
        return positions.stream()
                .map(this::convertToDto)
                .collect(Collectors.toList());
    }
    
    /**
     * Get child positions by parent ID
     */
    public List<PositionDto> getChildPositions(UUID parentId) {
        List<Position> positions = positionRepository.findByParentIdOrderByDisplayOrder(parentId);
        return positions.stream()
                .map(this::convertToDto)
                .collect(Collectors.toList());
    }
    
    /**
     * Get positions with filters
     */
    public Page<PositionDto> getPositionsWithFilters(Position.PositionLevel level, UUID parentId, Pageable pageable) {
        Page<Position> positions = positionRepository.findWithFilters(level, parentId, pageable);
        return positions.map(this::convertToDto);
    }
    
    /**
     * Get position statistics
     */
    public Map<String, Object> getPositionStatistics() {
        long totalPositions = positionRepository.count();
        long activePositions = positionRepository.countByIsActive(true);
        long inactivePositions = positionRepository.countByIsActive(false);
        long rootPositions = positionRepository.countRootPositions();
        
        // Get positions by level
        List<Object[]> levelCounts = positionRepository.countByLevelActive();
        Map<String, Long> positionsByLevel = new HashMap<>();
        for (Object[] row : levelCounts) {
            Position.PositionLevel level = (Position.PositionLevel) row[0];
            Long count = (Long) row[1];
            positionsByLevel.put(level.getDisplayName(), count);
        }
        
        Map<String, Object> stats = new HashMap<>();
        stats.put("totalPositions", totalPositions);
        stats.put("activePositions", activePositions);
        stats.put("inactivePositions", inactivePositions);
        stats.put("rootPositions", rootPositions);
        stats.put("positionsByLevel", positionsByLevel);
        
        return stats;
    }
    
    /**
     * Bulk delete positions
     */
    public void bulkDeletePositions(List<UUID> positionIds) {
        for (UUID id : positionIds) {
            deletePosition(id); // This will check for constraints
        }
    }
    
    /**
     * Move position to different parent
     */
    public PositionDto movePosition(UUID positionId, UUID newParentId) {
        Position position = positionRepository.findById(positionId)
                .orElseThrow(() -> new ResourceNotFoundException("Position not found with id: " + positionId));
        
        // Validate new parent exists (if provided)
        if (newParentId != null && !positionRepository.existsById(newParentId)) {
            throw new ResourceNotFoundException("Parent position not found with id: " + newParentId);
        }
        
        // Check for circular reference
        if (isCircularReference(positionId, newParentId)) {
            throw new IllegalArgumentException("Circular reference detected in position hierarchy");
        }
        
        position.setParentId(newParentId);
        Position updatedPosition = positionRepository.save(position);
        return convertToDto(updatedPosition);
    }
    
    /**
     * Check for circular reference in position hierarchy
     */
    private boolean isCircularReference(UUID positionId, UUID newParentId) {
        if (newParentId == null || positionId == null) {
            return false;
        }
        
        if (positionId.equals(newParentId)) {
            return true;
        }
        
        // Check if newParentId is a descendant of positionId
        return isDescendant(positionId, newParentId);
    }
    
    /**
     * Check if candidate is a descendant of ancestor
     */
    private boolean isDescendant(UUID ancestorId, UUID candidateId) {
        if (ancestorId == null || candidateId == null) {
            return false;
        }
        
        List<Position> children = positionRepository.findByParentId(ancestorId);
        for (Position child : children) {
            if (child.getId().equals(candidateId)) {
                return true;
            }
            if (isDescendant(child.getId(), candidateId)) {
                return true;
            }
        }
        return false;
    }
    
    /**
     * Convert Position entity to DTO
     */
    private PositionDto convertToDto(Position position) {
        PositionDto dto = new PositionDto();
        dto.setId(position.getId());
        dto.setName(position.getName());
        dto.setDescription(position.getDescription());
        dto.setParentId(position.getParentId());
        dto.setLevel(position.getLevel());
        dto.setMinSalary(position.getMinSalary());
        dto.setMaxSalary(position.getMaxSalary());
        dto.setIsActive(position.getIsActive());
        dto.setDisplayOrder(position.getDisplayOrder());
        dto.setCreatedAt(position.getCreatedAt());
        dto.setUpdatedAt(position.getUpdatedAt());
        
        // Set additional fields
        if (position.getLevel() != null) {
            dto.setLevelDisplayName(position.getLevel().getDisplayName());
        }
        
        // Set parent name if parent exists
        if (position.getParentId() != null) {
            positionRepository.findById(position.getParentId())
                    .ifPresent(parent -> dto.setParentName(parent.getName()));
        }
        
        // Set children count
        dto.setChildrenCount(positionRepository.countByParentId(position.getId()).intValue());
        
        return dto;
    }
    
    /**
     * Convert DTO to Position entity
     */
    private Position convertToEntity(PositionDto dto) {
        Position position = new Position();
        position.setName(dto.getName());
        position.setDescription(dto.getDescription());
        position.setParentId(dto.getParentId());
        position.setLevel(dto.getLevel());
        position.setMinSalary(dto.getMinSalary());
        position.setMaxSalary(dto.getMaxSalary());
        position.setIsActive(dto.getIsActive() != null ? dto.getIsActive() : true);
        position.setDisplayOrder(dto.getDisplayOrder() != null ? dto.getDisplayOrder() : 0);
        
        return position;
    }
}
