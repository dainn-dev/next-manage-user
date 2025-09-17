package com.vehiclemanagement.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@Schema(description = "Vehicle statistics data")
public class VehicleStatisticsDto {

    @Schema(description = "Total number of vehicles")
    private long totalVehicles;

    @Schema(description = "Number of approved vehicles")
    private long approvedVehicles;

    @Schema(description = "Number of rejected vehicles")
    private long rejectedVehicles;

    @Schema(description = "Number of exited vehicles")
    private long exitedVehicles;

    @Schema(description = "Number of entered vehicles")
    private long enteredVehicles;

    @Schema(description = "Vehicle count by type")
    private Map<String, Long> vehicleTypeStats;

    @Schema(description = "Vehicle count by fuel type")
    private Map<String, Long> fuelTypeStats;


    @Schema(description = "Daily statistics")
    private List<VehicleDailyStatsDto> dailyStats;

    @Schema(description = "Weekly statistics")
    private List<VehicleWeeklyStatsDto> weeklyStats;

    @Schema(description = "Monthly statistics")
    private List<VehicleMonthlyStatsDto> monthlyStats;

    // Constructors
    public VehicleStatisticsDto() {}

    public VehicleStatisticsDto(long totalVehicles, long approvedVehicles, long rejectedVehicles, 
                               long exitedVehicles, long enteredVehicles, 
                               Map<String, Long> vehicleTypeStats, Map<String, Long> fuelTypeStats,
                               List<VehicleDailyStatsDto> dailyStats,
                               List<VehicleWeeklyStatsDto> weeklyStats, List<VehicleMonthlyStatsDto> monthlyStats) {
        this.totalVehicles = totalVehicles;
        this.approvedVehicles = approvedVehicles;
        this.rejectedVehicles = rejectedVehicles;
        this.exitedVehicles = exitedVehicles;
        this.enteredVehicles = enteredVehicles;
        this.vehicleTypeStats = vehicleTypeStats;
        this.fuelTypeStats = fuelTypeStats;
        this.dailyStats = dailyStats;
        this.weeklyStats = weeklyStats;
        this.monthlyStats = monthlyStats;
    }

    // Getters and Setters
    public long getTotalVehicles() {
        return totalVehicles;
    }

    public void setTotalVehicles(long totalVehicles) {
        this.totalVehicles = totalVehicles;
    }

    public long getApprovedVehicles() {
        return approvedVehicles;
    }

    public void setApprovedVehicles(long approvedVehicles) {
        this.approvedVehicles = approvedVehicles;
    }

    public long getRejectedVehicles() {
        return rejectedVehicles;
    }

    public void setRejectedVehicles(long rejectedVehicles) {
        this.rejectedVehicles = rejectedVehicles;
    }

    public long getExitedVehicles() {
        return exitedVehicles;
    }

    public void setExitedVehicles(long exitedVehicles) {
        this.exitedVehicles = exitedVehicles;
    }

    public long getEnteredVehicles() {
        return enteredVehicles;
    }

    public void setEnteredVehicles(long enteredVehicles) {
        this.enteredVehicles = enteredVehicles;
    }

    public Map<String, Long> getVehicleTypeStats() {
        return vehicleTypeStats;
    }

    public void setVehicleTypeStats(Map<String, Long> vehicleTypeStats) {
        this.vehicleTypeStats = vehicleTypeStats;
    }

    public Map<String, Long> getFuelTypeStats() {
        return fuelTypeStats;
    }

    public void setFuelTypeStats(Map<String, Long> fuelTypeStats) {
        this.fuelTypeStats = fuelTypeStats;
    }


    public List<VehicleDailyStatsDto> getDailyStats() {
        return dailyStats;
    }

    public void setDailyStats(List<VehicleDailyStatsDto> dailyStats) {
        this.dailyStats = dailyStats;
    }

    public List<VehicleWeeklyStatsDto> getWeeklyStats() {
        return weeklyStats;
    }

    public void setWeeklyStats(List<VehicleWeeklyStatsDto> weeklyStats) {
        this.weeklyStats = weeklyStats;
    }

    public List<VehicleMonthlyStatsDto> getMonthlyStats() {
        return monthlyStats;
    }

    public void setMonthlyStats(List<VehicleMonthlyStatsDto> monthlyStats) {
        this.monthlyStats = monthlyStats;
    }

