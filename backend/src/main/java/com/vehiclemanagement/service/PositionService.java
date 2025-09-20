package com.vehiclemanagement.service;

import com.vehiclemanagement.dto.PositionDto;
import com.vehiclemanagement.dto.PositionMenuDto;
import com.vehiclemanagement.entity.Position;
import com.vehiclemanagement.exception.ResourceNotFoundException;
import com.vehiclemanagement.repository.PositionRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.data.domain.PageImpl;

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
     * Get all positions with parent information - builds hierarchical structure
     */
    public List<PositionMenuDto> getAllPositionsWithParent() {
        // Get all root positions (positions without parent)
        List<Position> rootPositions = positionRepository.findRootPositions();
        
        // Convert to DTO and build hierarchy
        return rootPositions.stream()
                .map(this::buildPositionMenuHierarchy)
                .collect(Collectors.toList());
    }
    
    /**
     * Recursively build position menu hierarchy
     */
    private PositionMenuDto buildPositionMenuHierarchy(Position position) {
        PositionMenuDto menuDto = new PositionMenuDto(position);
        
        // Get children for this position
        List<Position> children = positionRepository.findByParentIdOrderByDisplayOrder(position.getId());
        
        // Recursively build children
        List<PositionMenuDto> childrenDtos = children.stream()
                .map(this::buildPositionMenuHierarchy)
                .collect(Collectors.toList());
        
        menuDto.setChildren(childrenDtos);
        menuDto.setChildrenCount(childrenDtos.size());
        
        return menuDto;
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
            Integer maxOrder;
            if (position.getParentId() == null) {
                maxOrder = positionRepository.getMaxDisplayOrderForRootPositions();
            } else {
                maxOrder = positionRepository.getMaxDisplayOrderByParentId(position.getParentId());
            }
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
        existingPosition.setIsActive(positionDto.getIsActive());
        existingPosition.setFilterBy(positionDto.getFilterBy() != null ? positionDto.getFilterBy() : Position.FilterType.N_A);
        
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
    public Page<PositionDto> getPositionsWithFilters(UUID parentId, boolean leafOnly, Pageable pageable) {
        Page<Position> positions;
        
        if (leafOnly) {
            if (parentId != null) {
                // Get all leaf positions recursively under the parent
                List<Position> allLeafPositions = getRecursiveLeafPositions(parentId);
                // Convert to Page manually for consistency with API
                int start = (int) pageable.getOffset();
                int end = Math.min((start + pageable.getPageSize()), allLeafPositions.size());
                List<Position> pageContent = start >= allLeafPositions.size() ? 
                    new ArrayList<>() : allLeafPositions.subList(start, end);
                positions = new PageImpl<>(pageContent, pageable, allLeafPositions.size());
            } else {
                positions = positionRepository.findLeafPositionsWithFilters(parentId, pageable);
            }
        } else {
            positions = positionRepository.findWithFilters(parentId, pageable);
        }
        
        return positions.map(this::convertToDto);
    }
    
    /**
     * Get all leaf positions recursively under a parent
     */
    private List<Position> getRecursiveLeafPositions(UUID parentId) {
        List<Position> allLeafPositions = new ArrayList<>();
        Set<UUID> visited = new HashSet<>();
        collectLeafPositionsRecursive(parentId, allLeafPositions, visited);
        return allLeafPositions;
    }
    
    /**
     * Recursively collect leaf positions under a parent
     */
    private void collectLeafPositionsRecursive(UUID parentId, List<Position> leafPositions, Set<UUID> visited) {
        if (parentId == null || visited.contains(parentId)) {
            return;
        }
        visited.add(parentId);
        
        // Get all direct children of this parent
        List<Position> children = positionRepository.findByParentIdOrderByDisplayOrder(parentId);
        
        for (Position child : children) {
            if (!child.getIsActive()) {
                continue;
            }
            
            // Check if this child has any active children
            boolean hasChildren = positionRepository.hasChildren(child.getId());
            
            if (!hasChildren) {
                // This is a leaf position, add it to the result
                leafPositions.add(child);
            } else {
                // This position has children, recurse into it
                collectLeafPositionsRecursive(child.getId(), leafPositions, visited);
            }
        }
    }
    
    /**
     * Get position statistics
     */
    public Map<String, Object> getPositionStatistics() {
        long totalPositions = positionRepository.count();
        long activePositions = positionRepository.countByIsActive(true);
        long inactivePositions = positionRepository.countByIsActive(false);
        long rootPositions = positionRepository.countRootPositions();
        
        // Get positions by parent (simplified statistics)
        Map<String, Long> positionsByParent = new HashMap<>();
        
        Map<String, Object> stats = new HashMap<>();
        stats.put("totalPositions", totalPositions);
        stats.put("activePositions", activePositions);
        stats.put("inactivePositions", inactivePositions);
        stats.put("rootPositions", rootPositions);
        stats.put("positionsByParent", positionsByParent);
        
        return stats;
    }
    
    /**
     * Bulk delete positions
     */
    public void bulkDeletePositions(List<UUID> positionIds) {
        List<String> errors = new ArrayList<>();
        List<UUID> successfulDeletes = new ArrayList<>();
        
        for (UUID id : positionIds) {
            try {
                // Check if position exists
                if (!positionRepository.existsById(id)) {
                    errors.add("Position with ID " + id + " not found");
                    continue;
                }
                
                // Check if position has children
                if (positionRepository.hasChildren(id)) {
                    errors.add("Cannot delete position with ID " + id + " - has child positions");
                    continue;
                }
                
                // Delete the position
                positionRepository.deleteById(id);
                successfulDeletes.add(id);
                
            } catch (Exception e) {
                errors.add("Failed to delete position with ID " + id + ": " + e.getMessage());
            }
        }
        
        // If there were errors but some successful deletes, log the errors but don't throw exception
        if (!errors.isEmpty()) {
            String errorMessage = "Some positions could not be deleted: " + String.join(", ", errors);
            if (successfulDeletes.isEmpty()) {
                // If no positions were deleted, throw exception
                throw new IllegalStateException(errorMessage);
            } else {
                // If some were deleted, just log the errors (partial success)
                System.out.println("Bulk delete completed with warnings: " + errorMessage);
            }
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
        dto.setIsActive(position.getIsActive());
        dto.setDisplayOrder(position.getDisplayOrder());
        dto.setFilterBy(position.getFilterBy());
        dto.setCreatedAt(position.getCreatedAt());
        dto.setUpdatedAt(position.getUpdatedAt());
        
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
     * Convert Position entity to DTO with detailed parent information
     */
    private PositionDto convertToDtoWithParent(Position position) {
        PositionDto dto = new PositionDto();
        dto.setId(position.getId());
        dto.setName(position.getName());
        dto.setDescription(position.getDescription());
        dto.setParentId(position.getParentId());
        dto.setIsActive(position.getIsActive());
        dto.setDisplayOrder(position.getDisplayOrder());
        dto.setFilterBy(position.getFilterBy());
        dto.setCreatedAt(position.getCreatedAt());
        dto.setUpdatedAt(position.getUpdatedAt());
        
        // Set detailed parent information if parent exists
        if (position.getParentId() != null) {
            positionRepository.findById(position.getParentId())
                    .ifPresent(parent -> {
                        dto.setParentName(parent.getName());
                        // You can add more parent details here if needed
                    });
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
        position.setIsActive(dto.getIsActive() != null ? dto.getIsActive() : true);
        position.setDisplayOrder(dto.getDisplayOrder() != null ? dto.getDisplayOrder() : 0);
        position.setFilterBy(dto.getFilterBy() != null ? dto.getFilterBy() : Position.FilterType.N_A);
        
        return position;
    }
    
    /**
     * Get positions by filterBy and parentId
     */
    public List<PositionDto> getPositionsByFilterAndParent(Position.FilterType filterBy, UUID parentId) {
        List<Position> positions;
        
        if (parentId != null) {
            positions = positionRepository.findByFilterByAndParentId(filterBy, parentId);
        } else {
            positions = positionRepository.findByFilterBy(filterBy);
        }
        
        return positions.stream()
                .map(this::convertToDto)
                .collect(Collectors.toList());
    }
    
    /**
     * Get positions with CHUC_VU filter and optional parentId
     */
    public List<PositionDto> getChucVuPositions(UUID parentId) {
        return getPositionsByFilterAndParent(Position.FilterType.CHUC_VU, parentId);
    }
    
    /**
     * Get all leaf positions (positions without children) across the entire system
     */
    public List<PositionDto> getAllLeafPositions() {
        List<Position> leafPositions = positionRepository.findAllLeafPositions();
        return leafPositions.stream()
                .map(this::convertToDto)
                .collect(Collectors.toList());
    }
}
