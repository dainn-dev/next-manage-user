package com.vehiclemanagement.analytics;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public record AnalyticsSummary(UUID siteId, LocalDate from, LocalDate to, long entries, long exits,
        long completedSessions, double averageDwellSeconds, long occupiedSlots, long totalSlots,
        double fillRate, OffsetDateTime asOf, List<ReturningVehicle> topReturningVehicles,
        List<HeatmapCell> heatmap) {
    public record ReturningVehicle(String licensePlate, long visits) { }
    public record HeatmapCell(UUID slotId, double occupiedSeconds, long visits, double intensity) { }
}
