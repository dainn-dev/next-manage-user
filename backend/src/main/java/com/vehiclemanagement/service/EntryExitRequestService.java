package com.vehiclemanagement.service;

import com.vehiclemanagement.dto.EntryExitRequestDto;
import com.vehiclemanagement.dto.EntryExitRequestImportDto;
import com.vehiclemanagement.dto.ImportResultDto;
import com.vehiclemanagement.dto.VehicleCheckRequest;
import com.vehiclemanagement.dto.VehicleCheckResponse;
import com.vehiclemanagement.dto.RequestImagesDto;
import com.vehiclemanagement.entity.Employee;
import com.vehiclemanagement.entity.EntryExitRequest;
import com.vehiclemanagement.entity.Vehicle;
import com.vehiclemanagement.exception.ResourceNotFoundException;
import com.vehiclemanagement.repository.EmployeeRepository;
import com.vehiclemanagement.repository.EntryExitRequestRepository;
import com.vehiclemanagement.repository.VehicleRepository;
import com.vehiclemanagement.util.ImageProcessingUtil;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayOutputStream;
import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@Transactional
public class EntryExitRequestService {
    
    @Autowired
    private EntryExitRequestRepository requestRepository;
    
    @Autowired
    private EmployeeRepository employeeRepository;
    
    @Autowired
    private VehicleRepository vehicleRepository;
    
    @Autowired
    private ImageProcessingUtil imageProcessingUtil;
    
    public List<EntryExitRequestDto> getAllRequests() {
        return requestRepository.findAll().stream()
                .map(EntryExitRequestDto::new)
                .collect(Collectors.toList());
    }
    
    public Page<EntryExitRequestDto> getAllRequests(Pageable pageable) {
        return requestRepository.findAll(pageable)
                .map(EntryExitRequestDto::new);
    }
    
    public EntryExitRequestDto getRequestById(UUID id) {
        EntryExitRequest request = requestRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Request not found with id: " + id));
        return new EntryExitRequestDto(request);
    }
    
    public List<EntryExitRequestDto> getRequestsByEmployee(UUID employeeId) {
        Employee employee = employeeRepository.findById(employeeId)
                .orElseThrow(() -> new ResourceNotFoundException("Employee not found with id: " + employeeId));
        
        return requestRepository.findByEmployeeId(employeeId).stream()
                .map(EntryExitRequestDto::new)
                .collect(Collectors.toList());
    }
    
    public List<EntryExitRequestDto> getRequestsByVehicle(UUID vehicleId) {
        Vehicle vehicle = vehicleRepository.findById(vehicleId)
                .orElseThrow(() -> new ResourceNotFoundException("Vehicle not found with id: " + vehicleId));
        
        return requestRepository.findByVehicleId(vehicleId).stream()
                .map(EntryExitRequestDto::new)
                .collect(Collectors.toList());
    }
    
    public List<EntryExitRequestDto> getRequestsByType(EntryExitRequest.RequestType requestType) {
        return requestRepository.findByRequestType(requestType).stream()
                .map(EntryExitRequestDto::new)
                .collect(Collectors.toList());
    }
    
    public List<EntryExitRequestDto> getRequestsByStatus(EntryExitRequest.RequestStatus status) {
        return requestRepository.findByStatus(status).stream()
                .map(EntryExitRequestDto::new)
                .collect(Collectors.toList());
    }
    
    public Page<EntryExitRequestDto> searchRequests(String searchTerm, Pageable pageable) {
        return requestRepository.findBySearchTerm(searchTerm, pageable)
                .map(EntryExitRequestDto::new);
    }
    
    public Page<EntryExitRequestDto> searchRequestsByType(EntryExitRequest.RequestType requestType, String searchTerm, Pageable pageable) {
        return requestRepository.findByRequestTypeAndSearchTerm(requestType, searchTerm, pageable)
                .map(EntryExitRequestDto::new);
    }
    
