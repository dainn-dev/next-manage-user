package com.vehiclemanagement.service;

import com.vehiclemanagement.dto.EntryExitRequestDto;
import com.vehiclemanagement.entity.Employee;
import com.vehiclemanagement.entity.EntryExitRequest;
import com.vehiclemanagement.entity.Vehicle;
import com.vehiclemanagement.exception.ResourceNotFoundException;
import com.vehiclemanagement.repository.EmployeeRepository;
import com.vehiclemanagement.repository.EntryExitRequestRepository;
import com.vehiclemanagement.repository.VehicleRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@Transactional
public class EntryExitRequestService {
    
    @Autowired
    private EntryExitRequestRepository requestRepository;
    
    @Autowired
    private EmployeeRepository employeeRepository;
    
    @Autowired
    private VehicleRepository vehicleRepository;
    
    public List<EntryExitRequestDto> getAllRequests() {
        return requestRepository.findAll().stream()
                .map(EntryExitRequestDto::new)
                .collect(Collectors.toList());
    }
    
    public Page<EntryExitRequestDto> getAllRequests(Pageable pageable) {
        return requestRepository.findAll(pageable)
                .map(EntryExitRequestDto::new);
    }
    
    public EntryExitRequestDto getRequestById(UUID id) {
        EntryExitRequest request = requestRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Request not found with id: " + id));
        return new EntryExitRequestDto(request);
    }
    
    public List<EntryExitRequestDto> getRequestsByEmployee(UUID employeeId) {
        Employee employee = employeeRepository.findById(employeeId)
                .orElseThrow(() -> new ResourceNotFoundException("Employee not found with id: " + employeeId));
        
        return requestRepository.findByEmployeeId(employeeId).stream()
                .map(EntryExitRequestDto::new)
                .collect(Collectors.toList());
    }
    
    public List<EntryExitRequestDto> getRequestsByVehicle(UUID vehicleId) {
        Vehicle vehicle = vehicleRepository.findById(vehicleId)
                .orElseThrow(() -> new ResourceNotFoundException("Vehicle not found with id: " + vehicleId));
        
        return requestRepository.findByVehicleId(vehicleId).stream()
                .map(EntryExitRequestDto::new)
                .collect(Collectors.toList());
    }
    
    public List<EntryExitRequestDto> getRequestsByType(EntryExitRequest.RequestType requestType) {
        return requestRepository.findByRequestType(requestType).stream()
                .map(EntryExitRequestDto::new)
                .collect(Collectors.toList());
    }
    
    public List<EntryExitRequestDto> getRequestsByStatus(EntryExitRequest.RequestStatus status) {
        return requestRepository.findByStatus(status).stream()
                .map(EntryExitRequestDto::new)
                .collect(Collectors.toList());
    }
    
    public Page<EntryExitRequestDto> searchRequests(String searchTerm, Pageable pageable) {
        return requestRepository.findBySearchTerm(searchTerm, pageable)
                .map(EntryExitRequestDto::new);
    }
    
    public Page<EntryExitRequestDto> searchRequestsByType(EntryExitRequest.RequestType requestType, String searchTerm, Pageable pageable) {
        return requestRepository.findByRequestTypeAndSearchTerm(requestType, searchTerm, pageable)
                .map(EntryExitRequestDto::new);
    }
    
    public Page<EntryExitRequestDto> searchRequestsByStatus(EntryExitRequest.RequestStatus status, String searchTerm, Pageable pageable) {
        return requestRepository.findByStatusAndSearchTerm(status, searchTerm, pageable)
                .map(EntryExitRequestDto::new);
    }
    
    public List<EntryExitRequestDto> getRequestsByDateRange(LocalDateTime startDate, LocalDateTime endDate) {
        return requestRepository.findByDateRange(startDate, endDate).stream()
                .map(EntryExitRequestDto::new)
                .collect(Collectors.toList());
    }
    
    public List<EntryExitRequestDto> getRequestsByEmployeeAndDateRange(UUID employeeId, LocalDateTime startDate, LocalDateTime endDate) {
        Employee employee = employeeRepository.findById(employeeId)
                .orElseThrow(() -> new ResourceNotFoundException("Employee not found with id: " + employeeId));
        
        return requestRepository.findByEmployeeAndDateRange(employeeId, startDate, endDate).stream()
                .map(EntryExitRequestDto::new)
                .collect(Collectors.toList());
    }
    
