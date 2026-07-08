package com.vehiclemanagement.service;

import com.vehiclemanagement.dto.VehicleDto;
import com.vehiclemanagement.entity.Vehicle;
import com.vehiclemanagement.util.SpreadsheetExportUtil;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Column-selectable export of vehicles to Excel/CSV. Same contract as
 * {@link EmployeeExportService}: caller passes the ids of columns to include
 * (empty = all); output preserves the canonical column order.
 */
@Service
public class VehicleExportService {

    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    private static final class Column {
        final String header;
        final Function<VehicleDto, String> extractor;

        Column(String header, Function<VehicleDto, String> extractor) {
            this.header = header;
            this.extractor = extractor;
        }
    }

    private static final LinkedHashMap<String, Column> COLUMNS = new LinkedHashMap<>();

    static {
        COLUMNS.put("licensePlate", new Column("Biển số", v -> nz(v.getLicensePlate())));
        COLUMNS.put("employeeName", new Column("Chủ xe", v -> nz(v.getEmployeeName())));
        COLUMNS.put("vehicleType", new Column("Loại xe", v -> vehicleTypeLabel(v.getVehicleType())));
        COLUMNS.put("brand", new Column("Hãng", v -> nz(v.getBrand())));
        COLUMNS.put("model", new Column("Mẫu", v -> nz(v.getModel())));
        COLUMNS.put("color", new Column("Màu", v -> nz(v.getColor())));
        COLUMNS.put("year", new Column("Năm SX", v -> v.getYear() != null ? String.valueOf(v.getYear()) : ""));
        COLUMNS.put("registrationDate", new Column("Ngày đăng ký",
                v -> v.getRegistrationDate() != null ? v.getRegistrationDate().format(DATE) : ""));
        COLUMNS.put("expiryDate", new Column("Ngày hết hạn",
                v -> v.getExpiryDate() != null ? v.getExpiryDate().format(DATE) : ""));
        COLUMNS.put("status", new Column("Trạng thái", v -> v.getStatus() != null ? v.getStatus().name() : ""));
        COLUMNS.put("fuelType", new Column("Nhiên liệu", v -> v.getFuelType() != null ? v.getFuelType().name() : ""));
        COLUMNS.put("capacity", new Column("Sức chứa", v -> v.getCapacity() != null ? String.valueOf(v.getCapacity()) : ""));
        COLUMNS.put("notes", new Column("Ghi chú", v -> nz(v.getNotes())));
    }

    private final VehicleService vehicleService;

    @Autowired
    public VehicleExportService(VehicleService vehicleService) {
        this.vehicleService = vehicleService;
    }

    public byte[] export(List<String> fields, String format) {
        List<String> selected = resolveColumns(fields);
        List<String> headers = selected.stream().map(k -> COLUMNS.get(k).header).collect(Collectors.toList());

        List<VehicleDto> vehicles = vehicleService.getAllVehicles();
        List<List<String>> rows = new ArrayList<>(vehicles.size());
        for (VehicleDto vehicle : vehicles) {
            List<String> row = new ArrayList<>(selected.size());
            for (String key : selected) {
                row.add(COLUMNS.get(key).extractor.apply(vehicle));
            }
            rows.add(row);
        }

        return "csv".equalsIgnoreCase(format)
                ? SpreadsheetExportUtil.toCsv(headers, rows)
                : SpreadsheetExportUtil.toExcel("Danh sách xe", headers, rows);
    }

    private List<String> resolveColumns(List<String> fields) {
        if (fields == null || fields.isEmpty()) {
            return new ArrayList<>(COLUMNS.keySet());
        }
        List<String> selected = COLUMNS.keySet().stream()
                .filter(fields::contains)
                .collect(Collectors.toList());
        return selected.isEmpty() ? new ArrayList<>(COLUMNS.keySet()) : selected;
    }

    private static String nz(String value) {
        return value == null ? "" : value;
    }

    private static String vehicleTypeLabel(Vehicle.VehicleType type) {
        if (type == null) {
            return "";
        }
        switch (type) {
            case car:
                return "Ô tô";
            case motorbike:
                return "Xe máy";
            case truck:
                return "Xe tải";
            case bus:
                return "Xe bus";
            default:
                return type.name();
        }
    }
}