    public Page<EntryExitRequestDto> searchRequestsByStatus(EntryExitRequest.RequestStatus status, String searchTerm, Pageable pageable) {
        return requestRepository.findByStatusAndSearchTerm(status, searchTerm, pageable)
                .map(EntryExitRequestDto::new);
    }
    
    public List<EntryExitRequestDto> getRequestsByDateRange(LocalDateTime startDate, LocalDateTime endDate) {
        return requestRepository.findByDateRange(startDate, endDate).stream()
                .map(EntryExitRequestDto::new)
                .collect(Collectors.toList());
    }
    
    public List<EntryExitRequestDto> getRequestsByEmployeeAndDateRange(UUID employeeId, LocalDateTime startDate, LocalDateTime endDate) {
        Employee employee = employeeRepository.findById(employeeId)
                .orElseThrow(() -> new ResourceNotFoundException("Employee not found with id: " + employeeId));
        
        return requestRepository.findByEmployeeAndDateRange(employeeId, startDate, endDate).stream()
                .map(EntryExitRequestDto::new)
                .collect(Collectors.toList());
    }
    
    public List<EntryExitRequestDto> getRequestsByVehicleAndDateRange(UUID vehicleId, LocalDateTime startDate, LocalDateTime endDate) {
        Vehicle vehicle = vehicleRepository.findById(vehicleId)
                .orElseThrow(() -> new ResourceNotFoundException("Vehicle not found with id: " + vehicleId));
        
        return requestRepository.findByVehicleAndDateRange(vehicleId, startDate, endDate).stream()
                .map(EntryExitRequestDto::new)
                .collect(Collectors.toList());
    }
    
    public EntryExitRequestDto createRequest(EntryExitRequestDto requestDto) {
        Employee employee = employeeRepository.findById(requestDto.getEmployeeId())
                .orElseThrow(() -> new ResourceNotFoundException("Employee not found with id: " + requestDto.getEmployeeId()));
        
        Vehicle vehicle = vehicleRepository.findById(requestDto.getVehicleId())
                .orElseThrow(() -> new ResourceNotFoundException("Vehicle not found with id: " + requestDto.getVehicleId()));
        
        EntryExitRequest request = new EntryExitRequest();
        request.setEmployee(employee);
        request.setVehicle(vehicle);
        request.setRequestType(requestDto.getRequestType());
        request.setRequestTime(requestDto.getRequestTime() != null ? requestDto.getRequestTime() : LocalDateTime.now());
        request.setStatus(requestDto.getStatus() != null ? requestDto.getStatus() : EntryExitRequest.RequestStatus.pending);
        request.setNotes(requestDto.getNotes());
        
        EntryExitRequest savedRequest = requestRepository.save(request);
        return new EntryExitRequestDto(savedRequest);
    }
    
    public EntryExitRequestDto updateRequest(UUID id, EntryExitRequestDto requestDto) {
        EntryExitRequest existingRequest = requestRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Request not found with id: " + id));
        
        Employee employee = employeeRepository.findById(requestDto.getEmployeeId())
                .orElseThrow(() -> new ResourceNotFoundException("Employee not found with id: " + requestDto.getEmployeeId()));
        
        Vehicle vehicle = vehicleRepository.findById(requestDto.getVehicleId())
                .orElseThrow(() -> new ResourceNotFoundException("Vehicle not found with id: " + requestDto.getVehicleId()));
        
        existingRequest.setEmployee(employee);
        existingRequest.setVehicle(vehicle);
        existingRequest.setRequestType(requestDto.getRequestType());
        existingRequest.setRequestTime(requestDto.getRequestTime());
        existingRequest.setNotes(requestDto.getNotes());
        
        EntryExitRequest updatedRequest = requestRepository.save(existingRequest);
        return new EntryExitRequestDto(updatedRequest);
    }
    
