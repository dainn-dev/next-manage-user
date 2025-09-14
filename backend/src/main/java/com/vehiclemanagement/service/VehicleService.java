package com.vehiclemanagement.service;

import com.vehiclemanagement.dto.VehicleDto;
import com.vehiclemanagement.dto.VehicleCreateResponse;
import com.vehiclemanagement.entity.Employee;
import com.vehiclemanagement.entity.Vehicle;
import com.vehiclemanagement.exception.ResourceNotFoundException;
import com.vehiclemanagement.repository.EmployeeRepository;
import com.vehiclemanagement.repository.VehicleRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@Transactional
public class VehicleService {
    
    @Autowired
    private VehicleRepository vehicleRepository;
    
    @Autowired
    private EmployeeRepository employeeRepository;
    
    public List<VehicleDto> getAllVehicles() {
        return vehicleRepository.findAll().stream()
                .map(VehicleDto::new)
                .collect(Collectors.toList());
    }
    
    public Page<VehicleDto> getAllVehicles(Pageable pageable) {
        return vehicleRepository.findAll(pageable)
                .map(VehicleDto::new);
    }
    
    public VehicleDto getVehicleById(UUID id) {
        Vehicle vehicle = vehicleRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Vehicle not found with id: " + id));
        return new VehicleDto(vehicle);
    }
    
    public VehicleDto getVehicleByLicensePlate(String licensePlate) {
        Vehicle vehicle = vehicleRepository.findByLicensePlate(licensePlate)
                .orElseThrow(() -> new ResourceNotFoundException("Vehicle not found with license plate: " + licensePlate));
        return new VehicleDto(vehicle);
    }
    
    public List<VehicleDto> getVehiclesByEmployee(UUID employeeId) {
        Employee employee = employeeRepository.findById(employeeId)
                .orElseThrow(() -> new ResourceNotFoundException("Employee not found with id: " + employeeId));
        
        return vehicleRepository.findByEmployeeId(employeeId).stream()
                .map(VehicleDto::new)
                .collect(Collectors.toList());
    }
    
    public List<VehicleDto> getVehiclesByType(Vehicle.VehicleType vehicleType) {
        return vehicleRepository.findByVehicleType(vehicleType).stream()
                .map(VehicleDto::new)
                .collect(Collectors.toList());
    }
    
    public List<VehicleDto> getVehiclesByStatus(Vehicle.VehicleStatus status) {
        return vehicleRepository.findByStatus(status).stream()
                .map(VehicleDto::new)
                .collect(Collectors.toList());
    }
    
    public Page<VehicleDto> searchVehicles(String searchTerm, Pageable pageable) {
        return vehicleRepository.findBySearchTerm(searchTerm, pageable)
                .map(VehicleDto::new);
    }
    
    public Page<VehicleDto> searchVehiclesByType(Vehicle.VehicleType vehicleType, String searchTerm, Pageable pageable) {
        return vehicleRepository.findByVehicleTypeAndSearchTerm(vehicleType, searchTerm, pageable)
                .map(VehicleDto::new);
    }
    
    public Page<VehicleDto> searchVehiclesByStatus(Vehicle.VehicleStatus status, String searchTerm, Pageable pageable) {
        return vehicleRepository.findByStatusAndSearchTerm(status, searchTerm, pageable)
                .map(VehicleDto::new);
    }
    
    public VehicleCreateResponse createVehicle(VehicleDto vehicleDto) {
        // Check if vehicle with this license plate already exists
        if (vehicleRepository.existsByLicensePlate(vehicleDto.getLicensePlate())) {
            Vehicle existingVehicle = vehicleRepository.findByLicensePlate(vehicleDto.getLicensePlate())
                    .orElseThrow(() -> new ResourceNotFoundException("Vehicle not found with license plate: " + vehicleDto.getLicensePlate()));
            return new VehicleCreateResponse(
                new VehicleDto(existingVehicle), 
                true, 
                "Không tạo được xe " + vehicleDto.getLicensePlate() + ", vì đã tồn tại trong hệ thống"
            );
        }
        
        Employee employee = employeeRepository.findById(vehicleDto.getEmployeeId())
                .orElseThrow(() -> new ResourceNotFoundException("Employee not found with id: " + vehicleDto.getEmployeeId()));
        
        Vehicle vehicle = new Vehicle();
        vehicle.setEmployee(employee);
        vehicle.setLicensePlate(vehicleDto.getLicensePlate());
        vehicle.setVehicleType(vehicleDto.getVehicleType());
        vehicle.setBrand(vehicleDto.getBrand());
        vehicle.setModel(vehicleDto.getModel());
        vehicle.setColor(vehicleDto.getColor());
        vehicle.setYear(vehicleDto.getYear());
        vehicle.setRegistrationDate(vehicleDto.getRegistrationDate());
        vehicle.setExpiryDate(vehicleDto.getExpiryDate());
        vehicle.setStatus(vehicleDto.getStatus() != null ? vehicleDto.getStatus() : Vehicle.VehicleStatus.active);
        vehicle.setFuelType(vehicleDto.getFuelType());
        vehicle.setCapacity(vehicleDto.getCapacity());
        vehicle.setNotes(vehicleDto.getNotes());
        
        Vehicle savedVehicle = vehicleRepository.save(vehicle);
        return new VehicleCreateResponse(
            new VehicleDto(savedVehicle), 
            false, 
            "Xe đã được tạo thành công"
        );
    }
    
    public VehicleDto updateVehicle(UUID id, VehicleDto vehicleDto) {
        Vehicle existingVehicle = vehicleRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Vehicle not found with id: " + id));
        
        Employee employee = employeeRepository.findById(vehicleDto.getEmployeeId())
                .orElseThrow(() -> new ResourceNotFoundException("Employee not found with id: " + vehicleDto.getEmployeeId()));
        
        existingVehicle.setEmployee(employee);
        existingVehicle.setLicensePlate(vehicleDto.getLicensePlate());
        existingVehicle.setVehicleType(vehicleDto.getVehicleType());
        existingVehicle.setBrand(vehicleDto.getBrand());
        existingVehicle.setModel(vehicleDto.getModel());
        existingVehicle.setColor(vehicleDto.getColor());
        existingVehicle.setYear(vehicleDto.getYear());
        existingVehicle.setRegistrationDate(vehicleDto.getRegistrationDate());
        existingVehicle.setExpiryDate(vehicleDto.getExpiryDate());
        existingVehicle.setStatus(vehicleDto.getStatus());
        existingVehicle.setFuelType(vehicleDto.getFuelType());
        existingVehicle.setCapacity(vehicleDto.getCapacity());
        existingVehicle.setNotes(vehicleDto.getNotes());
        
        Vehicle updatedVehicle = vehicleRepository.save(existingVehicle);
        return new VehicleDto(updatedVehicle);
    }
    
    public void deleteVehicle(UUID id) {
        Vehicle vehicle = vehicleRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Vehicle not found with id: " + id));
        vehicleRepository.delete(vehicle);
    }
    
    public boolean existsByLicensePlate(String licensePlate) {
        return vehicleRepository.existsByLicensePlate(licensePlate);
    }
    
    public long getVehicleCountByStatus(Vehicle.VehicleStatus status) {
        return vehicleRepository.countByStatus(status);
    }
    
    public List<Object[]> getVehicleCountByType() {
        return vehicleRepository.countByVehicleType();
    }
    
    public List<Object[]> getVehicleCountByFuelType() {
        return vehicleRepository.countByFuelType();
    }
}
