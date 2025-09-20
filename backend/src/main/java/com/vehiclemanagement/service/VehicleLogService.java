package com.vehiclemanagement.service;

import com.vehiclemanagement.dto.VehicleLogDto;
import com.vehiclemanagement.entity.Employee;
import com.vehiclemanagement.entity.Vehicle;
import com.vehiclemanagement.entity.VehicleLog;
import com.vehiclemanagement.repository.EmployeeRepository;
import com.vehiclemanagement.repository.VehicleLogRepository;
import com.vehiclemanagement.repository.VehicleRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
@Transactional
public class VehicleLogService {
    
    @Autowired
    private VehicleLogRepository vehicleLogRepository;
    
    @Autowired
    private VehicleRepository vehicleRepository;
    
    @Autowired
    private EmployeeRepository employeeRepository;
    
    public Page<VehicleLogDto> getAllVehicleLogs(Pageable pageable) {
        Page<VehicleLog> logs = vehicleLogRepository.findAll(pageable);
        return logs.map(this::convertToDto);
    }
    
    public List<VehicleLogDto> getAllVehicleLogsList() {
        List<VehicleLog> logs = vehicleLogRepository.findAll();
        return logs.stream().map(this::convertToDto).toList();
    }
    
    public VehicleLogDto getVehicleLogById(UUID id) {
        VehicleLog log = vehicleLogRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Vehicle log not found with id: " + id));
        return convertToDto(log);
    }
    
    public Page<VehicleLogDto> getVehicleLogsByDateRange(LocalDateTime startDate, LocalDateTime endDate, Pageable pageable) {
        Page<VehicleLog> logs = vehicleLogRepository.findByEntryExitTimeBetween(startDate, endDate, pageable);
        return logs.map(this::convertToDto);
    }
    
    public Page<VehicleLogDto> getTodayLogs(Pageable pageable) {
        LocalDate today = LocalDate.now();
        Page<VehicleLog> logs = vehicleLogRepository.findByDate(today, pageable);
        return logs.map(this::convertToDto);
    }
    
    public Page<VehicleLogDto> getWeeklyLogs(Pageable pageable) {
        LocalDate today = LocalDate.now();
        LocalDate startOfWeek = today.minusDays(today.getDayOfWeek().getValue() - 1);
        LocalDateTime startDateTime = startOfWeek.atStartOfDay();
        LocalDateTime endDateTime = today.atTime(LocalTime.MAX);
        
        return getVehicleLogsByDateRange(startDateTime, endDateTime, pageable);
    }
    
    public Page<VehicleLogDto> getMonthlyLogs(Pageable pageable) {
        LocalDate today = LocalDate.now();
        LocalDate startOfMonth = today.withDayOfMonth(1);
        LocalDateTime startDateTime = startOfMonth.atStartOfDay();
        LocalDateTime endDateTime = today.atTime(LocalTime.MAX);
        
        return getVehicleLogsByDateRange(startDateTime, endDateTime, pageable);
    }
    
    public Page<VehicleLogDto> searchVehicleLogs(String licensePlate, 
                                                VehicleLog.LogType type,
                                                VehicleLog.VehicleCategory vehicleType,
                                                String driverName,
                                                LocalDateTime startDate,
                                                LocalDateTime endDate,
                                                Pageable pageable) {
        Page<VehicleLog> logs = vehicleLogRepository.findWithFilters(
                licensePlate, type, vehicleType, driverName, startDate, endDate, pageable);
        return logs.map(this::convertToDto);
    }
    
    public VehicleLogDto createVehicleLog(VehicleLogDto vehicleLogDto) {
        VehicleLog vehicleLog = convertToEntity(vehicleLogDto);
        
        // Try to find and associate vehicle by license plate using normalized search
        Optional<Vehicle> vehicle = vehicleRepository.findByLicensePlateNormalized(vehicleLogDto.getLicensePlateNumber());
        if (vehicle.isPresent()) {
            vehicleLog.setVehicle(vehicle.get());
            vehicleLog.setEmployee(vehicle.get().getEmployee());
        }
        
        // Associate security guard if provided
        if (vehicleLogDto.getSecurityGuardId() != null) {
            Optional<Employee> securityGuard = employeeRepository.findById(vehicleLogDto.getSecurityGuardId());
            securityGuard.ifPresent(vehicleLog::setSecurityGuard);
        }
        
        VehicleLog savedLog = vehicleLogRepository.save(vehicleLog);
        return convertToDto(savedLog);
    }
    