    public EntryExitRequestDto approveRequest(UUID id, String approvedBy) {
        EntryExitRequest request = requestRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Request not found with id: " + id));
        
        request.approve(approvedBy);
        EntryExitRequest updatedRequest = requestRepository.save(request);
        return new EntryExitRequestDto(updatedRequest);
    }
    
    
    public void deleteRequest(UUID id) {
        EntryExitRequest request = requestRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Request not found with id: " + id));
        requestRepository.delete(request);
    }
    
    public long getRequestCountByStatus(EntryExitRequest.RequestStatus status) {
        return requestRepository.countByStatus(status);
    }
    
    public long getRequestCountByType(EntryExitRequest.RequestType requestType) {
        return requestRepository.countByRequestType(requestType);
    }
    
    public long getUniqueVehicleCountInDateRange(LocalDateTime startDate, LocalDateTime endDate) {
        return requestRepository.countUniqueVehiclesInDateRange(startDate, endDate);
    }
    
    public List<Object[]> getDailyStats(LocalDateTime startDate, LocalDateTime endDate) {
        return requestRepository.getDailyStats(startDate, endDate);
    }
    
    // Excel Import/Export Methods
    
    public byte[] exportToExcel() throws IOException {
        List<EntryExitRequest> requests = requestRepository.findAll();
        return createExcelFile(requests);
    }
    
    public byte[] exportToExcelByStatus(EntryExitRequest.RequestStatus status) throws IOException {
        List<EntryExitRequest> requests = requestRepository.findByStatus(status);
        return createExcelFile(requests);
    }
    
    public byte[] exportToExcelByDateRange(LocalDateTime startDate, LocalDateTime endDate) throws IOException {
        List<EntryExitRequest> requests = requestRepository.findByRequestTimeBetween(startDate, endDate);
        return createExcelFile(requests);
    }
    
    private byte[] createExcelFile(List<EntryExitRequest> requests) throws IOException {
        Workbook workbook = new XSSFWorkbook();
        Sheet sheet = workbook.createSheet("Entry Exit Requests");
        
        // Create header row
        Row headerRow = sheet.createRow(0);
        String[] headers = {
            "ID", "Employee ID", "Employee Name", "Vehicle ID", "License Plate",
            "Request Type", "Request Time", "Status", "Approved By", "Approved At", "Notes", "Created At"
        };
        
        CellStyle headerStyle = workbook.createCellStyle();
        Font headerFont = workbook.createFont();
        headerFont.setBold(true);
        headerStyle.setFont(headerFont);
        
        for (int i = 0; i < headers.length; i++) {
            Cell cell = headerRow.createCell(i);
            cell.setCellValue(headers[i]);
            cell.setCellStyle(headerStyle);
        }
        
        // Create data rows
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
        for (int i = 0; i < requests.size(); i++) {
            EntryExitRequest request = requests.get(i);
            Row row = sheet.createRow(i + 1);
            
            row.createCell(0).setCellValue(request.getId().toString());
            row.createCell(1).setCellValue(request.getEmployee().getId().toString());
            row.createCell(2).setCellValue(request.getEmployee().getName());
            row.createCell(3).setCellValue(request.getVehicle().getId().toString());
            row.createCell(4).setCellValue(request.getVehicle().getLicensePlate());
            row.createCell(5).setCellValue(request.getRequestType().toString());
            row.createCell(6).setCellValue(request.getRequestTime().format(formatter));
            row.createCell(7).setCellValue(request.getStatus().toString());
            row.createCell(8).setCellValue(request.getApprovedBy() != null ? request.getApprovedBy() : "");
            row.createCell(9).setCellValue(request.getApprovedAt() != null ? request.getApprovedAt().format(formatter) : "");
            row.createCell(10).setCellValue(request.getNotes() != null ? request.getNotes() : "");
            row.createCell(11).setCellValue(request.getCreatedAt().format(formatter));
        }
        
        // Auto-size columns
        for (int i = 0; i < headers.length; i++) {
            sheet.autoSizeColumn(i);
        }
        
        ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
        workbook.write(outputStream);
        workbook.close();
        
        return outputStream.toByteArray();
    }
    