    // Nested DTOs

    @Schema(description = "Daily vehicle statistics")
    public static class VehicleDailyStatsDto {
        @Schema(description = "Date")
        @JsonFormat(pattern = "yyyy-MM-dd")
        private LocalDate date;

        @Schema(description = "Number of entry requests")
        private long entryCount;

        @Schema(description = "Number of exit requests")
        private long exitCount;

        @Schema(description = "Total number of requests")
        private long totalRequests;

        @Schema(description = "Number of approved requests")
        private long approvedCount;

        @Schema(description = "Number of pending requests")
        private long pendingCount;

        @Schema(description = "Number of rejected requests")
        private long rejectedCount;

        @Schema(description = "Number of unique vehicles")
        private long uniqueVehicles;

        // Constructors
        public VehicleDailyStatsDto() {}

        public VehicleDailyStatsDto(LocalDate date, long entryCount, long exitCount, long totalRequests,
                                   long approvedCount, long pendingCount, long rejectedCount, long uniqueVehicles) {
            this.date = date;
            this.entryCount = entryCount;
            this.exitCount = exitCount;
            this.totalRequests = totalRequests;
            this.approvedCount = approvedCount;
            this.pendingCount = pendingCount;
            this.rejectedCount = rejectedCount;
            this.uniqueVehicles = uniqueVehicles;
        }

        // Getters and Setters
        public LocalDate getDate() {
            return date;
        }

        public void setDate(LocalDate date) {
            this.date = date;
        }

        public long getEntryCount() {
            return entryCount;
        }

        public void setEntryCount(long entryCount) {
            this.entryCount = entryCount;
        }

        public long getExitCount() {
            return exitCount;
        }

        public void setExitCount(long exitCount) {
            this.exitCount = exitCount;
        }

        public long getTotalRequests() {
            return totalRequests;
        }

        public void setTotalRequests(long totalRequests) {
            this.totalRequests = totalRequests;
        }

        public long getApprovedCount() {
            return approvedCount;
        }

        public void setApprovedCount(long approvedCount) {
            this.approvedCount = approvedCount;
        }

        public long getPendingCount() {
            return pendingCount;
        }

        public void setPendingCount(long pendingCount) {
            this.pendingCount = pendingCount;
        }

        public long getRejectedCount() {
            return rejectedCount;
        }

        public void setRejectedCount(long rejectedCount) {
            this.rejectedCount = rejectedCount;
        }

        public long getUniqueVehicles() {
            return uniqueVehicles;
        }

        public void setUniqueVehicles(long uniqueVehicles) {
            this.uniqueVehicles = uniqueVehicles;
        }
    }

    @Schema(description = "Weekly vehicle statistics")
    public static class VehicleWeeklyStatsDto {
        @Schema(description = "Week number")
        private int week;

        @Schema(description = "Start date of the week")
        @JsonFormat(pattern = "yyyy-MM-dd")
        private LocalDate startDate;

        @Schema(description = "End date of the week")
        @JsonFormat(pattern = "yyyy-MM-dd")
        private LocalDate endDate;

        @Schema(description = "Number of entry requests")
        private long entryCount;

        @Schema(description = "Number of exit requests")
        private long exitCount;

        @Schema(description = "Total number of requests")
        private long totalRequests;

        @Schema(description = "Number of approved requests")
        private long approvedCount;

        @Schema(description = "Number of pending requests")
        private long pendingCount;

        @Schema(description = "Number of rejected requests")
        private long rejectedCount;

        @Schema(description = "Number of unique vehicles")
        private long uniqueVehicles;

        // Constructors
        public VehicleWeeklyStatsDto() {}

        public VehicleWeeklyStatsDto(int week, LocalDate startDate, LocalDate endDate, long entryCount,
                                    long exitCount, long totalRequests, long approvedCount, long pendingCount,
                                    long rejectedCount, long uniqueVehicles) {
            this.week = week;
            this.startDate = startDate;
            this.endDate = endDate;
            this.entryCount = entryCount;
            this.exitCount = exitCount;
            this.totalRequests = totalRequests;
            this.approvedCount = approvedCount;
            this.pendingCount = pendingCount;
            this.rejectedCount = rejectedCount;
            this.uniqueVehicles = uniqueVehicles;
        }

