package com.vehiclemanagement.service;

import com.vehiclemanagement.dto.VehicleStatisticsDto;
import com.vehiclemanagement.entity.VehicleLog;
import com.vehiclemanagement.repository.EmployeeRepository;
import com.vehiclemanagement.repository.VehicleLogRepository;
import com.vehiclemanagement.repository.VehicleRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class VehicleLogServiceStatisticsTest {

    @Mock
    private VehicleLogRepository vehicleLogRepository;

    @Mock
    private VehicleRepository vehicleRepository;

    @Mock
    private EmployeeRepository employeeRepository;

    @InjectMocks
    private VehicleLogService vehicleLogService;

    @Test
    void getLogBasedStatistics_fiveLogsToday_populatesDailyWeeklyMonthly() {
        // 5 logs today: 3 entry + 2 exit, 5 distinct license plates
        LocalDate today = LocalDate.now();
        List<VehicleLog> logs = List.of(
                buildLog("51A-00001", VehicleLog.LogType.entry, today.atTime(8, 0)),
                buildLog("51A-00002", VehicleLog.LogType.entry, today.atTime(9, 0)),
                buildLog("51A-00003", VehicleLog.LogType.entry, today.atTime(10, 0)),
                buildLog("51A-00004", VehicleLog.LogType.exit, today.atTime(11, 0)),
                buildLog("51A-00005", VehicleLog.LogType.exit, today.atTime(12, 0))
        );

        when(vehicleLogRepository.findByEntryExitTimeBetween(any(), any(), any()))
                .thenReturn(new PageImpl<>(logs, PageRequest.of(0, 100_000), logs.size()));

        VehicleLogService.LogBasedStatistics stats = vehicleLogService.getLogBasedStatistics();

        // Daily: 30 day buckets, today's bucket has 3 entry / 2 exit / 5 unique
        List<VehicleStatisticsDto.VehicleDailyStatsDto> daily = stats.getDailyStats();
        assertEquals(30, daily.size());
        VehicleStatisticsDto.VehicleDailyStatsDto todayStats = daily.stream()
                .filter(d -> d.getDate().equals(today))
                .findFirst()
                .orElseThrow(() -> new AssertionError("Missing daily bucket for today"));
        assertEquals(3, todayStats.getEntryCount());
        assertEquals(2, todayStats.getExitCount());
        assertEquals(5, todayStats.getTotalRequests());
        assertEquals(5, todayStats.getUniqueVehicles());
        // No status on VehicleLog -> status counts are 0; completed mirrors exit count
        assertEquals(0, todayStats.getApprovedCount());
        assertEquals(0, todayStats.getPendingCount());
        assertEquals(0, todayStats.getRejectedCount());
        assertEquals(2, todayStats.getCompletedCount());

        // Weekly: 12 buckets, current week bucket non-empty
        List<VehicleStatisticsDto.VehicleWeeklyStatsDto> weekly = stats.getWeeklyStats();
        assertEquals(12, weekly.size());
        long weeklyEntry = weekly.stream()
                .filter(w -> weekContains(w, today))
                .mapToLong(VehicleStatisticsDto.VehicleWeeklyStatsDto::getEntryCount)
                .sum();
        long weeklyExit = weekly.stream()
                .filter(w -> weekContains(w, today))
                .mapToLong(VehicleStatisticsDto.VehicleWeeklyStatsDto::getExitCount)
                .sum();
        assertEquals(3, weeklyEntry);
        assertEquals(2, weeklyExit);

        // Monthly: 12 buckets, current month bucket non-empty with peak day
        List<VehicleStatisticsDto.VehicleMonthlyStatsDto> monthly = stats.getMonthlyStats();
        assertEquals(12, monthly.size());
        VehicleStatisticsDto.VehicleMonthlyStatsDto monthStats = monthly.stream()
                .filter(m -> m.getYear() == today.getYear() && m.getMonth() == today.getMonthValue())
                .findFirst()
                .orElseThrow(() -> new AssertionError("Missing monthly bucket for current month"));
        assertEquals(3, monthStats.getEntryCount());
        assertEquals(2, monthStats.getExitCount());
        assertEquals(5, monthStats.getTotalRequests());
        assertEquals(5, monthStats.getUniqueVehicles());
        assertNotNull(monthStats.getPeakDay());
        assertEquals(today, monthStats.getPeakDay().getDate());
        // Peak day has the most requests among the days with logs
        assertTrue(monthStats.getPeakDay().getRequestCount() >= 1);
    }

    private boolean weekContains(VehicleStatisticsDto.VehicleWeeklyStatsDto w, LocalDate date) {
        return (w.getStartDate() == null || !date.isBefore(w.getStartDate()))
                && (w.getEndDate() == null || !date.isAfter(w.getEndDate()));
    }

    private VehicleLog buildLog(String licensePlate, VehicleLog.LogType type, LocalDateTime time) {
        return VehicleLog.builder()
                .licensePlateNumber(licensePlate)
                .type(type)
                .vehicleType(VehicleLog.VehicleCategory.internal)
                .entryExitTime(time)
                .build();
    }
}