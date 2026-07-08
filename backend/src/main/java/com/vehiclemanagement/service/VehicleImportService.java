package com.vehiclemanagement.service;

import com.vehiclemanagement.dto.VehicleCreateResponse;
import com.vehiclemanagement.dto.VehicleDto;
import com.vehiclemanagement.dto.VehicleImportResult;
import com.vehiclemanagement.entity.Employee;
import com.vehiclemanagement.entity.Vehicle;
import com.vehiclemanagement.repository.EmployeeRepository;
import org.apache.poi.ss.usermodel.BorderStyle;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.DateUtil;
import org.apache.poi.ss.usermodel.FillPatternType;
import org.apache.poi.ss.usermodel.Font;
import org.apache.poi.ss.usermodel.IndexedColors;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.usermodel.WorkbookFactory;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

/**
 * Bulk vehicle import from Excel (.xlsx/.xls) or CSV, plus generation of the
 * matching import template. The template column order and the parser column
 * indices are defined together here so they never drift apart.
 *
 * <p>Each data row is created via {@link VehicleService#createVehicle} in its
 * own transaction, so a bad row never rolls back rows that already succeeded.
 * This service is intentionally NOT {@code @Transactional}.
 */
@Service
public class VehicleImportService {

    private static final String[] HEADERS = {
            "Mã nhân viên (*)", "Biển số (*)", "Loại xe (car/motorbike/truck/bus) (*)",
            "Hãng", "Mẫu", "Màu", "Năm SX", "Ngày đăng ký (yyyy-MM-dd) (*)",
            "Ngày hết hạn (yyyy-MM-dd)", "Nhiên liệu (gasoline/diesel/electric/hybrid)",
            "Sức chứa", "Ghi chú"
    };

    private static final int COL_EMPLOYEE_ID = 0;
    private static final int COL_LICENSE = 1;
    private static final int COL_VEHICLE_TYPE = 2;
    private static final int COL_BRAND = 3;
    private static final int COL_MODEL = 4;
    private static final int COL_COLOR = 5;
    private static final int COL_YEAR = 6;
    private static final int COL_REG_DATE = 7;
    private static final int COL_EXPIRY = 8;
    private static final int COL_FUEL = 9;
    private static final int COL_CAPACITY = 10;
    private static final int COL_NOTES = 11;

    private static final DateTimeFormatter ISO_DATE = DateTimeFormatter.ISO_LOCAL_DATE;

    private final VehicleService vehicleService;
    private final EmployeeRepository employeeRepository;

    @Autowired
    public VehicleImportService(VehicleService vehicleService, EmployeeRepository employeeRepository) {
        this.vehicleService = vehicleService;
        this.employeeRepository = employeeRepository;
    }

    /**
     * Generate an .xlsx import template: a bold header row, one example row, and
     * a reference sheet listing the accepted enum values.
     */
    public byte[] generateTemplate() {
        try (Workbook workbook = new XSSFWorkbook();
             ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Sheet sheet = workbook.createSheet("Mẫu nhập xe");

            CellStyle headerStyle = workbook.createCellStyle();
            Font headerFont = workbook.createFont();
            headerFont.setBold(true);
            headerStyle.setFont(headerFont);
            headerStyle.setFillForegroundColor(IndexedColors.GREY_25_PERCENT.getIndex());
            headerStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            headerStyle.setBorderBottom(BorderStyle.THIN);

            Row header = sheet.createRow(0);
            for (int i = 0; i < HEADERS.length; i++) {
                Cell cell = header.createCell(i);
                cell.setCellValue(HEADERS[i]);
                cell.setCellStyle(headerStyle);
            }

            String[] example = {
                    "NV001", "30A-12345", "car", "Toyota", "Vios", "Trắng",
                    "2020", "2024-01-15", "2027-01-15", "gasoline", "5", "Xe cá nhân"
            };
            Row exampleRow = sheet.createRow(1);
            for (int i = 0; i < example.length; i++) {
                exampleRow.createCell(i).setCellValue(example[i]);
            }

            for (int i = 0; i < HEADERS.length; i++) {
                sheet.autoSizeColumn(i);
            }

            Sheet ref = workbook.createSheet("Giá trị hợp lệ");
            int r = 0;
            ref.createRow(r++).createCell(0).setCellValue("Loại xe: car, motorbike, truck, bus");
            ref.createRow(r++).createCell(0).setCellValue("Nhiên liệu: gasoline, diesel, electric, hybrid");
            ref.createRow(r++).createCell(0).setCellValue("Định dạng ngày: yyyy-MM-dd (ví dụ 2024-01-15)");
            ref.createRow(r++).createCell(0).setCellValue("Mã nhân viên phải tồn tại trong hệ thống");
            ref.createRow(r).createCell(0).setCellValue("Các cột có (*) là bắt buộc");
            ref.autoSizeColumn(0);

            workbook.write(out);
            return out.toByteArray();
        } catch (IOException e) {
            throw new RuntimeException("Không thể tạo file mẫu: " + e.getMessage(), e);
        }
    }