        // Getters and Setters
        public int getWeek() {
            return week;
        }

        public void setWeek(int week) {
            this.week = week;
        }

        public LocalDate getStartDate() {
            return startDate;
        }

        public void setStartDate(LocalDate startDate) {
            this.startDate = startDate;
        }

        public LocalDate getEndDate() {
            return endDate;
        }

        public void setEndDate(LocalDate endDate) {
            this.endDate = endDate;
        }

        public long getEntryCount() {
            return entryCount;
        }

        public void setEntryCount(long entryCount) {
            this.entryCount = entryCount;
        }

        public long getExitCount() {
            return exitCount;
        }

        public void setExitCount(long exitCount) {
            this.exitCount = exitCount;
        }

        public long getTotalRequests() {
            return totalRequests;
        }

        public void setTotalRequests(long totalRequests) {
            this.totalRequests = totalRequests;
        }

        public long getApprovedCount() {
            return approvedCount;
        }

        public void setApprovedCount(long approvedCount) {
            this.approvedCount = approvedCount;
        }

        public long getPendingCount() {
            return pendingCount;
        }

        public void setPendingCount(long pendingCount) {
            this.pendingCount = pendingCount;
        }

        public long getRejectedCount() {
            return rejectedCount;
        }

        public void setRejectedCount(long rejectedCount) {
            this.rejectedCount = rejectedCount;
        }

        public long getUniqueVehicles() {
            return uniqueVehicles;
        }

        public void setUniqueVehicles(long uniqueVehicles) {
            this.uniqueVehicles = uniqueVehicles;
        }
    }

    @Schema(description = "Monthly vehicle statistics")
    public static class VehicleMonthlyStatsDto {
        @Schema(description = "Month number")
        private int month;

        @Schema(description = "Year")
        private int year;

        @Schema(description = "Number of entry requests")
        private long entryCount;

        @Schema(description = "Number of exit requests")
        private long exitCount;

        @Schema(description = "Total number of requests")
        private long totalRequests;

        @Schema(description = "Number of approved requests")
        private long approvedCount;

        @Schema(description = "Number of pending requests")
        private long pendingCount;

        @Schema(description = "Number of rejected requests")
        private long rejectedCount;

        @Schema(description = "Number of unique vehicles")
        private long uniqueVehicles;

        // Constructors
        public VehicleMonthlyStatsDto() {}

        public VehicleMonthlyStatsDto(int month, int year, long entryCount, long exitCount,
                                     long totalRequests, long approvedCount, long pendingCount,
                                     long rejectedCount, long uniqueVehicles) {
            this.month = month;
            this.year = year;
            this.entryCount = entryCount;
            this.exitCount = exitCount;
            this.totalRequests = totalRequests;
            this.approvedCount = approvedCount;
            this.pendingCount = pendingCount;
            this.rejectedCount = rejectedCount;
            this.uniqueVehicles = uniqueVehicles;
        }

        // Getters and Setters
        public int getMonth() {
            return month;
        }

        public void setMonth(int month) {
            this.month = month;
        }

        public int getYear() {
            return year;
        }

        public void setYear(int year) {
            this.year = year;
        }

        public long getEntryCount() {
            return entryCount;
        }

        public void setEntryCount(long entryCount) {
            this.entryCount = entryCount;
        }

        public long getExitCount() {
            return exitCount;
        }

        public void setExitCount(long exitCount) {
            this.exitCount = exitCount;
        }

        public long getTotalRequests() {
            return totalRequests;
        }

        public void setTotalRequests(long totalRequests) {
            this.totalRequests = totalRequests;
        }

        public long getApprovedCount() {
            return approvedCount;
        }

        public void setApprovedCount(long approvedCount) {
            this.approvedCount = approvedCount;
        }

        public long getPendingCount() {
            return pendingCount;
        }

        public void setPendingCount(long pendingCount) {
            this.pendingCount = pendingCount;
        }

        public long getRejectedCount() {
            return rejectedCount;
        }

        public void setRejectedCount(long rejectedCount) {
            this.rejectedCount = rejectedCount;
        }

        public long getUniqueVehicles() {
            return uniqueVehicles;
        }

        public void setUniqueVehicles(long uniqueVehicles) {
            this.uniqueVehicles = uniqueVehicles;
        }
    }
}