    public VehicleLogDto updateVehicleLog(UUID id, VehicleLogDto vehicleLogDto) {
        VehicleLog existingLog = vehicleLogRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Vehicle log not found with id: " + id));
        
        // Update fields
        existingLog.setLicensePlateNumber(vehicleLogDto.getLicensePlateNumber());
        existingLog.setEntryExitTime(vehicleLogDto.getEntryExitTime());
        existingLog.setType(vehicleLogDto.getType());
        existingLog.setVehicleType(vehicleLogDto.getVehicleType());
        existingLog.setDriverName(vehicleLogDto.getDriverName());
        existingLog.setPurpose(vehicleLogDto.getPurpose());
        existingLog.setGateLocation(vehicleLogDto.getGateLocation());
        existingLog.setNotes(vehicleLogDto.getNotes());
        existingLog.setImagePath(vehicleLogDto.getImagePath());
        
        // Update vehicle association if license plate changed using normalized search
        Optional<Vehicle> vehicle = vehicleRepository.findByLicensePlateNormalized(vehicleLogDto.getLicensePlateNumber());
        if (vehicle.isPresent()) {
            existingLog.setVehicle(vehicle.get());
            existingLog.setEmployee(vehicle.get().getEmployee());
        } else {
            existingLog.setVehicle(null);
            existingLog.setEmployee(null);
        }
        
        // Update security guard
        if (vehicleLogDto.getSecurityGuardId() != null) {
            Optional<Employee> securityGuard = employeeRepository.findById(vehicleLogDto.getSecurityGuardId());
            securityGuard.ifPresent(existingLog::setSecurityGuard);
        } else {
            existingLog.setSecurityGuard(null);
        }
        
        VehicleLog savedLog = vehicleLogRepository.save(existingLog);
        return convertToDto(savedLog);
    }
    
    public void deleteVehicleLog(UUID id) {
        if (!vehicleLogRepository.existsById(id)) {
            throw new RuntimeException("Vehicle log not found with id: " + id);
        }
        vehicleLogRepository.deleteById(id);
    }
    
    // Statistics methods
    public long getTodayEntryCount() {
        return vehicleLogRepository.countByTypeAndDate(VehicleLog.LogType.entry, LocalDate.now());
    }
    
    public long getTodayExitCount() {
        return vehicleLogRepository.countByTypeAndDate(VehicleLog.LogType.exit, LocalDate.now());
    }
    
    public long getTodayUniqueVehicles() {
        return vehicleLogRepository.countDistinctVehiclesByDate(LocalDate.now());
    }
    
    private VehicleLogDto convertToDto(VehicleLog vehicleLog) {
        VehicleLogDto dto = VehicleLogDto.builder()
                .id(vehicleLog.getId())
                .licensePlateNumber(vehicleLog.getLicensePlateNumber())
                .vehicleId(vehicleLog.getVehicle() != null ? vehicleLog.getVehicle().getId() : null)
                .employeeId(vehicleLog.getEmployee() != null ? vehicleLog.getEmployee().getId() : null)
                .employeeName(vehicleLog.getEmployee() != null ? vehicleLog.getEmployee().getName() : null)
                .employeeAvatar(vehicleLog.getEmployee() != null ? vehicleLog.getEmployee().getAvatar() : null)
                .employeeDepartment(vehicleLog.getEmployee() != null ? vehicleLog.getEmployee().getDepartment() : null)
                .employeePosition(vehicleLog.getEmployee() != null ? vehicleLog.getEmployee().getPosition() : null)
                .entryExitTime(vehicleLog.getEntryExitTime())
                .type(vehicleLog.getType())
                .vehicleType(vehicleLog.getVehicleType())
                .driverName(vehicleLog.getDriverName())
                .purpose(vehicleLog.getPurpose())
                .gateLocation(vehicleLog.getGateLocation())
                .securityGuardId(vehicleLog.getSecurityGuard() != null ? vehicleLog.getSecurityGuard().getId() : null)
                .securityGuardName(vehicleLog.getSecurityGuard() != null ? vehicleLog.getSecurityGuard().getName() : null)
                .notes(vehicleLog.getNotes())
                .imagePath(vehicleLog.getImagePath())
                .createdAt(vehicleLog.getCreatedAt())
                .updatedAt(vehicleLog.getUpdatedAt())
                .build();
        
        // Add vehicle details if available
        if (vehicleLog.getVehicle() != null) {
            dto.setVehicleBrand(vehicleLog.getVehicle().getBrand());
            dto.setVehicleModel(vehicleLog.getVehicle().getModel());
            dto.setVehicleColor(vehicleLog.getVehicle().getColor());
        }
        
        return dto;
    }
    