    public ImportResultDto importFromExcel(MultipartFile file) throws IOException {
        List<EntryExitRequestImportDto> importData = parseExcelFile(file);
        return processImportData(importData);
    }
    
    public ImportResultDto importFromCsv(MultipartFile file) throws IOException {
        List<EntryExitRequestImportDto> importData = parseCsvFile(file);
        return processImportData(importData);
    }
    
    private List<EntryExitRequestImportDto> parseExcelFile(MultipartFile file) throws IOException {
        List<EntryExitRequestImportDto> importData = new ArrayList<>();
        
        try (Workbook workbook = WorkbookFactory.create(file.getInputStream())) {
            Sheet sheet = workbook.getSheetAt(0);
            
            // Skip header row
            for (int i = 1; i <= sheet.getLastRowNum(); i++) {
                Row row = sheet.getRow(i);
                if (row == null) continue;
                
                EntryExitRequestImportDto dto = new EntryExitRequestImportDto();
                
                // Employee ID
                Cell employeeIdCell = row.getCell(1);
                if (employeeIdCell != null) {
                    dto.setEmployeeId(getCellValueAsString(employeeIdCell));
                }
                
                // Employee Name
                Cell employeeNameCell = row.getCell(2);
                if (employeeNameCell != null) {
                    dto.setEmployeeName(getCellValueAsString(employeeNameCell));
                }
                
                // License Plate
                Cell licensePlateCell = row.getCell(4);
                if (licensePlateCell != null) {
                    dto.setLicensePlate(getCellValueAsString(licensePlateCell));
                }
                
                // Request Type
                Cell requestTypeCell = row.getCell(5);
                if (requestTypeCell != null) {
                    dto.setRequestType(getCellValueAsString(requestTypeCell));
                }
                
                // Request Time
                Cell requestTimeCell = row.getCell(6);
                if (requestTimeCell != null) {
                    dto.setRequestTime(parseDateTime(getCellValueAsString(requestTimeCell)));
                }
                
                // Status
                Cell statusCell = row.getCell(7);
                if (statusCell != null) {
                    dto.setStatus(getCellValueAsString(statusCell));
                }
                
                // Approved By
                Cell approvedByCell = row.getCell(8);
                if (approvedByCell != null) {
                    dto.setApprovedBy(getCellValueAsString(approvedByCell));
                }
                
                // Approved At
                Cell approvedAtCell = row.getCell(9);
                if (approvedAtCell != null) {
                    String approvedAtStr = getCellValueAsString(approvedAtCell);
                    if (!approvedAtStr.isEmpty()) {
                        dto.setApprovedAt(parseDateTime(approvedAtStr));
                    }
                }
                
                // Notes
                Cell notesCell = row.getCell(10);
                if (notesCell != null) {
                    dto.setNotes(getCellValueAsString(notesCell));
                }
                
                importData.add(dto);
            }
        }
        
        return importData;
    }
    
