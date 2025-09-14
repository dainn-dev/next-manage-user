package com.vehiclemanagement.dto;

import com.vehiclemanagement.entity.Employee;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public class EmployeeDto {
    
    private UUID id;
    
    @NotBlank(message = "Employee ID is required")
    private String employeeId;
    
    @NotBlank(message = "Name is required")
    private String name;
    
    @NotBlank(message = "First name is required")
    private String firstName;
    
    @NotBlank(message = "Last name is required")
    private String lastName;
    
    @Email(message = "Email should be valid")
    @NotBlank(message = "Email is required")
    private String email;
    
    @NotBlank(message = "Phone is required")
    private String phone;
    
    @NotBlank(message = "Department is required")
    private String department;
    
    @NotBlank(message = "Position is required")
    private String position;
    
    @NotNull(message = "Hire date is required")
    private LocalDate hireDate;
    
    private LocalDate birthDate;
    
    private Employee.Gender gender;
    
    private Employee.EmployeeStatus status;
    
    private Employee.AccessLevel accessLevel;
    
    private String address;
    
    private String avatar;
    
    private String cardNumber;
    
    private String emergencyContact;
    
    private String emergencyPhone;
    
    private BigDecimal salary;
    
    private List<String> permissions;
    
    private String notes;
    
    private LocalDateTime createdAt;
    
    private LocalDateTime updatedAt;
    
    // Constructors
    public EmployeeDto() {}
    
    public EmployeeDto(Employee employee) {
        this.id = employee.getId();
        this.employeeId = employee.getEmployeeId();
        this.name = employee.getName();
        this.firstName = employee.getFirstName();
        this.lastName = employee.getLastName();
        this.email = employee.getEmail();
        this.phone = employee.getPhone();
        this.department = employee.getDepartment();
        this.position = employee.getPosition();
        this.hireDate = employee.getHireDate();
        this.birthDate = employee.getBirthDate();
        this.gender = employee.getGender();
        this.status = employee.getStatus();
        this.accessLevel = employee.getAccessLevel();
        this.address = employee.getAddress();
        this.avatar = employee.getAvatar();
        this.cardNumber = employee.getCardNumber();
        this.emergencyContact = employee.getEmergencyContact();
        this.emergencyPhone = employee.getEmergencyPhone();
        this.salary = employee.getSalary();
        this.permissions = employee.getPermissions();
        this.createdAt = employee.getCreatedAt();
        this.updatedAt = employee.getUpdatedAt();
    }
    
    // Getters and Setters
    public UUID getId() {
        return id;
    }
    
    public void setId(UUID id) {
        this.id = id;
    }
    
    public String getEmployeeId() {
        return employeeId;
    }
    
    public void setEmployeeId(String employeeId) {
        this.employeeId = employeeId;
    }
    
    public String getName() {
        return name;
    }
    
    public void setName(String name) {
        this.name = name;
    }
    
    public String getFirstName() {
        return firstName;
    }
    
    public void setFirstName(String firstName) {
        this.firstName = firstName;
    }
    
    public String getLastName() {
        return lastName;
    }
    
    public void setLastName(String lastName) {
        this.lastName = lastName;
    }
    
    public String getEmail() {
        return email;
    }
    
    public void setEmail(String email) {
        this.email = email;
    }
    
    public String getPhone() {
        return phone;
    }
    
    public void setPhone(String phone) {
        this.phone = phone;
    }
    
    public String getDepartment() {
        return department;
    }
    
    public void setDepartment(String department) {
        this.department = department;
    }
    
    public String getPosition() {
        return position;
    }
    
    public void setPosition(String position) {
        this.position = position;
    }
    
    public LocalDate getHireDate() {
        return hireDate;
    }
    
    public void setHireDate(LocalDate hireDate) {
        this.hireDate = hireDate;
    }
    
    public LocalDate getBirthDate() {
        return birthDate;
    }
    
    public void setBirthDate(LocalDate birthDate) {
        this.birthDate = birthDate;
    }
    
    public Employee.Gender getGender() {
        return gender;
    }
    
    public void setGender(Employee.Gender gender) {
        this.gender = gender;
    }
    
    public Employee.EmployeeStatus getStatus() {
        return status;
    }
    
    public void setStatus(Employee.EmployeeStatus status) {
        this.status = status;
    }
    
    public Employee.AccessLevel getAccessLevel() {
        return accessLevel;
    }
    
    public void setAccessLevel(Employee.AccessLevel accessLevel) {
        this.accessLevel = accessLevel;
    }
    
    public String getAddress() {
        return address;
    }
    
    public void setAddress(String address) {
        this.address = address;
    }
    
    public String getAvatar() {
        return avatar;
    }
    
    public void setAvatar(String avatar) {
        this.avatar = avatar;
    }
    
    public String getCardNumber() {
        return cardNumber;
    }
    
    public void setCardNumber(String cardNumber) {
        this.cardNumber = cardNumber;
    }
    
    public String getEmergencyContact() {
        return emergencyContact;
    }
    
    public void setEmergencyContact(String emergencyContact) {
        this.emergencyContact = emergencyContact;
    }
    
    public String getEmergencyPhone() {
        return emergencyPhone;
    }
    
    public void setEmergencyPhone(String emergencyPhone) {
        this.emergencyPhone = emergencyPhone;
    }
    
    public BigDecimal getSalary() {
        return salary;
    }
    
    public void setSalary(BigDecimal salary) {
        this.salary = salary;
    }
    
    public List<String> getPermissions() {
        return permissions;
    }
    
    public void setPermissions(List<String> permissions) {
        this.permissions = permissions;
    }
    
    public String getNotes() {
        return notes;
    }
    
    public void setNotes(String notes) {
        this.notes = notes;
    }
    
    public LocalDateTime getCreatedAt() {
        return createdAt;
    }
    
    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
    
    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }
    
    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }
}
