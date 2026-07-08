package com.vehiclemanagement.service;

import com.vehiclemanagement.dto.EmployeeDto;
import com.vehiclemanagement.entity.Employee;
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
 * Column-selectable export of employees (personnel) to Excel/CSV. The set of
 * exportable columns is a canonical registry; the caller passes the ids of the
 * columns to include (empty = all) and the output preserves the canonical order
 * regardless of the order requested.
 */
@Service
public class EmployeeExportService {

    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    private static final class Column {
        final String header;
        final Function<EmployeeDto, String> extractor;

        Column(String header, Function<EmployeeDto, String> extractor) {
            this.header = header;
            this.extractor = extractor;
        }
    }

    private static final LinkedHashMap<String, Column> COLUMNS = new LinkedHashMap<>();

    static {
        COLUMNS.put("employeeId", new Column("Mã quân nhân", e -> nz(e.getEmployeeId())));
        COLUMNS.put("name", new Column("Họ tên", e -> nz(e.getName())));
        COLUMNS.put("firstName", new Column("Tên", e -> nz(e.getFirstName())));
        COLUMNS.put("lastName", new Column("Họ", e -> nz(e.getLastName())));
        COLUMNS.put("email", new Column("Email", e -> nz(e.getEmail())));
        COLUMNS.put("phone", new Column("Số điện thoại", e -> nz(e.getPhone())));
        COLUMNS.put("department", new Column("Đơn vị", e -> nz(e.getDepartment())));
        COLUMNS.put("position", new Column("Chức vụ", e -> nz(e.getPosition())));
        COLUMNS.put("rank", new Column("Cấp bậc", e -> nz(e.getRank())));
        COLUMNS.put("jobTitle", new Column("Chức danh", e -> nz(e.getJobTitle())));
        COLUMNS.put("militaryCivilian", new Column("SQ/QNCN", e -> nz(e.getMilitaryCivilian())));
        COLUMNS.put("gender", new Column("Giới tính", e -> genderLabel(e.getGender())));
        COLUMNS.put("birthDate", new Column("Ngày sinh",
                e -> e.getBirthDate() != null ? e.getBirthDate().format(DATE) : ""));
        COLUMNS.put("hireDate", new Column("Ngày nhập ngũ",
                e -> e.getHireDate() != null ? e.getHireDate().format(DATE) : ""));
        COLUMNS.put("address", new Column("Địa chỉ", e -> nz(e.getAddress())));
        COLUMNS.put("status", new Column("Trạng thái",
                e -> e.getStatus() != null ? e.getStatus().name() : ""));
    }

    private final EmployeeService employeeService;

    @Autowired
    public EmployeeExportService(EmployeeService employeeService) {
        this.employeeService = employeeService;
    }

    public byte[] export(List<String> fields, String format) {
        List<String> selected = resolveColumns(fields);
        List<String> headers = selected.stream().map(k -> COLUMNS.get(k).header).collect(Collectors.toList());

        List<EmployeeDto> employees = employeeService.getAllEmployeesList();
        List<List<String>> rows = new ArrayList<>(employees.size());
        for (EmployeeDto employee : employees) {
            List<String> row = new ArrayList<>(selected.size());
            for (String key : selected) {
                row.add(COLUMNS.get(key).extractor.apply(employee));
            }
            rows.add(row);
        }

        return "csv".equalsIgnoreCase(format)
                ? SpreadsheetExportUtil.toCsv(headers, rows)
                : SpreadsheetExportUtil.toExcel("Danh sách quân nhân", headers, rows);
    }

    private List<String> resolveColumns(List<String> fields) {
        if (fields == null || fields.isEmpty()) {
            return new ArrayList<>(COLUMNS.keySet());
        }
        // Keep canonical order, ignore unknown ids
        List<String> selected = COLUMNS.keySet().stream()
                .filter(fields::contains)
                .collect(Collectors.toList());
        return selected.isEmpty() ? new ArrayList<>(COLUMNS.keySet()) : selected;
    }

    private static String nz(String value) {
        return value == null ? "" : value;
    }

    private static String genderLabel(Employee.Gender gender) {
        if (gender == null) {
            return "";
        }
        switch (gender) {
            case male:
                return "Nam";
            case female:
                return "Nữ";
            default:
                return "Khác";
        }
    }
}
