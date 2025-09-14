package com.vehiclemanagement.dto;

import java.util.List;

public class ImportResultDto {
    
    private int totalRows;
    private int successCount;
    private int errorCount;
    private List<String> errors;
    private List<EntryExitRequestDto> importedRequests;
    
    // Constructors
    public ImportResultDto() {}
    
    public ImportResultDto(int totalRows, int successCount, int errorCount, List<String> errors, List<EntryExitRequestDto> importedRequests) {
        this.totalRows = totalRows;
        this.successCount = successCount;
        this.errorCount = errorCount;
        this.errors = errors;
        this.importedRequests = importedRequests;
    }
    
    // Getters and Setters
    public int getTotalRows() {
        return totalRows;
    }
    
    public void setTotalRows(int totalRows) {
        this.totalRows = totalRows;
    }
    
    public int getSuccessCount() {
        return successCount;
    }
    
    public void setSuccessCount(int successCount) {
        this.successCount = successCount;
    }
    
    public int getErrorCount() {
        return errorCount;
    }
    
    public void setErrorCount(int errorCount) {
        this.errorCount = errorCount;
    }
    
    public List<String> getErrors() {
        return errors;
    }
    
    public void setErrors(List<String> errors) {
        this.errors = errors;
    }
    
    public List<EntryExitRequestDto> getImportedRequests() {
        return importedRequests;
    }
    
    public void setImportedRequests(List<EntryExitRequestDto> importedRequests) {
        this.importedRequests = importedRequests;
    }
}
