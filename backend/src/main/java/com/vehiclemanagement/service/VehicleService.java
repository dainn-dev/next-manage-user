package com.vehiclemanagement.service;

import com.vehiclemanagement.dto.VehicleDto;
import com.vehiclemanagement.dto.VehicleCreateResponse;
import com.vehiclemanagement.dto.VehicleCheckResponse;
import com.vehiclemanagement.dto.VehicleStatisticsDto;
import com.vehiclemanagement.dto.VehicleLogDto;
import com.vehiclemanagement.entity.Employee;
import com.vehiclemanagement.entity.Vehicle;
import com.vehiclemanagement.entity.VehicleLog;
// import com.vehiclemanagement.entity.EntryExitRequest; // Removed
import com.vehiclemanagement.exception.ResourceNotFoundException;
import com.vehiclemanagement.repository.EmployeeRepository;
import com.vehiclemanagement.repository.VehicleRepository;
// import com.vehiclemanagement.repository.EntryExitRequestRepository; // Removed
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.WeekFields;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
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
    private VehicleLogService vehicleLogService;
    
    @Autowired
    private WebSocketService webSocketService;
    
    // @Autowired
    // private EntryExitRequestRepository entryExitRequestRepository; // Removed
    
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
        Vehicle vehicle = vehicleRepository.findByLicensePlateNormalized(licensePlate)
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
        // Check if vehicle with this license plate already exists (using normalized comparison)
        if (vehicleRepository.existsByLicensePlateNormalized(vehicleDto.getLicensePlate())) {
            Vehicle existingVehicle = vehicleRepository.findByLicensePlateNormalized(vehicleDto.getLicensePlate())
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
        vehicle.setStatus(vehicleDto.getStatus() != null ? vehicleDto.getStatus() : Vehicle.VehicleStatus.approved);
        vehicle.setFuelType(vehicleDto.getFuelType());
        vehicle.setCapacity(vehicleDto.getCapacity());
        vehicle.setNotes(vehicleDto.getNotes());
        vehicle.setImagePath(vehicleDto.getImagePath());
        
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
        existingVehicle.setImagePath(vehicleDto.getImagePath());
        
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
        // List<EntryExitRequest> requests = entryExitRequestRepository.findAll(); // Removed
        List<Object> requests = new ArrayList<>(); // Empty list for compatibility
        
        // Basic vehicle stats
        long totalVehicles = vehicles.size();
        long approvedVehicles = vehicles.stream().filter(v -> v.getStatus() == Vehicle.VehicleStatus.approved).count();
        long rejectedVehicles = vehicles.stream().filter(v -> v.getStatus() == Vehicle.VehicleStatus.rejected).count();
        long exitedVehicles = vehicles.stream().filter(v -> v.getStatus() == Vehicle.VehicleStatus.exited).count();
        long enteredVehicles = vehicles.stream().filter(v -> v.getStatus() == Vehicle.VehicleStatus.entered).count();
        
        // Vehicle type stats
        Map<String, Long> vehicleTypeStats = vehicles.stream()
                .filter(v -> v.getVehicleType() != null)
                .collect(Collectors.groupingBy(v -> v.getVehicleType().toString(), Collectors.counting()));
        
        // Fuel type stats
        Map<String, Long> fuelTypeStats = vehicles.stream()
                .filter(v -> v.getFuelType() != null)
                .collect(Collectors.groupingBy(v -> v.getFuelType().toString(), Collectors.counting()));
        
        // Entry/Exit stats - Removed, using empty stats
        // VehicleStatisticsDto.EntryExitStatsDto entryExitStats = new VehicleStatisticsDto.EntryExitStatsDto(...); // Removed
        
        // Generate empty time-based stats (entry/exit requests removed)
        List<VehicleStatisticsDto.VehicleDailyStatsDto> dailyStats = new ArrayList<>();
        List<VehicleStatisticsDto.VehicleWeeklyStatsDto> weeklyStats = new ArrayList<>();
        List<VehicleStatisticsDto.VehicleMonthlyStatsDto> monthlyStats = new ArrayList<>();
        
        return new VehicleStatisticsDto(
                totalVehicles, approvedVehicles, rejectedVehicles, exitedVehicles, enteredVehicles,
                vehicleTypeStats, fuelTypeStats, dailyStats, weeklyStats, monthlyStats
        );
    }
    
    /* Removed - EntryExitRequest methods
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
    */ // End of removed EntryExitRequest methods
    
    /**
     * Upload vehicle image and update image path
     */
    @Transactional
    public String uploadVehicleImage(UUID vehicleId, MultipartFile imageFile) {
        try {
            System.out.println("=== Vehicle Image Upload ===");
            System.out.println("Vehicle ID: " + vehicleId);
            System.out.println("File name: " + imageFile.getOriginalFilename());
            System.out.println("File size: " + imageFile.getSize());
            System.out.println("Content type: " + imageFile.getContentType());
            
            // Find the vehicle
            Vehicle vehicle = vehicleRepository.findById(vehicleId)
                    .orElseThrow(() -> new ResourceNotFoundException("Vehicle not found with id: " + vehicleId));
            
            // Validate file
            if (imageFile.isEmpty()) {
                throw new IllegalArgumentException("Image file is empty");
            }
            
            // Check file type
            String contentType = imageFile.getContentType();
            if (contentType == null || !contentType.startsWith("image/")) {
                throw new IllegalArgumentException("File must be an image. Content type: " + contentType);
            }
            
            // Generate unique filename
            String originalFilename = imageFile.getOriginalFilename();
            String fileExtension = originalFilename != null && originalFilename.contains(".") 
                    ? originalFilename.substring(originalFilename.lastIndexOf("."))
                    : ".jpg";
            String filename = "vehicle_" + vehicleId + "_" + System.currentTimeMillis() + fileExtension;
            
            System.out.println("Generated filename: " + filename);
            
            // Create upload directory if it doesn't exist
            Path uploadDir = Paths.get("uploads", "vehicles");
            System.out.println("Upload directory: " + uploadDir.toAbsolutePath());
            
            if (!Files.exists(uploadDir)) {
                System.out.println("Creating upload directory...");
                Files.createDirectories(uploadDir);
            }
            
            // Save file
            Path filePath = uploadDir.resolve(filename);
            System.out.println("Full file path: " + filePath.toAbsolutePath());
            
            Files.copy(imageFile.getInputStream(), filePath, StandardCopyOption.REPLACE_EXISTING);
            System.out.println("File saved successfully");
            
            // Update vehicle with image path
            String imagePath = "/uploads/vehicles/" + filename;
            System.out.println("Setting image path on vehicle: " + imagePath);
            System.out.println("Transaction active: " + TransactionSynchronizationManager.isActualTransactionActive());
            
            vehicle.setImagePath(imagePath);
            Vehicle savedVehicle = vehicleRepository.save(vehicle);
            
            // Force flush to ensure database update
            vehicleRepository.flush();
            
            System.out.println("Vehicle saved and flushed. Current image path in DB: " + savedVehicle.getImagePath());
            System.out.println("Vehicle ID: " + savedVehicle.getId());
            System.out.println("=== Upload Complete ===");
            
            return imagePath;
            
        } catch (Exception e) {
            System.err.println("Error uploading vehicle image: " + e.getMessage());
            e.printStackTrace();
            throw new RuntimeException("Failed to upload vehicle image: " + e.getMessage(), e);
        }
    }
    
    /**
     * Normalize license plate by removing special characters and converting to uppercase
     */
    private String normalizeLicensePlate(String licensePlate) {
        if (licensePlate == null) {
            return null;
        }
        // Remove common special characters and convert to uppercase
        return licensePlate.replaceAll("[-._\\s]", "").toUpperCase();
    }
    
    /**
     * Check if a vehicle is approved for access based on license plate and update status
     */
    @Transactional
    public VehicleCheckResponse checkVehicleAccess(String licensePlateNumber, String type) {
        try {
            // Find vehicle by license plate with normalized search
            // This handles cases where license plates may have different formatting (e.g., "ABC-123" vs "ABC123")
            Vehicle vehicle = vehicleRepository.findByLicensePlateNormalized(licensePlateNumber)
                    .orElse(null);
            
            if (vehicle == null) {
                String notFoundMessage = "Xe với biển số " + licensePlateNumber + " chưa được đăng ký trong hệ thống";
                
                // Send WebSocket message for vehicle not found
                try {
                    webSocketService.sendVehicleCheckMessage(licensePlateNumber, type, notFoundMessage);
                } catch (Exception wsException) {
                    // Log WebSocket error but don't fail the response
                    System.err.println("Failed to send WebSocket message: " + wsException.getMessage());
                }
                
                return new VehicleCheckResponse(
                    false, 
                    notFoundMessage, 
                    licensePlateNumber, 
                    type
                );
            }
            
            // Check if vehicle status is approved or already in appropriate state for entry/exit
            boolean isApproved = vehicle.getStatus() == Vehicle.VehicleStatus.approved ||
                    ("entry".equalsIgnoreCase(type) && vehicle.getStatus() == Vehicle.VehicleStatus.exited) ||
                    ("exit".equalsIgnoreCase(type) && vehicle.getStatus() == Vehicle.VehicleStatus.entered);
            
            String message;
            if (isApproved) {
                // Update vehicle status based on type
                if ("entry".equalsIgnoreCase(type)) {
                    vehicle.setStatus(Vehicle.VehicleStatus.entered);
                    vehicleRepository.save(vehicle);
                    message = "Xe biển số " + licensePlateNumber + " được phép vào";
                } else if ("exit".equalsIgnoreCase(type)) {
                    vehicle.setStatus(Vehicle.VehicleStatus.exited);
                    vehicleRepository.save(vehicle);
                    message = "Xe biển số " + licensePlateNumber + " được phép ra";
                } else {
                    message = "Xe biển số " + licensePlateNumber + " được phép ra vào";
                }
                
                // Create vehicle log entry for approved access
                createVehicleLogEntry(vehicle, type);
                
                // Get employee info and send to WebSocket
                try {
                    VehicleLog.LogType logType = "entry".equalsIgnoreCase(type) ? VehicleLog.LogType.entry : VehicleLog.LogType.exit;
                    Object monitorInfo = vehicleLogService.getEmployeeInfoByLicensePlate(licensePlateNumber, logType);
                    webSocketService.sendVehicleCheckMessage(monitorInfo);
                } catch (Exception e) {
                    // Fallback to simple message if employee info fails
                    webSocketService.sendVehicleCheckMessage(licensePlateNumber, type, message);
                }
                
            } else {
                String statusText = getStatusText(vehicle.getStatus()) =="Entered" ? "đã vào" : "đã ra";
                message = "Xe biển số " + licensePlateNumber + " không được phép ra vào (Trạng thái: " + statusText + ")";
                
                // Send WebSocket message for denied access
                webSocketService.sendVehicleCheckMessage(licensePlateNumber, type, message);
            }
            
            return new VehicleCheckResponse(
                isApproved,
                message,
                licensePlateNumber,
                type
            );
            
        } catch (Exception e) {
            String errorMessage = "Lỗi kiểm tra xe: " + e.getMessage();
            
            // Send WebSocket message for error
            try {
                webSocketService.sendVehicleCheckMessage(licensePlateNumber, type, errorMessage);
            } catch (Exception wsException) {
                // Log WebSocket error but don't fail the response
                System.err.println("Failed to send WebSocket message: " + wsException.getMessage());
            }
            
            return new VehicleCheckResponse(
                false,
                errorMessage,
                licensePlateNumber,
                type
            );
        }
    }
    
    /**
     * Create a vehicle log entry for access events
     */
    private void createVehicleLogEntry(Vehicle vehicle, String type) {
        try {
            VehicleLogDto logDto = VehicleLogDto.builder()
                    .licensePlateNumber(vehicle.getLicensePlate())
                    .vehicleId(vehicle.getId())
                    .employeeId(vehicle.getEmployee().getId())
                    .entryExitTime(LocalDateTime.now())
                    .type("entry".equalsIgnoreCase(type) ? VehicleLog.LogType.entry : VehicleLog.LogType.exit)
                    .vehicleType(VehicleLog.VehicleCategory.internal) // Assuming internal vehicles since they're registered
                    .driverName(vehicle.getEmployee().getName())
                    .purpose("Truy cập xe tự động")
                    .gateLocation("Main Gate") // Default gate location, could be parameterized later
                    .notes("Auto-generated log entry from vehicle access check")
                    .createdAt(LocalDateTime.now())
                    .build();
            
            vehicleLogService.createVehicleLog(logDto);
            
        } catch (Exception e) {
            // Log the error but don't fail the vehicle check process
            System.err.println("Failed to create vehicle log entry: " + e.getMessage());
        }
    }
    
    /**
     * Get status text for vehicle status
     */
    private String getStatusText(Vehicle.VehicleStatus status) {
        switch (status) {
            case approved:
                return "Approved";
            case rejected:
                return "Rejected";
            case exited:
                return "Exited";
            case entered:
                return "Entered";
            default:
                return status.toString();
        }
    }
}
