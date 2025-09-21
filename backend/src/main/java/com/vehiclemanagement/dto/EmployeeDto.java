package com.vehiclemanagement.dto;

import com.vehiclemanagement.entity.Employee;
import com.vehiclemanagement.entity.Vehicle;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class EmployeeDto {
    
    private UUID id;
    
    @NotBlank(message = "Employee ID is required")
    private String employeeId;
    
    @NotBlank(message = "Name is required")
    private String name;
    
    private String firstName;
    private String lastName;
    
    private String email;
    
    private String phone;
    
    @NotBlank(message = "Department is required")
    private String department;
    
    private UUID departmentId;
    private String position;
    private String rank;
    private String jobTitle;
    private String militaryCivilian;
    private LocalDate hireDate;
    private LocalDate birthDate;
    private Employee.Gender gender;
    private String address;
    private String emergencyContact;
    private String emergencyPhone;
    private BigDecimal salary;
    private Employee.EmployeeStatus status;
    private String avatar;
    private Employee.AccessLevel accessLevel;
    private List<String> permissions;
    private Vehicle.VehicleType vehicleType;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    
    // Constructor from entity with vehicle type
    public EmployeeDto(Employee employee, Vehicle.VehicleType vehicleType) {
        this.id = employee.getId();
        this.employeeId = employee.getEmployeeId();
        this.name = employee.getName();
        this.firstName = employee.getFirstName();
        this.lastName = employee.getLastName();
        this.email = employee.getEmail();
        this.phone = employee.getPhone();
        this.department = employee.getDepartment();
        this.departmentId = employee.getDepartmentId();
        this.position = employee.getPosition();
        this.rank = employee.getRank();
        this.jobTitle = employee.getJobTitle();
        this.militaryCivilian = employee.getMilitaryCivilian();
        this.hireDate = employee.getHireDate();
        this.birthDate = employee.getBirthDate();
        this.gender = employee.getGender();
        this.address = employee.getAddress();
        this.emergencyContact = employee.getEmergencyContact();
        this.emergencyPhone = employee.getEmergencyPhone();
        this.salary = employee.getSalary();
        this.status = employee.getStatus();
        this.avatar = employee.getAvatar();
        this.accessLevel = employee.getAccessLevel();
        this.permissions = employee.getPermissions();
        this.vehicleType = vehicleType;
        this.createdAt = employee.getCreatedAt();
        this.updatedAt = employee.getUpdatedAt();
    }
    
    // Constructor from entity (backward compatibility)
    public EmployeeDto(Employee employee) {
        this(employee, null);
    }
}