    public VehicleImportResult importVehicles(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("File rỗng hoặc không được cung cấp");
        }
        String name = file.getOriginalFilename();
        boolean csv = name != null && name.toLowerCase().endsWith(".csv");
        List<RowData> rows = csv ? readCsv(file) : readExcel(file);

        VehicleImportResult result = new VehicleImportResult();
        for (RowData row : rows) {
            result.incrementTotal();
            String license = get(row.cells, COL_LICENSE);
            try {
                VehicleDto dto = toDto(row.cells);
                VehicleCreateResponse response = vehicleService.createVehicle(dto);
                if (response.isAlreadyExists()) {
                    result.incrementSkipped();
                    result.addError(row.displayRow, license, "Đã tồn tại trong hệ thống, bỏ qua");
                } else {
                    result.incrementSuccess();
                }
            } catch (Exception e) {
                result.incrementFailure();
                result.addError(row.displayRow, license, e.getMessage());
            }
        }
        return result;
    }

    private VehicleDto toDto(String[] cells) {
        String employeeCode = get(cells, COL_EMPLOYEE_ID);
        if (isBlank(employeeCode)) {
            throw new IllegalArgumentException("Thiếu mã nhân viên");
        }
        Employee employee = employeeRepository.findByEmployeeId(employeeCode)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy nhân viên có mã: " + employeeCode));

        String license = get(cells, COL_LICENSE);
        if (isBlank(license)) {
            throw new IllegalArgumentException("Thiếu biển số");
        }

        Vehicle.VehicleType vehicleType = parseVehicleType(get(cells, COL_VEHICLE_TYPE));
        LocalDate registrationDate = parseDate(get(cells, COL_REG_DATE), "Ngày đăng ký");
        LocalDate expiryDate = parseDateOptional(get(cells, COL_EXPIRY), "Ngày hết hạn");
        Vehicle.FuelType fuelType = parseFuelOptional(get(cells, COL_FUEL));

        return VehicleDto.builder()
                .employeeId(employee.getId())
                .licensePlate(license)
                .vehicleType(vehicleType)
                .brand(nullIfBlank(get(cells, COL_BRAND)))
                .model(nullIfBlank(get(cells, COL_MODEL)))
                .color(nullIfBlank(get(cells, COL_COLOR)))
                .year(parseIntOptional(get(cells, COL_YEAR), "Năm SX"))
                .registrationDate(registrationDate)
                .expiryDate(expiryDate)
                .fuelType(fuelType)
                .capacity(parseIntOptional(get(cells, COL_CAPACITY), "Sức chứa"))
                .notes(nullIfBlank(get(cells, COL_NOTES)))
                .status(Vehicle.VehicleStatus.approved)
                .build();
    }

    // ----- File reading -----

    private List<RowData> readExcel(MultipartFile file) {
        try (InputStream in = file.getInputStream();
             Workbook workbook = WorkbookFactory.create(in)) {
            Sheet sheet = workbook.getSheetAt(0);
            List<RowData> rows = new ArrayList<>();
            for (Row row : sheet) {
                if (row.getRowNum() == 0) {
                    continue; // header
                }
                String[] cells = new String[HEADERS.length];
                boolean empty = true;
                for (int c = 0; c < HEADERS.length; c++) {
                    cells[c] = cellToString(row.getCell(c));
                    if (!cells[c].isBlank()) {
                        empty = false;
                    }
                }
                if (empty) {
                    continue;
                }
                rows.add(new RowData(row.getRowNum() + 1, cells));
            }
            return rows;
        } catch (IOException e) {
            throw new RuntimeException("Không đọc được file Excel: " + e.getMessage(), e);
        }
    }

    private List<RowData> readCsv(MultipartFile file) {
        try {
            String content = new String(file.getBytes(), StandardCharsets.UTF_8);
            if (content.startsWith("﻿")) {
                content = content.substring(1); // strip BOM
            }
            String[] lines = content.split("\r\n|\n|\r");
            List<RowData> rows = new ArrayList<>();
            for (int i = 0; i < lines.length; i++) {
                if (i == 0 || lines[i].isBlank()) {
                    continue; // header / blank line
                }
                String[] parsed = parseCsvLine(lines[i]);
                String[] cells = new String[HEADERS.length];
                for (int c = 0; c < HEADERS.length; c++) {
                    cells[c] = c < parsed.length ? parsed[c].trim() : "";
                }
                rows.add(new RowData(i + 1, cells));
            }
            return rows;
        } catch (IOException e) {
            throw new RuntimeException("Không đọc được file CSV: " + e.getMessage(), e);
        }
    }

    private static String[] parseCsvLine(String line) {
        List<String> fields = new ArrayList<>();
        StringBuilder cur = new StringBuilder();
        boolean inQuotes = false;
        for (int i = 0; i < line.length(); i++) {
            char ch = line.charAt(i);
            if (inQuotes) {
                if (ch == '"') {
                    if (i + 1 < line.length() && line.charAt(i + 1) == '"') {
                        cur.append('"');
                        i++;
                    } else {
                        inQuotes = false;
                    }
                } else {
                    cur.append(ch);
                }
            } else {
                if (ch == '"') {
                    inQuotes = true;
                } else if (ch == ',') {
                    fields.add(cur.toString());
                    cur.setLength(0);
                } else {
                    cur.append(ch);
                }
            }
        }
        fields.add(cur.toString());
        return fields.toArray(new String[0]);
    }

    private static String cellToString(Cell cell) {
        if (cell == null) {
            return "";
        }
        switch (cell.getCellType()) {
            case STRING:
                return cell.getStringCellValue().trim();
            case BOOLEAN:
                return String.valueOf(cell.getBooleanCellValue());
            case NUMERIC:
                if (DateUtil.isCellDateFormatted(cell)) {
                    return cell.getLocalDateTimeCellValue().toLocalDate().toString();
                }
                double d = cell.getNumericCellValue();
                if (d == Math.floor(d) && !Double.isInfinite(d)) {
                    return String.valueOf((long) d);
                }
                return String.valueOf(d);
            case FORMULA:
                try {
                    return cell.getStringCellValue().trim();
                } catch (IllegalStateException e) {
                    return String.valueOf(cell.getNumericCellValue());
                }
            default:
                return "";
        }
    }

    // ----- Parsing helpers -----

    private static Vehicle.VehicleType parseVehicleType(String raw) {
        if (isBlank(raw)) {
            throw new IllegalArgumentException("Thiếu loại xe (car/motorbike/truck/bus)");
        }
        try {
            return Vehicle.VehicleType.valueOf(raw.trim().toLowerCase());
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Loại xe không hợp lệ: " + raw + " (car/motorbike/truck/bus)");
        }
    }

    private static Vehicle.FuelType parseFuelOptional(String raw) {
        if (isBlank(raw)) {
            return null;
        }
        try {
            return Vehicle.FuelType.valueOf(raw.trim().toLowerCase());
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Nhiên liệu không hợp lệ: " + raw + " (gasoline/diesel/electric/hybrid)");
        }
    }

    private static LocalDate parseDate(String raw, String fieldLabel) {
        if (isBlank(raw)) {
            throw new IllegalArgumentException("Thiếu " + fieldLabel + " (yyyy-MM-dd)");
        }
        try {
            return LocalDate.parse(raw.trim(), ISO_DATE);
        } catch (Exception e) {
            throw new IllegalArgumentException(fieldLabel + " không hợp lệ: " + raw + " (định dạng yyyy-MM-dd)");
        }
    }

    private static LocalDate parseDateOptional(String raw, String fieldLabel) {
        if (isBlank(raw)) {
            return null;
        }
        return parseDate(raw, fieldLabel);
    }

    private static Integer parseIntOptional(String raw, String fieldLabel) {
        if (isBlank(raw)) {
            return null;
        }
        String trimmed = raw.trim();
        try {
            return Integer.valueOf(trimmed);
        } catch (NumberFormatException e) {
            try {
                return (int) Double.parseDouble(trimmed);
            } catch (NumberFormatException ex) {
                throw new IllegalArgumentException(fieldLabel + " không hợp lệ: " + raw);
            }
        }
    }

    private static String get(String[] cells, int index) {
        if (cells == null || index >= cells.length || cells[index] == null) {
            return "";
        }
        return cells[index].trim();
    }

    private static boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }

    private static String nullIfBlank(String value) {
        return isBlank(value) ? null : value.trim();
    }

    private static final class RowData {
        final int displayRow;
        final String[] cells;

        RowData(int displayRow, String[] cells) {
            this.displayRow = displayRow;
            this.cells = cells;
        }
    }
}
