package com.vehiclemanagement.service;

import com.vehiclemanagement.dto.VehicleDto;
import com.vehiclemanagement.dto.VehicleCreateResponse;
import com.vehiclemanagement.dto.VehicleCheckResponse;
import com.vehiclemanagement.dto.VehicleStatisticsDto;
import com.vehiclemanagement.dto.VehicleLogDto;
import com.vehiclemanagement.config.TenantContext;
import com.vehiclemanagement.entity.Gate;
import com.vehiclemanagement.entity.User;
import com.vehiclemanagement.entity.Vehicle;
import com.vehiclemanagement.entity.VehicleLog;
import com.vehiclemanagement.util.ImageProcessingUtil;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
// import com.vehiclemanagement.entity.EntryExitRequest; // Removed
import com.vehiclemanagement.exception.ResourceNotFoundException;
import com.vehiclemanagement.repository.GateRepository;
import com.vehiclemanagement.repository.UserRepository;
import com.vehiclemanagement.repository.VehicleRepository;
// import com.vehiclemanagement.repository.EntryExitRequestRepository; // Removed
import com.vehiclemanagement.security.SiteAccess;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.multipart.MultipartFile;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.nio.file.StandardOpenOption;
import java.util.*;
import java.util.stream.Collectors;

@Service
@Transactional
public class VehicleService {
    
    @Autowired
    private VehicleRepository vehicleRepository;
    
    @Autowired
    private UserRepository userRepository;

    @Autowired
    private GateRepository gateRepository;

    @Autowired
    private VehicleLogService vehicleLogService;
    
    @Autowired
    private WebSocketService webSocketService;
    
    @Autowired
    private ImageProcessingUtil imageProcessingUtil;

    @Autowired
    private SnapshotStorageService snapshotStorageService;

    @Autowired
    private VehicleAccessRequestService accessRequestService;

    @Autowired
    private MeterRegistry meterRegistry;

    @Autowired
    private SiteAccess siteAccess;

    @Autowired
    private MemberVehicleQueryService memberVehicleQueryService;

    @Autowired
    @org.springframework.context.annotation.Lazy
    private UserService userService;

    @Autowired
    private TenantVehicleRegistrationService tenantVehicleRegistrationService;

    /**
     * Window used to suppress duplicate gate-originated access requests for the same
     * plate + gate (Phase 4.4). The edge fires a check per detection frame, so a
     * short window keeps a single lingering vehicle from flooding the approval queue.
     */
    @org.springframework.beans.factory.annotation.Value("${gate.access-request.dedup-window-seconds:300}")
    private long accessRequestDedupWindowSeconds;

    /**
     * Meter names for the vehicle-access-check metrics (Phase 4.1). The counter is
     * named {@code vehicle_check}; the Prometheus registry appends the {@code _total}
     * suffix, so it is scraped as {@code vehicle_check_total{gate,result}}.
     */
    private static final String VEHICLE_CHECK = "vehicle_check";
    private static final String VEHICLE_CHECK_LATENCY = "vehicle_check_latency";

    // @Autowired
    // private EntryExitRequestRepository entryExitRequestRepository; // Removed
    
    public List<VehicleDto> getAllVehicles() {
        if (isMemberPrincipal()) {
            return memberOwnVehicles().stream().map(VehicleDto::new).collect(Collectors.toList());
        }
        return scopedVehicles(vehicleRepository.findAll()).stream()
                .map(VehicleDto::new)
                .collect(Collectors.toList());
    }
    
    public Page<VehicleDto> getAllVehicles(Pageable pageable) {
        if (isMemberPrincipal()) {
            return pageMemberVehicles(pageable);
        }
        if (!siteAccess.isRestricted()) {
            return vehicleRepository.findAll(pageable).map(VehicleDto::new);
        }
        Page<Vehicle> page = vehicleRepository.findByCurrentSiteIdIn(siteAccess.allowedSiteIds(), pageable);
        return page.map(VehicleDto::new);
    }
    
    public VehicleDto getVehicleById(UUID id) {
        if (isMemberPrincipal()) {
            return memberOwnVehicle(id);
        }
        Vehicle vehicle = vehicleRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Vehicle not found with id: " + id));
        assertVehicleVisible(vehicle);
        return new VehicleDto(vehicle);
    }
    
