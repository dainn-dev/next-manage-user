package com.vehiclemanagement.service;

import com.vehiclemanagement.dto.VehicleLogDto;
import com.vehiclemanagement.dto.VehicleLogTodayStatisticsDto;
import com.vehiclemanagement.dto.VehicleStatisticsDto;
import com.vehiclemanagement.entity.Gate;
import com.vehiclemanagement.entity.User;
import com.vehiclemanagement.entity.Vehicle;
import com.vehiclemanagement.entity.VehicleLog;
import com.vehiclemanagement.repository.GateRepository;
import com.vehiclemanagement.repository.UserRepository;
import com.vehiclemanagement.repository.VehicleLogRepository;
import com.vehiclemanagement.repository.VehicleRepository;
import com.vehiclemanagement.security.SiteAccess;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.temporal.WeekFields;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@Transactional
public class VehicleLogService {
    
    @Autowired
    private VehicleLogRepository vehicleLogRepository;
    
    @Autowired
    private VehicleRepository vehicleRepository;
    
    @Autowired
    private UserRepository userRepository;

    @Autowired
    private GateRepository gateRepository;

    @Autowired
    private SiteAccess siteAccess;

    public Page<VehicleLogDto> getAllVehicleLogs(Pageable pageable) {
        Page<VehicleLog> logs = siteAccess.isRestricted()
                ? vehicleLogRepository.findBySiteIdIn(siteAccess.allowedSiteIds(), pageable)
                : vehicleLogRepository.findAll(pageable);
        return logs.map(this::convertToDto);
    }
    
    public List<VehicleLogDto> getAllVehicleLogsList() {
        List<VehicleLog> logs = siteAccess.isRestricted()
                ? vehicleLogRepository.findBySiteIdIn(siteAccess.allowedSiteIds())
                : vehicleLogRepository.findAll();
        return logs.stream().map(this::convertToDto).toList();
    }
    
    public VehicleLogDto getVehicleLogById(UUID id) {
        VehicleLog log = vehicleLogRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Vehicle log not found with id: " + id));
        siteAccess.assertSiteAllowed(log.getSiteId());
        return convertToDto(log);
    }
    
    public Page<VehicleLogDto> getVehicleLogsByDateRange(LocalDateTime startDate, LocalDateTime endDate, Pageable pageable) {
        Page<VehicleLog> logs;
        if (siteAccess.isRestricted()) {
            List<UUID> siteIds = siteAccess.allowedSiteIds();
            logs = siteIds.isEmpty()
                    ? Page.empty(pageable)
                    : vehicleLogRepository.findBySiteIdInAndEntryExitTimeBetween(
                            siteIds, startDate, endDate, pageable);
        } else {
            logs = vehicleLogRepository.findByEntryExitTimeBetween(startDate, endDate, pageable);
        }
        return logs.map(this::convertToDto);
    }

