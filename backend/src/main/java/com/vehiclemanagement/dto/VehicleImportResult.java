package com.vehiclemanagement.dto;

import java.util.ArrayList;
import java.util.List;

/**
 * Summary of a bulk vehicle import run. Each data row is processed in its own
 * transaction, so the import is partial: {@code successCount + skippedCount +
 * failureCount == totalRows}. Rows that already exist (matched by normalized
 * license plate) are skipped rather than failed.
 */
public class VehicleImportResult {

    private int totalRows;
    private int successCount;
    private int skippedCount;
    private int failureCount;
    private final List<RowError> errors = new ArrayList<>();

    public int getTotalRows() {
        return totalRows;
    }

    public int getSuccessCount() {
        return successCount;
    }

    public int getSkippedCount() {
        return skippedCount;
    }

    public int getFailureCount() {
        return failureCount;
    }

    public List<RowError> getErrors() {
        return errors;
    }

    public void incrementTotal() {
        this.totalRows++;
    }

    public void incrementSuccess() {
        this.successCount++;
    }

    public void incrementSkipped() {
        this.skippedCount++;
    }

    public void incrementFailure() {
        this.failureCount++;
    }

    public void addError(int row, String licensePlate, String message) {
        this.errors.add(new RowError(row, licensePlate, message));
    }

    public static class RowError {
        private final int row;
        private final String licensePlate;
        private final String message;

        public RowError(int row, String licensePlate, String message) {
            this.row = row;
            this.licensePlate = licensePlate;
            this.message = message;
        }

        public int getRow() {
            return row;
        }

        public String getLicensePlate() {
            return licensePlate;
        }

        public String getMessage() {
            return message;
        }
    }
}
