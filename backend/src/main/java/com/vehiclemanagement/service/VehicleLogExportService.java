package com.vehiclemanagement.service;

import com.vehiclemanagement.dto.VehicleLogDto;
import com.vehiclemanagement.entity.VehicleLog;
import org.apache.poi.ss.usermodel.BorderStyle;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.FillPatternType;
import org.apache.poi.ss.usermodel.Font;
import org.apache.poi.ss.usermodel.IndexedColors;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

/**
 * Builds Excel (.xlsx via Apache POI) and CSV exports of vehicle entry/exit
 * logs. The export always reflects the full filtered result set (not a single
 * page) by fetching up to {@link #EXPORT_LIMIT} matching rows. Access is guarded
 * at the controller layer ({@code hasAnyRole('TENANT_ADMIN','SITE_MANAGER','SECURITY_GUARD')}).
 */
@Service
public class VehicleLogExportService {

    // VehicleLog is append-only gate traffic; a single site does not approach
    // this within any realistic export window. Mirrors VehicleLogService.
    private static final int EXPORT_LIMIT = 100_000;

    private static final DateTimeFormatter DATE_TIME_FMT = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss");
    private static final LocalDateTime MIN_DATE = LocalDateTime.of(1970, 1, 1, 0, 0);

    private static final String[] LOG_HEADERS = {
            "STT", "Thời gian", "Biển số", "Hoạt động", "Loại xe",
            "Tài xế", "Chủ xe", "Mục đích", "Cổng", "Ghi chú"
    };

    private final VehicleLogService vehicleLogService;

    @Autowired
    public VehicleLogExportService(VehicleLogService vehicleLogService) {
        this.vehicleLogService = vehicleLogService;
    }

    public byte[] exportLogsToExcel(String licensePlate, VehicleLog.LogType type,
                                    VehicleLog.VehicleCategory vehicleType, String driverName,
                                    LocalDateTime startDate, LocalDateTime endDate) {
        List<VehicleLogDto> logs = fetchForExport(licensePlate, type, vehicleType, driverName, startDate, endDate);

        try (Workbook workbook = new XSSFWorkbook();
             ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Sheet sheet = workbook.createSheet("Nhật ký ra vào");

            CellStyle headerStyle = workbook.createCellStyle();
            Font headerFont = workbook.createFont();
            headerFont.setBold(true);
            headerStyle.setFont(headerFont);
            headerStyle.setFillForegroundColor(IndexedColors.GREY_25_PERCENT.getIndex());
            headerStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            headerStyle.setBorderBottom(BorderStyle.THIN);

            Row header = sheet.createRow(0);
            for (int i = 0; i < LOG_HEADERS.length; i++) {
                Cell cell = header.createCell(i);
                cell.setCellValue(LOG_HEADERS[i]);
                cell.setCellStyle(headerStyle);
            }

            int rowIdx = 1;
            for (VehicleLogDto log : logs) {
                Row row = sheet.createRow(rowIdx);
                int col = 0;
                row.createCell(col++).setCellValue(rowIdx);
                row.createCell(col++).setCellValue(log.getEntryExitTime() != null
                        ? log.getEntryExitTime().format(DATE_TIME_FMT) : "");
                row.createCell(col++).setCellValue(nullToEmpty(log.getLicensePlateNumber()));
                row.createCell(col++).setCellValue(typeLabel(log.getType()));
                row.createCell(col++).setCellValue(categoryLabel(log.getVehicleType()));
                row.createCell(col++).setCellValue(nullToEmpty(log.getDriverName()));
                row.createCell(col++).setCellValue(nullToEmpty(log.getOwnerName()));
                row.createCell(col++).setCellValue(nullToEmpty(log.getPurpose()));
                row.createCell(col++).setCellValue(nullToEmpty(log.getGateLocation()));
                row.createCell(col).setCellValue(nullToEmpty(log.getNotes()));
                rowIdx++;
            }

            for (int i = 0; i < LOG_HEADERS.length; i++) {
                sheet.autoSizeColumn(i);
            }
            sheet.createFreezePane(0, 1);

            workbook.write(out);
            return out.toByteArray();
        } catch (IOException e) {
            throw new RuntimeException("Không thể tạo file Excel: " + e.getMessage(), e);
        }
    }

    public byte[] exportLogsToCsv(String licensePlate, VehicleLog.LogType type,
                                  VehicleLog.VehicleCategory vehicleType, String driverName,
                                  LocalDateTime startDate, LocalDateTime endDate) {
        List<VehicleLogDto> logs = fetchForExport(licensePlate, type, vehicleType, driverName, startDate, endDate);

        StringBuilder sb = new StringBuilder();
        sb.append('﻿'); // UTF-8 BOM so Excel opens Vietnamese text correctly
        appendCsvRow(sb, LOG_HEADERS);

        int idx = 1;
        for (VehicleLogDto log : logs) {
            appendCsvRow(sb, new String[]{
                    String.valueOf(idx++),
                    log.getEntryExitTime() != null ? log.getEntryExitTime().format(DATE_TIME_FMT) : "",
                    nullToEmpty(log.getLicensePlateNumber()),
                    typeLabel(log.getType()),
                    categoryLabel(log.getVehicleType()),
                    nullToEmpty(log.getDriverName()),
                    nullToEmpty(log.getOwnerName()),
                    nullToEmpty(log.getPurpose()),
                    nullToEmpty(log.getGateLocation()),
                    nullToEmpty(log.getNotes())
            });
        }
        return sb.toString().getBytes(StandardCharsets.UTF_8);
    }

    private List<VehicleLogDto> fetchForExport(String licensePlate, VehicleLog.LogType type,
                                               VehicleLog.VehicleCategory vehicleType, String driverName,
                                               LocalDateTime startDate, LocalDateTime endDate) {
        LocalDateTime effectiveStart = startDate != null ? startDate : MIN_DATE;
        LocalDateTime effectiveEnd = endDate != null ? endDate : LocalDateTime.now();
        Pageable pageable = PageRequest.of(0, EXPORT_LIMIT, Sort.by("entryExitTime").descending());
        return vehicleLogService.searchVehicleLogs(
                emptyToNull(licensePlate), type, vehicleType, emptyToNull(driverName),
                effectiveStart, effectiveEnd, pageable).getContent();
    }

    private static void appendCsvRow(StringBuilder sb, String[] fields) {
        for (int i = 0; i < fields.length; i++) {
            if (i > 0) {
                sb.append(',');
            }
            sb.append(escapeCsv(fields[i]));
        }
        sb.append("\r\n");
    }

    private static String escapeCsv(String value) {
        if (value == null) {
            return "";
        }
        boolean mustQuote = value.contains(",") || value.contains("\"")
                || value.contains("\n") || value.contains("\r");
        if (!mustQuote) {
            return value;
        }
        return "\"" + value.replace("\"", "\"\"") + "\"";
    }

    private static String typeLabel(VehicleLog.LogType type) {
        if (type == null) {
            return "";
        }
        return type == VehicleLog.LogType.entry ? "Vào" : "Ra";
    }

    private static String categoryLabel(VehicleLog.VehicleCategory category) {
        if (category == null) {
            return "";
        }
        return category == VehicleLog.VehicleCategory.internal ? "Nội bộ" : "Bên ngoài";
    }

    private static String nullToEmpty(String value) {
        return value == null ? "" : value;
    }

    private static String emptyToNull(String value) {
        return (value == null || value.trim().isEmpty()) ? null : value;
    }
}