    public Page<VehicleLogDto> getTodayLogs(Pageable pageable) {
        LocalDate today = LocalDate.now();
        return getVehicleLogsByDateRange(today.atStartOfDay(), today.atTime(LocalTime.MAX), pageable);
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
                licensePlate, type, vehicleType, driverName, startDate, endDate,
                siteAccess.isRestricted() ? siteAccess.allowedSiteIds() : null,
                pageable);
        return logs.map(this::convertToDto);
    }
    
    public VehicleLogDto createVehicleLog(VehicleLogDto vehicleLogDto) {
        VehicleLog vehicleLog = convertToEntity(vehicleLogDto);
        
        // Associate the vehicle and its registered owner by license plate.
        Optional<Vehicle> vehicle = vehicleRepository.findByLicensePlateNormalized(vehicleLogDto.getLicensePlateNumber());
        if (vehicle.isPresent()) {
            vehicleLog.setVehicle(vehicle.get());
            vehicleLog.setOwner(vehicle.get().getOwner());
        } else if (vehicleLogDto.getOwnerId() != null) {
            userRepository.findById(vehicleLogDto.getOwnerId()).ifPresent(vehicleLog::setOwner);
        }

        if (vehicleLogDto.getSecurityGuardId() != null) {
            userRepository.findById(vehicleLogDto.getSecurityGuardId()).ifPresent(vehicleLog::setSecurityGuard);
        }

        // Associate the originating gate when supplied (Phase 3.2). Backward
        // compatible: a null gateId leaves the log gate-less as before, and an
        // unknown id is ignored rather than failing the write.
        if (vehicleLogDto.getGateId() != null) {
            Optional<Gate> gate = gateRepository.findById(vehicleLogDto.getGateId());
            if (gate.isPresent()) {
                vehicleLog.setGate(gate.get());
                if ((vehicleLog.getGateLocation() == null || vehicleLog.getGateLocation().isBlank())
                        && gate.get().getLocation() != null) {
                    vehicleLog.setGateLocation(gate.get().getLocation());
                }
                if (vehicleLog.getSiteId() == null && gate.get().getSiteId() != null) {
                    vehicleLog.setSiteId(gate.get().getSiteId());
                }
            }
        }
        if (vehicleLog.getSiteId() == null && vehicleLogDto.getSiteId() != null) {
            vehicleLog.setSiteId(vehicleLogDto.getSiteId());
        }

        VehicleLog savedLog = vehicleLogRepository.save(vehicleLog);
        return convertToDto(savedLog);
    }

    /**
     * Replay events for a single gate created after {@code since}, newest first.
     * Backs the reliable-delivery replay endpoint: a per-gate UI that dropped its
     * WebSocket connection calls this on reconnect to recover missed check events.
     * A {@code null} {@code since} defaults to the start of the current day.
     */
    @Transactional(readOnly = true)
    public List<VehicleLogDto> getRecentChecksByGate(UUID gateId, LocalDateTime since) {
        LocalDateTime from = since != null ? since : LocalDate.now().atStartOfDay();
        return vehicleLogRepository.findByGateSince(gateId, from).stream()
                .map(this::convertToDto)
                .collect(Collectors.toList());
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
        
        // Update vehicle association and use its registered owner when present.
        Optional<Vehicle> vehicle = vehicleRepository.findByLicensePlateNormalized(vehicleLogDto.getLicensePlateNumber());
        if (vehicle.isPresent()) {
            existingLog.setVehicle(vehicle.get());
            existingLog.setOwner(vehicle.get().getOwner());
        } else {
            existingLog.setVehicle(null);
            if (vehicleLogDto.getOwnerId() != null) {
                User owner = userRepository.findById(vehicleLogDto.getOwnerId())
                        .orElseThrow(() -> new RuntimeException("User not found with id: " + vehicleLogDto.getOwnerId()));
                existingLog.setOwner(owner);
            } else {
                existingLog.setOwner(null);
            }
        }

        if (vehicleLogDto.getSecurityGuardId() != null) {
            User securityGuard = userRepository.findById(vehicleLogDto.getSecurityGuardId())
                    .orElseThrow(() -> new RuntimeException("User not found with id: " + vehicleLogDto.getSecurityGuardId()));
            existingLog.setSecurityGuard(securityGuard);
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
    public VehicleLogTodayStatisticsDto getTodayStatistics(UUID requestedSiteId) {
        LocalDate today = LocalDate.now();
        List<UUID> siteIds = resolveStatisticsSiteIds(requestedSiteId);
        if (siteIds != null && siteIds.isEmpty()) {
            return new VehicleLogTodayStatisticsDto(0, 0, 0);
        }
        if (siteIds == null) {
            return new VehicleLogTodayStatisticsDto(
                    vehicleLogRepository.countByTypeAndDate(VehicleLog.LogType.entry, today),
                    vehicleLogRepository.countByTypeAndDate(VehicleLog.LogType.exit, today),
                    vehicleLogRepository.countDistinctVehiclesByDate(today));
        }
        return new VehicleLogTodayStatisticsDto(
                vehicleLogRepository.countByTypeAndDateAndSiteIdIn(VehicleLog.LogType.entry, today, siteIds),
                vehicleLogRepository.countByTypeAndDateAndSiteIdIn(VehicleLog.LogType.exit, today, siteIds),
                vehicleLogRepository.countDistinctVehiclesByDateAndSiteIdIn(today, siteIds));
    }

    public long getTodayEntryCount() {
        return getTodayStatistics(null).entryCount();
    }

    public long getTodayExitCount() {
        return getTodayStatistics(null).exitCount();
    }

    public long getTodayUniqueVehicles() {
        return getTodayStatistics(null).uniqueVehicles();
    }

    // Log-based statistics

    /**
     * Holder for the three log-based statistics arrays consumed by the vehicle
     * statistics overview endpoint.
     */
    public static class LogBasedStatistics {
        private final List<VehicleStatisticsDto.VehicleDailyStatsDto> dailyStats;
        private final List<VehicleStatisticsDto.VehicleWeeklyStatsDto> weeklyStats;
        private final List<VehicleStatisticsDto.VehicleMonthlyStatsDto> monthlyStats;

        public LogBasedStatistics(List<VehicleStatisticsDto.VehicleDailyStatsDto> dailyStats,
                                  List<VehicleStatisticsDto.VehicleWeeklyStatsDto> weeklyStats,
                                  List<VehicleStatisticsDto.VehicleMonthlyStatsDto> monthlyStats) {
            this.dailyStats = dailyStats;
            this.weeklyStats = weeklyStats;
            this.monthlyStats = monthlyStats;
        }

        public List<VehicleStatisticsDto.VehicleDailyStatsDto> getDailyStats() {
            return dailyStats;
        }

        public List<VehicleStatisticsDto.VehicleWeeklyStatsDto> getWeeklyStats() {
            return weeklyStats;
        }

        public List<VehicleStatisticsDto.VehicleMonthlyStatsDto> getMonthlyStats() {
            return monthlyStats;
        }
    }

    // Upper bound for a single bulk fetch of vehicle logs in a statistics window.
    // VehicleLog is append-only gate traffic; a single site does not approach this
    // within the 30d / 12w / 12m windows. Picked as a safe constant rather than
    // unbounded since VehicleLogRepository only exposes paged fetchers.
    private static final int STATS_FETCH_LIMIT = 100_000;

    /**
     * Build daily (last 30 days), weekly (last 12 weeks) and monthly (last 12
     * months) statistics from {@link VehicleLog} using existing repository
     * queries. {@code approvedCount}/{@code pendingCount}/{@code rejectedCount}
     * are always 0 because {@link VehicleLog} has no status field (logs are only
     * created for approved gate access). {@code completedCount} mirrors the exit
     * count (a visit completes when the vehicle exits).
     */
    public LogBasedStatistics getLogBasedStatistics() {
        return new LogBasedStatistics(getDailyLogStats(), getWeeklyLogStats(), getMonthlyLogStats());
    }

    public List<VehicleStatisticsDto.VehicleDailyStatsDto> getDailyLogStats() {
        LocalDate today = LocalDate.now();
        LocalDate start = today.minusDays(29);
        List<VehicleLog> logs = fetchLogs(start, today);

        Map<LocalDate, List<VehicleLog>> byDate = logs.stream()
                .collect(Collectors.groupingBy(l -> l.getEntryExitTime().toLocalDate()));

        List<VehicleStatisticsDto.VehicleDailyStatsDto> result = new ArrayList<>(30);
        for (int i = 0; i < 30; i++) {
            LocalDate day = start.plusDays(i);
            List<VehicleLog> dayLogs = byDate.getOrDefault(day, List.of());
            result.add(buildDailyStats(day, dayLogs));
        }
        return result;
    }

    public List<VehicleStatisticsDto.VehicleWeeklyStatsDto> getWeeklyLogStats() {
        LocalDate today = LocalDate.now();
        WeekFields weekFields = WeekFields.of(Locale.getDefault());
        LocalDate startOfWeek = today.minusDays(today.getDayOfWeek().getValue() - 1L);
        LocalDate start = startOfWeek.minusWeeks(11);
        List<VehicleLog> logs = fetchLogs(start, today);

        List<VehicleStatisticsDto.VehicleWeeklyStatsDto> result = new ArrayList<>(12);
        for (int i = 0; i < 12; i++) {
            LocalDate weekStart = start.plusWeeks(i);
            LocalDate weekEnd = weekStart.plusDays(6);
            if (weekStart.isAfter(today)) {
                break;
            }
            if (weekEnd.isAfter(today)) {
                weekEnd = today;
            }
            LocalDate wStart = weekStart;
            LocalDate wEnd = weekEnd;
            List<VehicleLog> weekLogs = logs.stream()
                    .filter(l -> {
                        LocalDate d = l.getEntryExitTime().toLocalDate();
                        return !d.isBefore(wStart) && !d.isAfter(wEnd);
                    })
                    .collect(Collectors.toList());

            long entryCount = countByType(weekLogs, VehicleLog.LogType.entry);
            long exitCount = countByType(weekLogs, VehicleLog.LogType.exit);
            long totalRequests = entryCount + exitCount;
            long uniqueVehicles = weekLogs.stream()
                    .map(VehicleLog::getLicensePlateNumber)
                    .distinct()
                    .count();
            long days = (int) (weekEnd.toEpochDay() - weekStart.toEpochDay()) + 1;
            double averageDailyRequests = days > 0 ? (double) totalRequests / days : 0.0;

            VehicleStatisticsDto.VehicleWeeklyStatsDto dto = new VehicleStatisticsDto.VehicleWeeklyStatsDto();
            dto.setWeek(weekStart.get(weekFields.weekOfYear()));
            dto.setStartDate(weekStart);
            dto.setEndDate(weekEnd);
            dto.setEntryCount(entryCount);
            dto.setExitCount(exitCount);
            dto.setTotalRequests(totalRequests);
            dto.setApprovedCount(0);
            dto.setPendingCount(0);
            dto.setRejectedCount(0);
            dto.setCompletedCount(exitCount);
            dto.setUniqueVehicles(uniqueVehicles);
            dto.setAverageDailyRequests(averageDailyRequests);
            result.add(dto);
        }
        return result;
    }

    public List<VehicleStatisticsDto.VehicleMonthlyStatsDto> getMonthlyLogStats() {
        LocalDate today = LocalDate.now();
        LocalDate startMonth = today.withDayOfMonth(1).minusMonths(11);
        List<VehicleLog> logs = fetchLogs(startMonth, today);

        List<VehicleStatisticsDto.VehicleMonthlyStatsDto> result = new ArrayList<>(12);
        for (int i = 0; i < 12; i++) {
            LocalDate monthStart = startMonth.plusMonths(i);
            if (monthStart.isAfter(today.withDayOfMonth(1))) {
                break;
            }
            LocalDate monthEnd = monthStart.plusMonths(1).minusDays(1);
            if (monthEnd.isAfter(today)) {
                monthEnd = today;
            }
            LocalDate mStart = monthStart;
            LocalDate mEnd = monthEnd;
            List<VehicleLog> monthLogs = logs.stream()
                    .filter(l -> {
                        LocalDate d = l.getEntryExitTime().toLocalDate();
                        return !d.isBefore(mStart) && !d.isAfter(mEnd);
                    })
                    .collect(Collectors.toList());

            long entryCount = countByType(monthLogs, VehicleLog.LogType.entry);
            long exitCount = countByType(monthLogs, VehicleLog.LogType.exit);
            long totalRequests = entryCount + exitCount;
            long uniqueVehicles = monthLogs.stream()
                    .map(VehicleLog::getLicensePlateNumber)
                    .distinct()
                    .count();
            int daysInMonth = monthStart.lengthOfMonth();
            int elapsedDays = (int) (monthEnd.toEpochDay() - monthStart.toEpochDay()) + 1;
            double averageDailyRequests = elapsedDays > 0 ? (double) totalRequests / elapsedDays : daysInMonth > 0 ? 0.0 : 0.0;

            VehicleStatisticsDto.VehicleMonthlyStatsDto dto = new VehicleStatisticsDto.VehicleMonthlyStatsDto();
            dto.setMonth(monthStart.getMonthValue());
            dto.setYear(monthStart.getYear());
            dto.setEntryCount(entryCount);
            dto.setExitCount(exitCount);
            dto.setTotalRequests(totalRequests);
            dto.setApprovedCount(0);
            dto.setPendingCount(0);
            dto.setRejectedCount(0);
            dto.setCompletedCount(exitCount);
            dto.setUniqueVehicles(uniqueVehicles);
            dto.setAverageDailyRequests(averageDailyRequests);
            dto.setPeakDay(buildPeakDay(monthLogs));
            result.add(dto);
        }
        return result;
    }

    private List<UUID> resolveStatisticsSiteIds(UUID requestedSiteId) {
        if (requestedSiteId != null) {
            siteAccess.assertSiteAllowed(requestedSiteId);
            return List.of(requestedSiteId);
        }
        return siteAccess.isRestricted() ? siteAccess.allowedSiteIds() : null;
    }

    private List<VehicleLog> fetchLogs(LocalDate start, LocalDate end) {
        Pageable pageable = PageRequest.of(0, STATS_FETCH_LIMIT);
        List<UUID> siteIds = resolveStatisticsSiteIds(null);
        if (siteIds != null && siteIds.isEmpty()) {
            return List.of();
        }
        Page<VehicleLog> page = siteIds == null
                ? vehicleLogRepository.findByEntryExitTimeBetween(
                        start.atStartOfDay(), end.atTime(LocalTime.MAX), pageable)
                : vehicleLogRepository.findBySiteIdInAndEntryExitTimeBetween(
                        siteIds, start.atStartOfDay(), end.atTime(LocalTime.MAX), pageable);
        return page.getContent();
    }

    private long countByType(List<VehicleLog> logs, VehicleLog.LogType type) {
        return logs.stream().filter(l -> l.getType() == type).count();
    }

    private VehicleStatisticsDto.VehicleDailyStatsDto buildDailyStats(LocalDate day, List<VehicleLog> dayLogs) {
        long entryCount = countByType(dayLogs, VehicleLog.LogType.entry);
        long exitCount = countByType(dayLogs, VehicleLog.LogType.exit);
        long totalRequests = entryCount + exitCount;
        long uniqueVehicles = dayLogs.stream()
                .map(VehicleLog::getLicensePlateNumber)
                .distinct()
                .count();

        VehicleStatisticsDto.VehicleDailyStatsDto dto = new VehicleStatisticsDto.VehicleDailyStatsDto();
        dto.setDate(day);
        dto.setEntryCount(entryCount);
        dto.setExitCount(exitCount);
        dto.setTotalRequests(totalRequests);
        dto.setApprovedCount(0);
        dto.setPendingCount(0);
        dto.setRejectedCount(0);
        dto.setCompletedCount(exitCount);
        dto.setUniqueVehicles(uniqueVehicles);
        return dto;
    }

    private VehicleStatisticsDto.PeakDayDto buildPeakDay(List<VehicleLog> monthLogs) {
        if (monthLogs.isEmpty()) {
            return new VehicleStatisticsDto.PeakDayDto(null, 0);
        }
        Map<LocalDate, Long> byDay = monthLogs.stream()
                .collect(Collectors.groupingBy(l -> l.getEntryExitTime().toLocalDate(), Collectors.counting()));
        Map.Entry<LocalDate, Long> peak = byDay.entrySet().stream()
                .max(Comparator.comparingLong(Map.Entry::getValue))
                .orElse(null);
        if (peak == null) {
            return new VehicleStatisticsDto.PeakDayDto(null, 0);
        }
        return new VehicleStatisticsDto.PeakDayDto(peak.getKey(), peak.getValue());
    }

    private VehicleLogDto convertToDto(VehicleLog vehicleLog) {
        VehicleLogDto dto = VehicleLogDto.builder()
                .id(vehicleLog.getId())
                .licensePlateNumber(vehicleLog.getLicensePlateNumber())
                .vehicleId(vehicleLog.getVehicle() != null ? vehicleLog.getVehicle().getId() : null)
                .ownerId(vehicleLog.getOwner() != null ? vehicleLog.getOwner().getId() : null)
                .ownerName(vehicleLog.getOwner() != null ? vehicleLog.getOwner().getFullName() : null)
                .entryExitTime(vehicleLog.getEntryExitTime())
                .type(vehicleLog.getType())
                .vehicleType(vehicleLog.getVehicleType())
                .driverName(vehicleLog.getDriverName())
                .purpose(vehicleLog.getPurpose())
                .gateLocation(vehicleLog.getGateLocation())
                .gateId(vehicleLog.getGate() != null ? vehicleLog.getGate().getId() : null)
                .gateName(vehicleLog.getGate() != null ? vehicleLog.getGate().getName() : null)
                .siteId(vehicleLog.getSiteId())
                .securityGuardId(vehicleLog.getSecurityGuard() != null ? vehicleLog.getSecurityGuard().getId() : null)
                .securityGuardName(vehicleLog.getSecurityGuard() != null ? vehicleLog.getSecurityGuard().getFullName() : null)
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
    
    public Object getOwnerInfoByLicensePlate(String licensePlateNumber, VehicleLog.LogType type) {
        return getOwnerInfoByLicensePlate(licensePlateNumber, type, null);
    }

    public Object getOwnerInfoByLicensePlate(String licensePlateNumber, VehicleLog.LogType type, Gate gate) {
        Optional<Vehicle> vehicleOpt = vehicleRepository.findByLicensePlateNormalized(licensePlateNumber);

        if (vehicleOpt.isEmpty()) {
            throw new RuntimeException("Vehicle not found with license plate: " + licensePlateNumber);
        }

        Vehicle vehicle = vehicleOpt.get();
        User owner = vehicle.getOwner();

        if (owner == null) {
            throw new RuntimeException("No owner found for vehicle: " + licensePlateNumber);
        }

        List<VehicleLog> logs = vehicleLogRepository
                .findByLicensePlateNumberNormalizedAndTypeOrderByEntryExitTimeDesc(licensePlateNumber, type);

        VehicleLog latestLog = logs.isEmpty() ? null : logs.get(0);

        return new Object() {
            public final String ownerId = owner.getId().toString();
            public final String ownerName = owner.getFullName();
            public final String firstName = owner.getFirstName();
            public final String lastName = owner.getLastName();
            public final String email = owner.getEmail();
            
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
            public final String gateLocation = gate != null && gate.getLocation() != null
                    ? gate.getLocation()
                    : (latestLog != null ? latestLog.getGateLocation() : null);
            public final String notes = latestLog != null ? latestLog.getNotes() : null;
            public final String vehicleImagePath = vehicle.getImagePath();

            // Gate identity (Phase 3.2) so the frontend can attribute the event to a gate.
            public final String gateId = gate != null ? gate.getId().toString() : null;
            public final String gateName = gate != null ? gate.getName() : null;
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
                .siteId(dto.getSiteId())
                .notes(dto.getNotes())
                .imagePath(dto.getImagePath())
                .createdAt(dto.getCreatedAt())
                .updatedAt(dto.getUpdatedAt())
                .build();
    }
}