    public Object getEmployeeInfoByLicensePlate(String licensePlateNumber, VehicleLog.LogType type) {
        // Find the vehicle by license plate using normalized search
        Optional<Vehicle> vehicleOpt = vehicleRepository.findByLicensePlateNormalized(licensePlateNumber);
        
        if (vehicleOpt.isEmpty()) {
            throw new RuntimeException("Vehicle not found with license plate: " + licensePlateNumber);
        }
        
        Vehicle vehicle = vehicleOpt.get();
        
        // Get the employee who owns this vehicle
        Employee employee = vehicle.getEmployee();
        
        if (employee == null) {
            throw new RuntimeException("No employee found for vehicle: " + licensePlateNumber);
        }

        // Find the latest log entry for this vehicle and type using normalized license plate search
        List<VehicleLog> logs = vehicleLogRepository
                .findByLicensePlateNumberNormalizedAndTypeOrderByEntryExitTimeDesc(licensePlateNumber, type);
        
        VehicleLog latestLog = logs.isEmpty() ? null : logs.get(0);
        
        // Create response object
        return new Object() {
            public final String employeeId = employee.getEmployeeId();
            public final String employeeName = employee.getName();
            public final String firstName = employee.getFirstName();
            public final String lastName = employee.getLastName();
            public final String department = employee.getDepartment();
            public final String position = employee.getPosition();
            public final String rank = employee.getRank();
            public final String jobTitle = employee.getJobTitle();
            public final String militaryCivilian = employee.getMilitaryCivilian();
            public final String phone = employee.getPhone();
            public final String email = employee.getEmail();
            public final String location = employee.getLocation();
            public final String avatar = employee.getAvatar();
            
            // Vehicle information
            public final String vehicleId = vehicle.getId().toString();
            public final String licensePlateNumber = vehicle.getLicensePlate();
            public final String brand = vehicle.getBrand();
            public final String model = vehicle.getModel();
            public final String color = vehicle.getColor();
            public final String vehicleType = vehicle.getVehicleType() != null ? vehicle.getVehicleType().name() : null;
            public final Integer year = vehicle.getYear();
            public final String registrationDate = vehicle.getRegistrationDate() != null ? vehicle.getRegistrationDate().toString() : null;
            public final String expiryDate = vehicle.getExpiryDate() != null ? vehicle.getExpiryDate().toString() : null;
            
            // Latest log information
            public final String logId = latestLog != null ? latestLog.getId().toString() : null;
            public final String logType = latestLog != null ? latestLog.getType().name() : type.name();
            public final String logTime = latestLog != null ? latestLog.getEntryExitTime().toString() : null;
            public final String driverName = latestLog != null ? latestLog.getDriverName() : null;
            public final String purpose = latestLog != null ? latestLog.getPurpose() : null;
            public final String gateLocation = latestLog != null ? latestLog.getGateLocation() : null;
            public final String notes = latestLog != null ? latestLog.getNotes() : null;
            public final String vehicleImagePath = vehicle.getImagePath();
        };
    }

    private VehicleLog convertToEntity(VehicleLogDto dto) {
        return VehicleLog.builder()
                .id(dto.getId())
                .licensePlateNumber(dto.getLicensePlateNumber())
                .entryExitTime(dto.getEntryExitTime())
                .type(dto.getType())
                .vehicleType(dto.getVehicleType())
                .driverName(dto.getDriverName())
                .purpose(dto.getPurpose())
                .gateLocation(dto.getGateLocation())
                .notes(dto.getNotes())
                .imagePath(dto.getImagePath())
                .createdAt(dto.getCreatedAt())
                .updatedAt(dto.getUpdatedAt())
                .build();
    }
}
