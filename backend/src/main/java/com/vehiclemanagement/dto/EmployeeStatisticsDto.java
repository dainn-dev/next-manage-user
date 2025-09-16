package com.vehiclemanagement.dto;

import java.util.Map;

public class EmployeeStatisticsDto {
    private long totalEmployees;
    private long activeEmployees;
    private long inactiveEmployees;
    private long terminatedEmployees;
    private Map<String, Long> employeesByDepartment;
    private Map<String, Long> employeesByStatus;
    private Map<String, Long> employeesByAccessLevel;
    private double averageAge;
    private long newEmployeesThisMonth;
    private long newEmployeesThisYear;

    // Constructors
    public EmployeeStatisticsDto() {}

    public EmployeeStatisticsDto(long totalEmployees, long activeEmployees, long inactiveEmployees, 
                                long terminatedEmployees, Map<String, Long> employeesByDepartment,
                                Map<String, Long> employeesByStatus, Map<String, Long> employeesByAccessLevel,
                                double averageAge, long newEmployeesThisMonth, long newEmployeesThisYear) {
        this.totalEmployees = totalEmployees;
        this.activeEmployees = activeEmployees;
        this.inactiveEmployees = inactiveEmployees;
        this.terminatedEmployees = terminatedEmployees;
        this.employeesByDepartment = employeesByDepartment;
        this.employeesByStatus = employeesByStatus;
        this.employeesByAccessLevel = employeesByAccessLevel;
        this.averageAge = averageAge;
        this.newEmployeesThisMonth = newEmployeesThisMonth;
        this.newEmployeesThisYear = newEmployeesThisYear;
    }

    // Getters and Setters
    public long getTotalEmployees() {
        return totalEmployees;
    }

    public void setTotalEmployees(long totalEmployees) {
        this.totalEmployees = totalEmployees;
    }

    public long getActiveEmployees() {
        return activeEmployees;
    }

    public void setActiveEmployees(long activeEmployees) {
        this.activeEmployees = activeEmployees;
    }

    public long getInactiveEmployees() {
        return inactiveEmployees;
    }

    public void setInactiveEmployees(long inactiveEmployees) {
        this.inactiveEmployees = inactiveEmployees;
    }

    public long getTerminatedEmployees() {
        return terminatedEmployees;
    }

    public void setTerminatedEmployees(long terminatedEmployees) {
        this.terminatedEmployees = terminatedEmployees;
    }

    public Map<String, Long> getEmployeesByDepartment() {
        return employeesByDepartment;
    }

    public void setEmployeesByDepartment(Map<String, Long> employeesByDepartment) {
        this.employeesByDepartment = employeesByDepartment;
    }

    public Map<String, Long> getEmployeesByStatus() {
        return employeesByStatus;
    }

    public void setEmployeesByStatus(Map<String, Long> employeesByStatus) {
        this.employeesByStatus = employeesByStatus;
    }

    public Map<String, Long> getEmployeesByAccessLevel() {
        return employeesByAccessLevel;
    }

    public void setEmployeesByAccessLevel(Map<String, Long> employeesByAccessLevel) {
        this.employeesByAccessLevel = employeesByAccessLevel;
    }

    public double getAverageAge() {
        return averageAge;
    }

    public void setAverageAge(double averageAge) {
        this.averageAge = averageAge;
    }

    public long getNewEmployeesThisMonth() {
        return newEmployeesThisMonth;
    }

    public void setNewEmployeesThisMonth(long newEmployeesThisMonth) {
        this.newEmployeesThisMonth = newEmployeesThisMonth;
    }

    public long getNewEmployeesThisYear() {
        return newEmployeesThisYear;
    }

    public void setNewEmployeesThisYear(long newEmployeesThisYear) {
        this.newEmployeesThisYear = newEmployeesThisYear;
    }
}
