package com.vehiclemanagement.service;

import com.vehiclemanagement.dto.VehicleDto;
import com.vehiclemanagement.dto.VehicleCreateResponse;
import com.vehiclemanagement.dto.VehicleStatisticsDto;
import com.vehiclemanagement.entity.Employee;
import com.vehiclemanagement.entity.Vehicle;
import com.vehiclemanagement.entity.EntryExitRequest;
import com.vehiclemanagement.exception.ResourceNotFoundException;
import com.vehiclemanagement.repository.EmployeeRepository;
import com.vehiclemanagement.repository.VehicleRepository;
import com.vehiclemanagement.repository.EntryExitRequestRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.temporal.WeekFields;
import java.util.*;
import java.util.stream.Collectors;

@Service
@Transactional
public class VehicleService {
    
    @Autowired
    private VehicleRepository vehicleRepository;
    
    @Autowired
    private EmployeeRepository employeeRepository;
    
    @Autowired
    private EntryExitRequestRepository entryExitRequestRepository;
    
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
    
    public VehicleStatisticsDto getVehicleStatistics() {
        List<Vehicle> vehicles = vehicleRepository.findAll();
        List<EntryExitRequest> requests = entryExitRequestRepository.findAll();
        
        // Basic vehicle stats
        long totalVehicles = vehicles.size();
        long activeVehicles = vehicles.stream().filter(v -> v.getStatus() == Vehicle.VehicleStatus.active).count();
        long inactiveVehicles = vehicles.stream().filter(v -> v.getStatus() == Vehicle.VehicleStatus.inactive).count();
        long maintenanceVehicles = vehicles.stream().filter(v -> v.getStatus() == Vehicle.VehicleStatus.maintenance).count();
        long retiredVehicles = vehicles.stream().filter(v -> v.getStatus() == Vehicle.VehicleStatus.retired).count();
        
        // Vehicle type stats
        Map<String, Long> vehicleTypeStats = vehicles.stream()
                .filter(v -> v.getVehicleType() != null)
                .collect(Collectors.groupingBy(v -> v.getVehicleType().toString(), Collectors.counting()));
        
        // Fuel type stats
        Map<String, Long> fuelTypeStats = vehicles.stream()
                .filter(v -> v.getFuelType() != null)
                .collect(Collectors.groupingBy(v -> v.getFuelType().toString(), Collectors.counting()));
        
        // Entry/Exit stats
        VehicleStatisticsDto.EntryExitStatsDto entryExitStats = new VehicleStatisticsDto.EntryExitStatsDto(
                requests.size(),
                requests.stream().filter(r -> r.getStatus() == EntryExitRequest.RequestStatus.approved).count(),
                requests.stream().filter(r -> r.getStatus() == EntryExitRequest.RequestStatus.pending).count(),
                requests.stream().filter(r -> r.getStatus() == EntryExitRequest.RequestStatus.rejected).count(),
                requests.stream().filter(r -> r.getRequestType() == EntryExitRequest.RequestType.entry).count(),
                requests.stream().filter(r -> r.getRequestType() == EntryExitRequest.RequestType.exit).count()
        );
        
        // Generate time-based stats
        List<VehicleStatisticsDto.VehicleDailyStatsDto> dailyStats = generateDailyStats(requests);
        List<VehicleStatisticsDto.VehicleWeeklyStatsDto> weeklyStats = generateWeeklyStats(requests);
        List<VehicleStatisticsDto.VehicleMonthlyStatsDto> monthlyStats = generateMonthlyStats(requests);
        
        return new VehicleStatisticsDto(
                totalVehicles, activeVehicles, inactiveVehicles, maintenanceVehicles, retiredVehicles,
                vehicleTypeStats, fuelTypeStats, entryExitStats, dailyStats, weeklyStats, monthlyStats
        );
    }
    
    private List<VehicleStatisticsDto.VehicleDailyStatsDto> generateDailyStats(List<EntryExitRequest> requests) {
        Map<LocalDate, VehicleStatisticsDto.VehicleDailyStatsDto> dailyMap = new HashMap<>();
        Map<LocalDate, Set<String>> uniqueVehiclesPerDay = new HashMap<>();
        
        for (EntryExitRequest request : requests) {
            LocalDate date = request.getRequestTime().toLocalDate();
            
            dailyMap.computeIfAbsent(date, d -> new VehicleStatisticsDto.VehicleDailyStatsDto(
                    d, 0, 0, 0, 0, 0, 0, 0
            ));
            uniqueVehiclesPerDay.computeIfAbsent(date, d -> new HashSet<>());
            
            VehicleStatisticsDto.VehicleDailyStatsDto dayStats = dailyMap.get(date);
            uniqueVehiclesPerDay.get(date).add(request.getVehicle().getId().toString());
            
            dayStats.setTotalRequests(dayStats.getTotalRequests() + 1);
            if (request.getRequestType() == EntryExitRequest.RequestType.entry) {
                dayStats.setEntryCount(dayStats.getEntryCount() + 1);
            } else {
                dayStats.setExitCount(dayStats.getExitCount() + 1);
            }
            
            switch (request.getStatus()) {
                case approved:
                    dayStats.setApprovedCount(dayStats.getApprovedCount() + 1);
                    break;
                case pending:
                    dayStats.setPendingCount(dayStats.getPendingCount() + 1);
                    break;
                case rejected:
                    dayStats.setRejectedCount(dayStats.getRejectedCount() + 1);
                    break;
            }
        }
        
        // Set unique vehicles count
        dailyMap.forEach((date, stats) -> {
            stats.setUniqueVehicles(uniqueVehiclesPerDay.get(date).size());
        });
        
        return dailyMap.values().stream()
                .sorted(Comparator.comparing(VehicleStatisticsDto.VehicleDailyStatsDto::getDate))
                .collect(Collectors.toList());
    }
    
