package com.vehiclemanagement.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "employees")
public class Employee {
    
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    
    @Column(name = "employee_id", unique = true, nullable = false)
    @NotBlank(message = "Employee ID is required")
    private String employeeId;
    
    @Column(nullable = false)
    @NotBlank(message = "Name is required")
    private String name;
    
    @Column(name = "first_name")
    private String firstName;
    
    @Column(name = "last_name")
    private String lastName;
    
    @Column(unique = true, nullable = false)
    @Email(message = "Email should be valid")
    @NotBlank(message = "Email is required")
    private String email;
    
    private String phone;
    
    private String department;
    
    private String position;
    
    @Column(name = "hire_date", nullable = false)
    @NotNull(message = "Hire date is required")
    private LocalDate hireDate;
    
    @Column(name = "birth_date")
    private LocalDate birthDate;
    
    @Enumerated(EnumType.STRING)
    private Gender gender;
    
    private String address;
    
    @Column(name = "emergency_contact")
    private String emergencyContact;
    
    @Column(name = "emergency_phone")
    private String emergencyPhone;
    
    @Column(precision = 12, scale = 2)
    private BigDecimal salary;
    
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private EmployeeStatus status = EmployeeStatus.active;
    
    private String avatar;
    
    @Column(name = "card_number")
    private String cardNumber;
    
    @Enumerated(EnumType.STRING)
    @Column(name = "access_level", nullable = false)
    private AccessLevel accessLevel = AccessLevel.general;
    
    @JdbcTypeCode(SqlTypes.JSON)
    private List<String> permissions;
    
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "custom_fields")
    private Map<String, Object> customFields;
    
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();
    
    @Column(name = "updated_at")
    private LocalDateTime updatedAt = LocalDateTime.now();
    
    @OneToMany(mappedBy = "employee", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private List<Vehicle> vehicles;
    
    @OneToMany(mappedBy = "employee", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private List<EntryExitRequest> requests;
    
    // Constructors
    public Employee() {}
    
    public Employee(String employeeId, String name, String email, String department, String position, LocalDate hireDate) {
        this.employeeId = employeeId;
        this.name = name;
        this.email = email;
        this.department = department;
        this.position = position;
        this.hireDate = hireDate;
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
    
    public Gender getGender() {
        return gender;
    }
    
    public void setGender(Gender gender) {
        this.gender = gender;
    }
    
    public String getAddress() {
        return address;
    }
    
    public void setAddress(String address) {
        this.address = address;
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
    
    public EmployeeStatus getStatus() {
        return status;
    }
    
    public void setStatus(EmployeeStatus status) {
        this.status = status;
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
    
    public AccessLevel getAccessLevel() {
        return accessLevel;
    }
    
    public void setAccessLevel(AccessLevel accessLevel) {
        this.accessLevel = accessLevel;
    }
    
    public List<String> getPermissions() {
        return permissions;
    }
    
    public void setPermissions(List<String> permissions) {
        this.permissions = permissions;
    }
    
    public Map<String, Object> getCustomFields() {
        return customFields;
    }
    
    public void setCustomFields(Map<String, Object> customFields) {
        this.customFields = customFields;
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
    
    public List<Vehicle> getVehicles() {
        return vehicles;
    }
    
    public void setVehicles(List<Vehicle> vehicles) {
        this.vehicles = vehicles;
    }
    
    public List<EntryExitRequest> getRequests() {
        return requests;
    }
    
    public void setRequests(List<EntryExitRequest> requests) {
        this.requests = requests;
    }
    
    @PreUpdate
    public void preUpdate() {
        this.updatedAt = LocalDateTime.now();
    }
    
    // Enums
    public enum Gender {
        male, female, other
    }
    
    public enum EmployeeStatus {
        active, inactive, terminated
    }
    
    public enum AccessLevel {
        general, restricted, admin
    }
}