    private List<EntryExitRequestImportDto> parseCsvFile(MultipartFile file) throws IOException {
        List<EntryExitRequestImportDto> importData = new ArrayList<>();
        
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(file.getInputStream(), "UTF-8"))) {
            String line;
            int lineNumber = 0;
            
            while ((line = reader.readLine()) != null) {
                lineNumber++;
                if (lineNumber == 1) {
                    // Skip header row
                    continue;
                }
                
                if (line.trim().isEmpty()) {
                    continue;
                }
                
                String[] values = parseCsvLine(line);
                if (values.length >= 8) {
                    EntryExitRequestImportDto dto = new EntryExitRequestImportDto();
                    dto.setEmployeeId(values[1]);
                    dto.setEmployeeName(values[2]);
                    // Skip vehicleId (index 3) - we use licensePlate instead
                    dto.setLicensePlate(values[4]);
                    dto.setRequestType(values[5]);
                    
                    // Parse request time
                    try {
                        LocalDateTime requestTime = LocalDateTime.parse(values[6], DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));
                        dto.setRequestTime(requestTime);
                    } catch (Exception e) {
                        // Skip this row if date parsing fails
                        continue;
                    }
                    
                    dto.setStatus(values[7]);
                    dto.setApprovedBy(values.length > 8 && !values[8].isEmpty() ? values[8] : null);
                    
                    // Parse approved at time
                    if (values.length > 9 && !values[9].isEmpty()) {
                        try {
                            LocalDateTime approvedAt = LocalDateTime.parse(values[9], DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));
                            dto.setApprovedAt(approvedAt);
                        } catch (Exception e) {
                            // Leave approvedAt as null if parsing fails
                        }
                    }
                    
                    dto.setNotes(values.length > 10 ? values[10] : null);
                    
                    importData.add(dto);
                }
            }
        }
        
        return importData;
    }
    
    private String[] parseCsvLine(String line) {
        List<String> result = new ArrayList<>();
        boolean inQuotes = false;
        StringBuilder current = new StringBuilder();
        
        for (int i = 0; i < line.length(); i++) {
            char c = line.charAt(i);
            
            if (c == '"') {
                inQuotes = !inQuotes;
            } else if (c == ',' && !inQuotes) {
                result.add(current.toString().trim());
                current = new StringBuilder();
            } else {
                current.append(c);
            }
        }
        
        result.add(current.toString().trim());
        return result.toArray(new String[0]);
    }
    
    private String getCellValueAsString(Cell cell) {
        if (cell == null) return "";
        
        switch (cell.getCellType()) {
            case STRING:
                return cell.getStringCellValue().trim();
            case NUMERIC:
                if (DateUtil.isCellDateFormatted(cell)) {
                    return cell.getDateCellValue().toString();
                } else {
                    return String.valueOf((long) cell.getNumericCellValue());
                }
            case BOOLEAN:
                return String.valueOf(cell.getBooleanCellValue());
            case FORMULA:
                return cell.getCellFormula();
            default:
                return "";
        }
    }
    
    private LocalDateTime parseDateTime(String dateTimeStr) {
        if (dateTimeStr == null || dateTimeStr.trim().isEmpty()) {
            return null;
        }
        
        try {
            DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
            return LocalDateTime.parse(dateTimeStr.trim(), formatter);
        } catch (Exception e) {
            try {
                DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss");
                return LocalDateTime.parse(dateTimeStr.trim(), formatter);
            } catch (Exception e2) {
                throw new IllegalArgumentException("Invalid date format: " + dateTimeStr);
            }
        }
    }
    
    private ImportResultDto processImportData(List<EntryExitRequestImportDto> importData) {
        List<String> errors = new ArrayList<>();
        List<EntryExitRequestDto> importedRequests = new ArrayList<>();
        int successCount = 0;
        
        for (int i = 0; i < importData.size(); i++) {
            EntryExitRequestImportDto dto = importData.get(i);
            try {
                EntryExitRequest request = createRequestFromImportDto(dto);
                EntryExitRequest savedRequest = requestRepository.save(request);
                importedRequests.add(new EntryExitRequestDto(savedRequest));
                successCount++;
            } catch (Exception e) {
                errors.add("Row " + (i + 2) + ": " + e.getMessage());
            }
        }
        
        return new ImportResultDto(
            importData.size(),
            successCount,
            errors.size(),
            errors,
            importedRequests
        );
    }
    
    private EntryExitRequest createRequestFromImportDto(EntryExitRequestImportDto dto) {
        // Find employee by ID or name
        Employee employee = employeeRepository.findById(UUID.fromString(dto.getEmployeeId()))
            .orElse(employeeRepository.findByName(dto.getEmployeeName())
                .orElseThrow(() -> new ResourceNotFoundException("Employee not found: " + dto.getEmployeeName())));
        
        // Find vehicle by license plate
        Vehicle vehicle = vehicleRepository.findByLicensePlate(dto.getLicensePlate())
            .orElseThrow(() -> new ResourceNotFoundException("Vehicle not found: " + dto.getLicensePlate()));
        
        EntryExitRequest request = new EntryExitRequest();
        request.setEmployee(employee);
        request.setVehicle(vehicle);
        request.setRequestType(EntryExitRequest.RequestType.valueOf(dto.getRequestType().toLowerCase()));
        request.setRequestTime(dto.getRequestTime());
        request.setStatus(EntryExitRequest.RequestStatus.valueOf(dto.getStatus().toLowerCase()));
        request.setApprovedBy(dto.getApprovedBy());
        request.setApprovedAt(dto.getApprovedAt());
        request.setNotes(dto.getNotes());
        request.setCreatedAt(LocalDateTime.now());
        
        return request;
    }
    
    public byte[] createExcelTemplate() throws IOException {
        Workbook workbook = new XSSFWorkbook();
        Sheet sheet = workbook.createSheet("Entry Exit Requests Template");
        
        // Create header row
        Row headerRow = sheet.createRow(0);
        String[] headers = {
            "ID", "Employee ID", "Employee Name", "Vehicle ID", "License Plate",
            "Request Type", "Request Time", "Status", "Approved By", "Approved At", "Notes", "Created At"
        };
        
        CellStyle headerStyle = workbook.createCellStyle();
        Font headerFont = workbook.createFont();
        headerFont.setBold(true);
        headerStyle.setFont(headerFont);
        
        for (int i = 0; i < headers.length; i++) {
            Cell cell = headerRow.createCell(i);
            cell.setCellValue(headers[i]);
            cell.setCellStyle(headerStyle);
        }
        
        // Add sample data row
        Row sampleRow = sheet.createRow(1);
        sampleRow.createCell(0).setCellValue("(Auto-generated)");
        sampleRow.createCell(1).setCellValue("1");
        sampleRow.createCell(2).setCellValue("Nguyễn Văn An");
        sampleRow.createCell(3).setCellValue("1");
        sampleRow.createCell(4).setCellValue("30A-12345");
        sampleRow.createCell(5).setCellValue("entry");
        sampleRow.createCell(6).setCellValue("2024-01-15 08:30:00");
        sampleRow.createCell(7).setCellValue("pending");
        sampleRow.createCell(8).setCellValue("");
        sampleRow.createCell(9).setCellValue("");
        sampleRow.createCell(10).setCellValue("Sample notes");
        sampleRow.createCell(11).setCellValue("(Auto-generated)");
        
        // Auto-size columns
        for (int i = 0; i < headers.length; i++) {
            sheet.autoSizeColumn(i);
        }
        
        ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
        workbook.write(outputStream);
        workbook.close();
        
        return outputStream.toByteArray();
    }
    
    public VehicleCheckResponse checkVehiclePermission(VehicleCheckRequest request, MultipartFile imageFile) {
        // Find the vehicle by license plate
        Vehicle vehicle = vehicleRepository.findByLicensePlate(request.getLicensePlateNumber())
                .orElse(null);
        
        if (vehicle == null) {
            return new VehicleCheckResponse(
                false, 
                "Không tìm thấy xe có biển kiểm soát " + request.getLicensePlateNumber(),
                request.getLicensePlateNumber(),
                request.getType()
            );
        }
        
        // Convert request type to enum
        EntryExitRequest.RequestType requestType;
        try {
            requestType = EntryExitRequest.RequestType.valueOf(request.getType().toLowerCase());
        } catch (IllegalArgumentException e) {
            return new VehicleCheckResponse(
                false,
                "Loại yêu cầu không hợp lệ: " + request.getType(),
                request.getLicensePlateNumber(),
                request.getType()
            );
        }
        
        // Check if there's an approved request for this vehicle and type
        List<EntryExitRequest> approvedRequests = requestRepository
                .findByVehicleAndRequestTypeAndStatus(
                    vehicle, 
                    requestType, 
                    EntryExitRequest.RequestStatus.approved
                );
        
        if (approvedRequests.isEmpty()) {
            String actionText = request.getType().toLowerCase().equals("entry") ? "vào" : "ra";
            return new VehicleCheckResponse(
                false,
                "Xe có biển kiểm soát " + request.getLicensePlateNumber() + " không được phép " + actionText,
                request.getLicensePlateNumber(),
                request.getType()
            );
        }
        
        // Vehicle is approved - handle image upload and save to database
        String imagePath = null;
        if (imageFile != null && !imageFile.isEmpty()) {
            try {
                // Validate image before processing
                if (!imageProcessingUtil.isValidImage(imageFile)) {
                    System.err.println("Invalid image file provided for vehicle: " + request.getLicensePlateNumber());
                } else {
                    imagePath = uploadVehicleImage(request.getLicensePlateNumber(), request.getType(), imageFile);
                    
                    // Save image path to the first approved request
                    EntryExitRequest approvedRequest = approvedRequests.get(0);
                    if (request.getType().toLowerCase().equals("entry")) {
                        approvedRequest.setEntryImagePath(imagePath);
                    } else {
                        approvedRequest.setExitImagePath(imagePath);
                    }
                    
                    // Mark request as completed when image upload is successful
                    approvedRequest.complete();
                    requestRepository.save(approvedRequest);
                }
                
            } catch (IOException e) {
                // Log error but don't fail the request
                System.err.println("Error uploading image for vehicle " + request.getLicensePlateNumber() + ": " + e.getMessage());
            } catch (IllegalArgumentException e) {
                // Log validation error
                System.err.println("Image validation failed for vehicle " + request.getLicensePlateNumber() + ": " + e.getMessage());
            }
        }
        
        // Vehicle is approved
        String actionText = request.getType().toLowerCase().equals("entry") ? "vào" : "ra";
        return new VehicleCheckResponse(
            true,
            "Xe có biển kiểm soát " + request.getLicensePlateNumber() + " được phép " + actionText,
            request.getLicensePlateNumber(),
            request.getType(),
            imagePath
        );
    }
    
    private String uploadVehicleImage(String licensePlate, String type, MultipartFile imageFile) throws IOException {
        // Validate image file
        if (!imageProcessingUtil.isValidImage(imageFile)) {
            throw new IllegalArgumentException("Invalid image file");
        }
        
        // Process and optimize the image
        byte[] processedImageData = imageProcessingUtil.processImage(imageFile);
        
        // Create directory structure: images/entry or images/exit
        String folderName = type.toLowerCase();
        Path uploadDir = Paths.get("images", folderName);
        
        // Create directories if they don't exist
        if (!Files.exists(uploadDir)) {
            Files.createDirectories(uploadDir);
        }
        
        // Generate unique filename: licensePlate_timestamp.jpg (always use jpg for processed images)
        String timestamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd_HH-mm-ss"));
        String filename = licensePlate + "_" + timestamp + "." + imageProcessingUtil.getProcessedImageExtension();
        
        // Save processed image file
        Path filePath = uploadDir.resolve(filename);
        Files.write(filePath, processedImageData);
        
        // Return the relative path
        return "/images/" + folderName + "/" + filename;
    }
    
    public RequestImagesDto getRequestImages(UUID requestId) {
        EntryExitRequest request = requestRepository.findById(requestId)
                .orElseThrow(() -> new ResourceNotFoundException("Request not found with id: " + requestId));
        
        return new RequestImagesDto(
                request.getId().toString(),
                request.getVehicle().getLicensePlate(),
                request.getEntryImagePath(),
                request.getExitImagePath()
        );
    }
}