    public List<EntryExitRequestDto> getRequestsByVehicleAndDateRange(UUID vehicleId, LocalDateTime startDate, LocalDateTime endDate) {
        Vehicle vehicle = vehicleRepository.findById(vehicleId)
                .orElseThrow(() -> new ResourceNotFoundException("Vehicle not found with id: " + vehicleId));
        
        return requestRepository.findByVehicleAndDateRange(vehicleId, startDate, endDate).stream()
                .map(EntryExitRequestDto::new)
                .collect(Collectors.toList());
    }
    
    public EntryExitRequestDto createRequest(EntryExitRequestDto requestDto) {
        Employee employee = employeeRepository.findById(requestDto.getEmployeeId())
                .orElseThrow(() -> new ResourceNotFoundException("Employee not found with id: " + requestDto.getEmployeeId()));
        
        Vehicle vehicle = vehicleRepository.findById(requestDto.getVehicleId())
                .orElseThrow(() -> new ResourceNotFoundException("Vehicle not found with id: " + requestDto.getVehicleId()));
        
        EntryExitRequest request = new EntryExitRequest();
        request.setEmployee(employee);
        request.setVehicle(vehicle);
        request.setRequestType(requestDto.getRequestType());
        request.setRequestTime(requestDto.getRequestTime() != null ? requestDto.getRequestTime() : LocalDateTime.now());
        request.setStatus(requestDto.getStatus() != null ? requestDto.getStatus() : EntryExitRequest.RequestStatus.pending);
        request.setNotes(requestDto.getNotes());
        
        EntryExitRequest savedRequest = requestRepository.save(request);
        return new EntryExitRequestDto(savedRequest);
    }
    
    public EntryExitRequestDto updateRequest(UUID id, EntryExitRequestDto requestDto) {
        EntryExitRequest existingRequest = requestRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Request not found with id: " + id));
        
        Employee employee = employeeRepository.findById(requestDto.getEmployeeId())
                .orElseThrow(() -> new ResourceNotFoundException("Employee not found with id: " + requestDto.getEmployeeId()));
        
        Vehicle vehicle = vehicleRepository.findById(requestDto.getVehicleId())
                .orElseThrow(() -> new ResourceNotFoundException("Vehicle not found with id: " + requestDto.getVehicleId()));
        
        existingRequest.setEmployee(employee);
        existingRequest.setVehicle(vehicle);
        existingRequest.setRequestType(requestDto.getRequestType());
        existingRequest.setRequestTime(requestDto.getRequestTime());
        existingRequest.setNotes(requestDto.getNotes());
        
        EntryExitRequest updatedRequest = requestRepository.save(existingRequest);
        return new EntryExitRequestDto(updatedRequest);
    }
    
    public EntryExitRequestDto approveRequest(UUID id, String approvedBy) {
        EntryExitRequest request = requestRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Request not found with id: " + id));
        
        request.approve(approvedBy);
        EntryExitRequest updatedRequest = requestRepository.save(request);
        return new EntryExitRequestDto(updatedRequest);
    }
    
    public EntryExitRequestDto rejectRequest(UUID id, String approvedBy) {
        EntryExitRequest request = requestRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Request not found with id: " + id));
        
        request.reject(approvedBy);
        EntryExitRequest updatedRequest = requestRepository.save(request);
        return new EntryExitRequestDto(updatedRequest);
    }
    
    public void deleteRequest(UUID id) {
        EntryExitRequest request = requestRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Request not found with id: " + id));
        requestRepository.delete(request);
    }
    
    public long getRequestCountByStatus(EntryExitRequest.RequestStatus status) {
        return requestRepository.countByStatus(status);
    }
    
    public long getRequestCountByType(EntryExitRequest.RequestType requestType) {
        return requestRepository.countByRequestType(requestType);
    }
    
    public long getUniqueVehicleCountInDateRange(LocalDateTime startDate, LocalDateTime endDate) {
        return requestRepository.countUniqueVehiclesInDateRange(startDate, endDate);
    }
    
    public List<Object[]> getDailyStats(LocalDateTime startDate, LocalDateTime endDate) {
        return requestRepository.getDailyStats(startDate, endDate);
    }
}