    private List<VehicleStatisticsDto.VehicleWeeklyStatsDto> generateWeeklyStats(List<EntryExitRequest> requests) {
        Map<String, VehicleStatisticsDto.VehicleWeeklyStatsDto> weeklyMap = new HashMap<>();
        Map<String, Set<String>> uniqueVehiclesPerWeek = new HashMap<>();
        
        WeekFields weekFields = WeekFields.of(Locale.getDefault());
        
        for (EntryExitRequest request : requests) {
            LocalDate requestDate = request.getRequestTime().toLocalDate();
            int week = requestDate.get(weekFields.weekOfYear());
            int year = requestDate.getYear();
            String weekKey = year + "-W" + week;
            
            // Calculate start and end dates of the week
            LocalDate startDate = requestDate.with(weekFields.dayOfWeek(), 1);
            LocalDate endDate = startDate.plusDays(6);
            
            weeklyMap.computeIfAbsent(weekKey, k -> new VehicleStatisticsDto.VehicleWeeklyStatsDto(
                    week, startDate, endDate, 0, 0, 0, 0, 0, 0, 0
            ));
            uniqueVehiclesPerWeek.computeIfAbsent(weekKey, k -> new HashSet<>());
            
            VehicleStatisticsDto.VehicleWeeklyStatsDto weekStats = weeklyMap.get(weekKey);
            uniqueVehiclesPerWeek.get(weekKey).add(request.getVehicle().getId().toString());
            
            weekStats.setTotalRequests(weekStats.getTotalRequests() + 1);
            if (request.getRequestType() == EntryExitRequest.RequestType.entry) {
                weekStats.setEntryCount(weekStats.getEntryCount() + 1);
            } else {
                weekStats.setExitCount(weekStats.getExitCount() + 1);
            }
            
            switch (request.getStatus()) {
                case approved:
                    weekStats.setApprovedCount(weekStats.getApprovedCount() + 1);
                    break;
                case pending:
                    weekStats.setPendingCount(weekStats.getPendingCount() + 1);
                    break;
                case rejected:
                    weekStats.setRejectedCount(weekStats.getRejectedCount() + 1);
                    break;
            }
        }
        
        // Set unique vehicles count
        weeklyMap.forEach((weekKey, stats) -> {
            stats.setUniqueVehicles(uniqueVehiclesPerWeek.get(weekKey).size());
        });
        
        return weeklyMap.values().stream()
                .sorted(Comparator.comparing(VehicleStatisticsDto.VehicleWeeklyStatsDto::getStartDate))
                .collect(Collectors.toList());
    }
    
    private List<VehicleStatisticsDto.VehicleMonthlyStatsDto> generateMonthlyStats(List<EntryExitRequest> requests) {
        Map<String, VehicleStatisticsDto.VehicleMonthlyStatsDto> monthlyMap = new HashMap<>();
        Map<String, Set<String>> uniqueVehiclesPerMonth = new HashMap<>();
        
        for (EntryExitRequest request : requests) {
            LocalDate requestDate = request.getRequestTime().toLocalDate();
            int month = requestDate.getMonthValue();
            int year = requestDate.getYear();
            String monthKey = year + "-" + month;
            
            monthlyMap.computeIfAbsent(monthKey, k -> new VehicleStatisticsDto.VehicleMonthlyStatsDto(
                    month, year, 0, 0, 0, 0, 0, 0, 0
            ));
            uniqueVehiclesPerMonth.computeIfAbsent(monthKey, k -> new HashSet<>());
            
            VehicleStatisticsDto.VehicleMonthlyStatsDto monthStats = monthlyMap.get(monthKey);
            uniqueVehiclesPerMonth.get(monthKey).add(request.getVehicle().getId().toString());
            
            monthStats.setTotalRequests(monthStats.getTotalRequests() + 1);
            if (request.getRequestType() == EntryExitRequest.RequestType.entry) {
                monthStats.setEntryCount(monthStats.getEntryCount() + 1);
            } else {
                monthStats.setExitCount(monthStats.getExitCount() + 1);
            }
            
            switch (request.getStatus()) {
                case approved:
                    monthStats.setApprovedCount(monthStats.getApprovedCount() + 1);
                    break;
                case pending:
                    monthStats.setPendingCount(monthStats.getPendingCount() + 1);
                    break;
                case rejected:
                    monthStats.setRejectedCount(monthStats.getRejectedCount() + 1);
                    break;
            }
        }
        
        // Set unique vehicles count
        monthlyMap.forEach((monthKey, stats) -> {
            stats.setUniqueVehicles(uniqueVehiclesPerMonth.get(monthKey).size());
        });
        
        return monthlyMap.values().stream()
                .sorted(Comparator.comparing(VehicleStatisticsDto.VehicleMonthlyStatsDto::getYear)
                        .thenComparing(VehicleStatisticsDto.VehicleMonthlyStatsDto::getMonth))
                .collect(Collectors.toList());
    }
}
