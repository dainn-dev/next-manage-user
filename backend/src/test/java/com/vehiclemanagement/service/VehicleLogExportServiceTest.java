package com.vehiclemanagement.service;

import com.vehiclemanagement.dto.VehicleLogDto;
import com.vehiclemanagement.entity.VehicleLog;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class VehicleLogExportServiceTest {

    @Mock
    private VehicleLogService vehicleLogService;

    @InjectMocks
    private VehicleLogExportService exportService;

    private VehicleLogDto sampleLog() {
        // license plate contains a comma and notes contain a quote to exercise CSV escaping
        return VehicleLogDto.builder()
                .licensePlateNumber("30A-123,45")
                .entryExitTime(LocalDateTime.of(2026, 7, 8, 9, 30, 0))
                .type(VehicleLog.LogType.entry)
                .vehicleType(VehicleLog.VehicleCategory.internal)
                .driverName("Nguyen Van A")
                .employeeName("Tran B")
                .employeeDepartment("Phong KT")
                .purpose("Cong tac")
                .gateLocation("Cong 1")
                .notes("Ghi \"chu\"")
                .build();
    }

    @SuppressWarnings("unchecked")
    private void stubSearch(List<VehicleLogDto> logs) {
        Page<VehicleLogDto> page = new PageImpl<>(logs);
        when(vehicleLogService.searchVehicleLogs(
                any(), any(), any(), any(), any(), any(), any(Pageable.class))).thenReturn(page);
    }

    @Test
    void excel_hasHeaderRowAndOneDataRowPerLog() throws Exception {
        stubSearch(List.of(sampleLog(), sampleLog()));

        byte[] bytes = exportService.exportLogsToExcel(null, null, null, null, null, null);

        try (Workbook workbook = new XSSFWorkbook(new ByteArrayInputStream(bytes))) {
            Sheet sheet = workbook.getSheetAt(0);
            assertEquals("STT", sheet.getRow(0).getCell(0).getStringCellValue());
            // header (row 0) + 2 data rows => last row index 2
            assertEquals(2, sheet.getLastRowNum());
            assertEquals("Vào", sheet.getRow(1).getCell(3).getStringCellValue());
            assertEquals("Nội bộ", sheet.getRow(1).getCell(4).getStringCellValue());
        }
    }

    @Test
    void csv_startsWithBomAndEscapesSpecialCharacters() {
        stubSearch(List.of(sampleLog()));

        byte[] bytes = exportService.exportLogsToCsv(null, null, null, null, null, null);
        String csv = new String(bytes, StandardCharsets.UTF_8);

        assertTrue(csv.startsWith("﻿"), "CSV should start with a UTF-8 BOM");
        assertTrue(csv.contains("\"30A-123,45\""), "field with comma should be quoted");
        assertTrue(csv.contains("\"Ghi \"\"chu\"\"\""), "inner quotes should be doubled");
    }
}