    public VehicleDto getVehicleByLicensePlate(String licensePlate) {
        if (isMemberPrincipal()) {
            return memberOwnVehicles().stream()
                    .filter(v -> licensePlateEqualsNormalized(v.getLicensePlate(), licensePlate))
                    .findFirst()
                    .map(VehicleDto::new)
                    .orElseThrow(() -> new ResourceNotFoundException(
                            "Vehicle not found with license plate: " + licensePlate));
        }
        Vehicle vehicle = vehicleRepository.findByLicensePlateNormalized(licensePlate)
                .orElseThrow(() -> new ResourceNotFoundException("Vehicle not found with license plate: " + licensePlate));
        assertVehicleVisible(vehicle);
        return new VehicleDto(vehicle);
    }
    
    public List<VehicleDto> getVehiclesByOwner(UUID ownerId) {
        if (isMemberPrincipal()) {
            User self = requireMemberPrincipal();
            if (!self.getId().equals(ownerId)) {
                throw new AccessDeniedException("MEMBER can only list their own vehicles");
            }
            return memberOwnVehicles().stream().map(VehicleDto::new).collect(Collectors.toList());
        }
        userRepository.findById(ownerId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + ownerId));

        return scopedVehicles(vehicleRepository.findByOwnerId(ownerId)).stream()
                .map(VehicleDto::new)
                .collect(Collectors.toList());
    }
    
    public List<VehicleDto> getVehiclesByType(Vehicle.VehicleType vehicleType) {
        if (isMemberPrincipal()) {
            return memberOwnVehicles().stream()
                    .filter(v -> v.getVehicleType() == vehicleType)
                    .map(VehicleDto::new)
                    .collect(Collectors.toList());
        }
        return scopedVehicles(vehicleRepository.findByVehicleType(vehicleType)).stream()
                .map(VehicleDto::new)
                .collect(Collectors.toList());
    }
    
    public List<VehicleDto> getVehiclesByStatus(Vehicle.VehicleStatus status) {
        if (isMemberPrincipal()) {
            return memberOwnVehicles().stream()
                    .filter(v -> v.getStatus() == status)
                    .map(VehicleDto::new)
                    .collect(Collectors.toList());
        }
        return scopedVehicles(vehicleRepository.findByStatus(status)).stream()
                .map(VehicleDto::new)
                .collect(Collectors.toList());
    }
    
    public Page<VehicleDto> searchVehicles(String searchTerm, Pageable pageable) {
        if (isMemberPrincipal()) {
            return pageMemberVehicles(filterMemberSearch(memberOwnVehicles(), searchTerm), pageable);
        }
        return filterPage(vehicleRepository.findBySearchTerm(searchTerm, pageable), pageable);
    }
    
    public Page<VehicleDto> searchVehiclesByType(Vehicle.VehicleType vehicleType, String searchTerm, Pageable pageable) {
        if (isMemberPrincipal()) {
            List<Vehicle> filtered = filterMemberSearch(memberOwnVehicles(), searchTerm).stream()
                    .filter(v -> v.getVehicleType() == vehicleType)
                    .collect(Collectors.toList());
            return pageMemberVehicles(filtered, pageable);
        }
        return filterPage(vehicleRepository.findByVehicleTypeAndSearchTerm(vehicleType, searchTerm, pageable), pageable);
    }
    
    public Page<VehicleDto> searchVehiclesByStatus(Vehicle.VehicleStatus status, String searchTerm, Pageable pageable) {
        if (isMemberPrincipal()) {
            List<Vehicle> filtered = filterMemberSearch(memberOwnVehicles(), searchTerm).stream()
                    .filter(v -> v.getStatus() == status)
                    .collect(Collectors.toList());
            return pageMemberVehicles(filtered, pageable);
        }
        return filterPage(vehicleRepository.findByStatusAndSearchTerm(status, searchTerm, pageable), pageable);
    }
    
    public VehicleCreateResponse createVehicle(VehicleDto vehicleDto) {
        resolveSiteForWrite(vehicleDto.getCurrentSiteId(), true);
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
        
        User owner = userRepository.findById(vehicleDto.getOwnerId())
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + vehicleDto.getOwnerId()));

        Vehicle vehicle = new Vehicle();
        vehicle.setOwner(owner);
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
        vehicle.setCurrentSiteId(vehicleDto.getCurrentSiteId());
        
        Vehicle savedVehicle = vehicleRepository.save(vehicle);
        tenantVehicleRegistrationService.ensureRegistrationForVehicle(
                savedVehicle.getId(), savedVehicle.getCurrentSiteId());
        return new VehicleCreateResponse(
            new VehicleDto(savedVehicle), 
            false, 
            "Xe đã được tạo thành công"
        );
    }
    
    public VehicleDto updateVehicle(UUID id, VehicleDto vehicleDto) {
        Vehicle existingVehicle = vehicleRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Vehicle not found with id: " + id));
        assertVehicleVisible(existingVehicle);
        
        User owner = userRepository.findById(vehicleDto.getOwnerId())
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + vehicleDto.getOwnerId()));

        if (vehicleDto.getCurrentSiteId() != null
                || !Objects.equals(existingVehicle.getCurrentSiteId(), vehicleDto.getCurrentSiteId())) {
            resolveSiteForWrite(vehicleDto.getCurrentSiteId(), false);
        }

        existingVehicle.setOwner(owner);
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
        if (vehicleDto.getCurrentSiteId() != null || !siteAccess.isRestricted()) {
            existingVehicle.setCurrentSiteId(vehicleDto.getCurrentSiteId());
        }
        
        Vehicle updatedVehicle = vehicleRepository.save(existingVehicle);
        return new VehicleDto(updatedVehicle);
    }
    
    public VehicleDto approveVehicle(UUID id) {
        Vehicle vehicle = vehicleRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Vehicle not found with id: " + id));
        assertVehicleVisible(vehicle);
        vehicle.setStatus(Vehicle.VehicleStatus.approved);
        return new VehicleDto(vehicleRepository.save(vehicle));
    }

    public VehicleDto rejectVehicle(UUID id) {
        Vehicle vehicle = vehicleRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Vehicle not found with id: " + id));
        assertVehicleVisible(vehicle);
        vehicle.setStatus(Vehicle.VehicleStatus.rejected);
        return new VehicleDto(vehicleRepository.save(vehicle));
    }

    public void deleteVehicle(UUID id) {
        Vehicle vehicle = vehicleRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Vehicle not found with id: " + id));
        assertVehicleVisible(vehicle);
        // ADR-0604: tenant removes plate from management; platform master stays.
        tenantVehicleRegistrationService.revoke(id);
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
        List<Vehicle> vehicles = scopedVehicles(vehicleRepository.findAll());

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

        // Log-based time series (daily/weekly/monthly)
        VehicleLogService.LogBasedStatistics logStats = vehicleLogService.getLogBasedStatistics();

        // Entry/Exit stats today: VehicleLog entries are only created on approved
        // gate access, so every logged request counts as approved. A request is
        // considered completed once the vehicle exits.
        long entryRequests = vehicleLogService.getTodayEntryCount();
        long exitRequests = vehicleLogService.getTodayExitCount();
        long totalRequests = entryRequests + exitRequests;
        VehicleStatisticsDto.EntryExitStatsDto entryExitStats = new VehicleStatisticsDto.EntryExitStatsDto(
                totalRequests,
                totalRequests, // approvedRequests
                0,             // pendingRequests
                exitRequests,  // completedRequests
                entryRequests,
                exitRequests
        );

        VehicleStatisticsDto dto = new VehicleStatisticsDto(
                totalVehicles, approvedVehicles, rejectedVehicles, exitedVehicles, enteredVehicles,
                vehicleTypeStats, fuelTypeStats,
                logStats.getDailyStats(), logStats.getWeeklyStats(), logStats.getMonthlyStats()
        );
        dto.setEntryExitStats(entryExitStats);
        return dto;
    }

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
            
            // Generate unique filename with correct extension
            // Always use .jpg since ImageProcessingUtil converts all images to JPG
            String filename = "vehicle_" + vehicleId + "_" + System.currentTimeMillis() + ".jpg";
            
            System.out.println("Generated filename: " + filename);
            
            // Create upload directory if it doesn't exist
            Path uploadDir = Paths.get("uploads", "vehicles");
            System.out.println("Upload directory: " + uploadDir.toAbsolutePath());
            
            if (!Files.exists(uploadDir)) {
                System.out.println("Creating upload directory...");
                Files.createDirectories(uploadDir);
            }
            
            // Process and save image (convert to JPG format)
            Path filePath = uploadDir.resolve(filename);
            System.out.println("Full file path: " + filePath.toAbsolutePath());
            
            // Process the image to ensure it's in JPG format and optimized
            byte[] processedImageData = imageProcessingUtil.processImage(imageFile);
            Files.write(filePath, processedImageData, StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING);
            System.out.println("Image processed and saved successfully as JPG");
            
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
        return checkVehicleAccess(licensePlateNumber, type, (UUID) null);
    }

    /**
     * Check if a vehicle is approved for access, optionally attributing the event
     * to the gate identified by {@code gateId}. When a gate is supplied the
     * created {@link VehicleLog} is tagged with it and every WebSocket event is
     * fanned out to the per-gate topic in addition to the global topic. A
     * {@code null} {@code gateId} preserves the original behaviour.
     */
    @Transactional
    public VehicleCheckResponse checkVehicleAccess(String licensePlateNumber, String type, UUID gateId) {
        return checkVehicleAccess(licensePlateNumber, type, gateId, null);
    }

    /**
     * Check if a vehicle is approved for access, optionally attaching an evidence
     * {@code snapshot} (Phase 4.2). When the check results in an approved access a
     * {@link VehicleLog} is created and, if a snapshot is present, it is stored and
     * linked via {@link VehicleLog#getImagePath()}. The snapshot is optional: a
     * {@code null}/empty one leaves the log image-less exactly as before, and a
     * storage failure never fails the check.
     */
    @Transactional
    public VehicleCheckResponse checkVehicleAccess(String licensePlateNumber, String type, UUID gateId,
                                                   MultipartFile snapshot) {
        Gate gate = resolveGate(gateId);
        // Time every check (approved / denied / not-found / error) and record it as
        // vehicle_check_latency; the per-outcome counters are bumped inside
        // performVehicleCheck where the result is known (Phase 4.1).
        Timer.Sample sample = Timer.start(meterRegistry);
        try {
            return performVehicleCheck(licensePlateNumber, type, gate, snapshot);
        } finally {
            sample.stop(Timer.builder(VEHICLE_CHECK_LATENCY)
                    .description("Latency of vehicle access checks, in seconds")
                    .register(meterRegistry));
        }
    }

    private VehicleCheckResponse performVehicleCheck(String licensePlateNumber, String type, Gate gate,
                                                     MultipartFile snapshot) {
        try {
            // Find vehicle by license plate with normalized search
            // This handles cases where license plates may have different formatting (e.g., "ABC-123" vs "ABC123")
            Vehicle vehicle = vehicleRepository.findByLicensePlateNormalized(licensePlateNumber)
                    .orElse(null);
            if (vehicle == null) {
                String notFoundMessage = "Xe với biển số " + licensePlateNumber + " chưa được đăng ký trong hệ thống";

                // Phase 4.4: an unregistered / unapproved plate is no longer a silent
                // denial at the gate. Capture evidence (best-effort), raise a PENDING
                // access request so it lands in the approval queue with an audit trail,
                // and tell the gate to wait for approval instead of opening. Neither
                // side effect may fail the check.
                String pendingMessage = notFoundMessage + " - chờ phê duyệt";
                String snapshotPath = null;
                try {
                    snapshotPath = snapshotStorageService.store(snapshot, licensePlateNumber);
                    accessRequestService.recordGateDetection(
                            licensePlateNumber, gate, snapshotPath,
                            Duration.ofSeconds(accessRequestDedupWindowSeconds));
                } catch (Exception reqException) {
                    System.err.println("Failed to record gate access request: " + reqException.getMessage());
                }

                // Send WebSocket message so the kiosk shows an awaiting-approval state.
                try {
                    webSocketService.sendVehicleCheckMessage(
                            licensePlateNumber, type, pendingMessage, gateId(gate), "pending");
                } catch (Exception wsException) {
                    // Log WebSocket error but don't fail the response
                    System.err.println("Failed to send WebSocket message: " + wsException.getMessage());
                }

                recordCheck(gate, "pending");
                VehicleCheckResponse pendingResponse = new VehicleCheckResponse(
                    false,
                    pendingMessage,
                    licensePlateNumber,
                    type,
                    snapshotPath
                );
                pendingResponse.setResult(VehicleCheckResponse.CheckResult.PENDING);
                return pendingResponse;
            }

            // ADR-0604: closed whitelist is tenant_vehicle_registration, not mere vehicle visibility.
            UUID checkTenant = TenantContext.getTenantId();
            if (checkTenant != null
                    && !tenantVehicleRegistrationService.isActivelyRegistered(vehicle.getId(), checkTenant)) {
                String notReg = "Xe biển số " + licensePlateNumber
                        + " chưa được đăng ký quản lý tại cơ sở này - chờ phê duyệt";
                String snapshotPath = null;
                try {
                    snapshotPath = snapshotStorageService.store(snapshot, licensePlateNumber);
                    accessRequestService.recordGateDetection(
                            licensePlateNumber, gate, snapshotPath,
                            Duration.ofSeconds(accessRequestDedupWindowSeconds));
                } catch (Exception reqException) {
                    System.err.println("Failed to record gate access request: " + reqException.getMessage());
                }
                try {
                    webSocketService.sendVehicleCheckMessage(
                            licensePlateNumber, type, notReg, gateId(gate), "pending");
                } catch (Exception wsException) {
                    System.err.println("Failed to send WebSocket message: " + wsException.getMessage());
                }
                recordCheck(gate, "pending");
                VehicleCheckResponse pendingResponse = new VehicleCheckResponse(
                        false, notReg, licensePlateNumber, type, snapshotPath);
                pendingResponse.setResult(VehicleCheckResponse.CheckResult.PENDING);
                return pendingResponse;
            }
            
            // Check if vehicle status is approved or already in appropriate state for entry/exit
            boolean isApproved = vehicle.getStatus() == Vehicle.VehicleStatus.approved ||
                    ("entry".equalsIgnoreCase(type) && vehicle.getStatus() == Vehicle.VehicleStatus.exited) ||
                    ("exit".equalsIgnoreCase(type) && vehicle.getStatus() == Vehicle.VehicleStatus.entered);
            
            String message;
            if (isApproved) {
                String ownerName = vehicle.getOwner() != null ? vehicle.getOwner().getFullName() : "Không xác định";

                if ("entry".equalsIgnoreCase(type)) {
                    vehicle.setStatus(Vehicle.VehicleStatus.entered);
                    if (gate != null && gate.getSiteId() != null) {
                        vehicle.setCurrentSiteId(gate.getSiteId());
                    }
                    vehicleRepository.save(vehicle);
                    message = "Xe biển số " + licensePlateNumber + " của " + ownerName + " được phép vào cổng";
                } else if ("exit".equalsIgnoreCase(type)) {
                    vehicle.setStatus(Vehicle.VehicleStatus.exited);
                    // Keep currentSiteId as last-known branch after exit.
                    if (gate != null && gate.getSiteId() != null && vehicle.getCurrentSiteId() == null) {
                        vehicle.setCurrentSiteId(gate.getSiteId());
                    }
                    vehicleRepository.save(vehicle);
                    message = "Xe biển số " + licensePlateNumber + " của " + ownerName + " được phép ra cổng";
                } else {
                    message = "Xe biển số " + licensePlateNumber + " của " + ownerName + " được phép ra vào cổng";
                }
                
                // Create vehicle log entry for approved access (with optional snapshot evidence)
                createVehicleLogEntry(vehicle, type, gate, snapshot);

                // Get employee info and send to WebSocket
                try {
                    VehicleLog.LogType logType = "entry".equalsIgnoreCase(type) ? VehicleLog.LogType.entry : VehicleLog.LogType.exit;
                    Object monitorInfo = vehicleLogService.getOwnerInfoByLicensePlate(licensePlateNumber, logType, gate);
                    webSocketService.sendVehicleCheckMessage(monitorInfo, gateId(gate));
                } catch (Exception e) {
                    // Fallback to simple message if employee info fails
                    webSocketService.sendVehicleCheckMessage(licensePlateNumber, type, message, gateId(gate));
                }

                recordCheck(gate, "approved");
            } else {
                String ownerName = vehicle.getOwner() != null ? vehicle.getOwner().getFullName() : "Không xác định";
                String statusText = getStatusText(vehicle.getStatus()).equals("Entered") ? "đã vào" : "đã ra";
                message = "Xe biển số " + licensePlateNumber + " của " + ownerName
                        + " không được phép ra vào (Trạng thái: " + statusText + ")";
                
                // Send WebSocket message for denied access
                webSocketService.sendVehicleCheckMessage(licensePlateNumber, type, message, gateId(gate));
                recordCheck(gate, "denied");
            }

            return new VehicleCheckResponse(
                isApproved,
                message,
                licensePlateNumber,
                type
            );

        } catch (Exception e) {
            recordCheck(gate, "error");
            String errorMessage = "Lá»—i kiá»ƒm tra xe: " + e.getMessage();
            
            // Send WebSocket message for error
            try {
                webSocketService.sendVehicleCheckMessage(licensePlateNumber, type, errorMessage, gateId(gate));
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
     * Create a vehicle log entry for access events. When {@code gate} is non-null
     * the log is tagged with the gate and its location; otherwise it falls back to
     * the historical default gate location. When {@code snapshot} is present it is
     * stored (best-effort) and linked as the log's {@code imagePath} (Phase 4.2).
     */
    private void createVehicleLogEntry(Vehicle vehicle, String type, Gate gate, MultipartFile snapshot) {
        try {
            String gateLocation = gate != null && gate.getLocation() != null && !gate.getLocation().isBlank()
                    ? gate.getLocation()
                    : "Main Gate"; // Default gate location for gate-less (backward-compatible) checks
            // Persist the evidence snapshot if one was sent; a null result (no
            // snapshot or a storage failure) simply leaves the log image-less.
            String imagePath = snapshotStorageService.store(snapshot, vehicle.getLicensePlate());
            VehicleLogDto logDto = VehicleLogDto.builder()
                    .licensePlateNumber(vehicle.getLicensePlate())
                    .vehicleId(vehicle.getId())
                    .ownerId(vehicle.getOwner() != null ? vehicle.getOwner().getId() : null)
                    .entryExitTime(LocalDateTime.now())
                    .type("entry".equalsIgnoreCase(type) ? VehicleLog.LogType.entry : VehicleLog.LogType.exit)
                    .vehicleType(VehicleLog.VehicleCategory.internal)
                    .driverName(vehicle.getOwner() != null ? vehicle.getOwner().getFullName() : null)
                    .purpose("Truy cập xe tự động")
                    .gateLocation(gateLocation)
                    .gateId(gate != null ? gate.getId() : null)
                    .siteId(gate != null ? gate.getSiteId() : vehicle.getCurrentSiteId())
                    .imagePath(imagePath)
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
     * Resolve the gate for a check request. An unknown id is treated as "no gate"
     * so a stale/invalid gateId never fails the access check.
     */
    private Gate resolveGate(UUID gateId) {
        if (gateId == null) {
            return null;
        }
        return gateRepository.findById(gateId).orElse(null);
    }

    private List<Vehicle> scopedVehicles(List<Vehicle> vehicles) {
        if (!siteAccess.isRestricted()) {
            return vehicles;
        }
        List<UUID> allowed = siteAccess.allowedSiteIds();
        return vehicles.stream()
                .filter(v -> v.getCurrentSiteId() != null && allowed.contains(v.getCurrentSiteId()))
                .collect(Collectors.toList());
    }

    private Page<VehicleDto> filterPage(Page<Vehicle> page, Pageable pageable) {
        if (!siteAccess.isRestricted()) {
            return page.map(VehicleDto::new);
        }
        List<UUID> allowed = siteAccess.allowedSiteIds();
        List<VehicleDto> filtered = page.getContent().stream()
                .filter(v -> v.getCurrentSiteId() != null && allowed.contains(v.getCurrentSiteId()))
                .map(VehicleDto::new)
                .collect(Collectors.toList());
        return new PageImpl<>(filtered, pageable, filtered.size());
    }

    private void assertVehicleVisible(Vehicle vehicle) {
        if (isMemberPrincipal()) {
            User self = requireMemberPrincipal();
            List<UUID> tenants = userService.findAffiliationTenantIdsForUser(self);
            if (!memberVehicleQueryService.isOwnedInTenants(vehicle.getId(), self.getId(), tenants)) {
                throw new AccessDeniedException("Vehicle is outside your affiliations");
            }
            return;
        }
        if (!siteAccess.isRestricted()) {
            return;
        }
        if (vehicle.getCurrentSiteId() == null || !siteAccess.allowedSiteIds().contains(vehicle.getCurrentSiteId())) {
            throw new AccessDeniedException("Vehicle is outside your assigned branches");
        }
    }

    private List<Vehicle> memberOwnVehicles() {
        User self = requireMemberPrincipal();
        List<UUID> tenants = userService.findAffiliationTenantIdsForUser(self);
        return memberVehicleQueryService.findOwnedInTenants(self.getId(), tenants);
    }

    private VehicleDto memberOwnVehicle(UUID id) {
        User self = requireMemberPrincipal();
        List<UUID> tenants = userService.findAffiliationTenantIdsForUser(self);
        if (!memberVehicleQueryService.isOwnedInTenants(id, self.getId(), tenants)) {
            throw new ResourceNotFoundException("Vehicle not found with id: " + id);
        }
        return memberOwnVehicles().stream()
                .filter(v -> id.equals(v.getId()))
                .findFirst()
                .map(VehicleDto::new)
                .orElseThrow(() -> new ResourceNotFoundException("Vehicle not found with id: " + id));
    }

    private Page<VehicleDto> pageMemberVehicles(Pageable pageable) {
        return pageMemberVehicles(memberOwnVehicles(), pageable);
    }

    private Page<VehicleDto> pageMemberVehicles(List<Vehicle> vehicles, Pageable pageable) {
        int start = (int) pageable.getOffset();
        if (start >= vehicles.size()) {
            return new PageImpl<>(Collections.emptyList(), pageable, vehicles.size());
        }
        int end = Math.min(start + pageable.getPageSize(), vehicles.size());
        List<VehicleDto> slice = vehicles.subList(start, end).stream()
                .map(VehicleDto::new)
                .collect(Collectors.toList());
        return new PageImpl<>(slice, pageable, vehicles.size());
    }

    private static List<Vehicle> filterMemberSearch(List<Vehicle> vehicles, String searchTerm) {
        if (searchTerm == null || searchTerm.isBlank()) {
            return vehicles;
        }
        String q = searchTerm.toLowerCase(Locale.ROOT);
        return vehicles.stream()
                .filter(v -> containsIgnoreCase(v.getLicensePlate(), q)
                        || containsIgnoreCase(v.getBrand(), q)
                        || containsIgnoreCase(v.getModel(), q))
                .collect(Collectors.toList());
    }

    private static boolean containsIgnoreCase(String value, String q) {
        return value != null && value.toLowerCase(Locale.ROOT).contains(q);
    }

    private static boolean licensePlateEqualsNormalized(String a, String b) {
        return normalizePlate(a).equals(normalizePlate(b));
    }

    private static String normalizePlate(String plate) {
        if (plate == null) {
            return "";
        }
        return plate.toUpperCase(Locale.ROOT).replace("-", "").replace(".", "").replace(" ", "").replace("_", "");
    }

    private static boolean isMemberPrincipal() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null && auth.getPrincipal() instanceof User user && user.getRole() == User.Role.MEMBER;
    }

    private static User requireMemberPrincipal() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getPrincipal() instanceof User user) || user.getRole() != User.Role.MEMBER) {
            throw new AccessDeniedException("MEMBER principal required");
        }
        return user;
    }

    /**
     * @param requireWhenRestricted when true (create), SITE_MANAGER must supply a site
     */
    private void resolveSiteForWrite(UUID siteId, boolean requireWhenRestricted) {
        if (!siteAccess.isRestricted()) {
            return;
        }
        if (siteId == null) {
            if (requireWhenRestricted) {
                throw new IllegalArgumentException("SITE_MANAGER must assign currentSiteId when creating a vehicle");
            }
            return;
        }
        siteAccess.assertSiteAllowed(siteId);
    }

    private UUID gateId(Gate gate) {
        return gate != null ? gate.getId() : null;
    }

    /**
     * Bump the {@code vehicle_check_total{gate,result}} counter for one access check.
     * {@code result} is one of {@code approved | denied | not_found | error}; the gate
     * tag falls back to {@code none} for gate-less (backward-compatible) checks.
     */
    private void recordCheck(Gate gate, String result) {
        meterRegistry.counter(VEHICLE_CHECK,
                "gate", gate != null ? gate.getName() : "none",
                "result", result).increment();
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
