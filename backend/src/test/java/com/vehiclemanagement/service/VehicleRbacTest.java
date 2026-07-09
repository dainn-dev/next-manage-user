package com.vehiclemanagement.service;

import com.vehiclemanagement.dto.VehicleDto;
import com.vehiclemanagement.entity.Employee;
import com.vehiclemanagement.entity.User;
import com.vehiclemanagement.entity.Vehicle;
import com.vehiclemanagement.exception.ResourceNotFoundException;
import com.vehiclemanagement.repository.EmployeeRepository;
import com.vehiclemanagement.repository.VehicleRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class VehicleRbacTest {

    @Mock
    private VehicleRepository vehicleRepository;

    @Mock
    private EmployeeRepository employeeRepository;

    @InjectMocks
    private VehicleService vehicleService;

    private Vehicle vehicle;

    @BeforeEach
    void setUp() {
        Employee employee = new Employee();
        employee.setId(UUID.randomUUID());
        employee.setName("Test Driver");

        vehicle = Vehicle.builder()
                .id(UUID.randomUUID())
                .licensePlate("51A-12345")
                .vehicleType(Vehicle.VehicleType.car)
                .status(Vehicle.VehicleStatus.approved)
                .registrationDate(LocalDate.now())
                .employee(employee)
                .build();
    }

    // --- Role enum coverage ---

    @Test
    void userRole_enumHasExpectedValues() {
        // Tenant-aware RBAC role set.
        User.Role[] roles = User.Role.values();
        assertEquals(5, roles.length);
    }

    @Test
    void userRole_allExpectedValuesPresent() {
        assertDoesNotThrow(() -> User.Role.valueOf("PLATFORM_ADMIN"));
        assertDoesNotThrow(() -> User.Role.valueOf("TENANT_ADMIN"));
        assertDoesNotThrow(() -> User.Role.valueOf("SITE_MANAGER"));
        assertDoesNotThrow(() -> User.Role.valueOf("SECURITY_GUARD"));
        assertDoesNotThrow(() -> User.Role.valueOf("MEMBER"));
    }

    // --- canApprove helper ---

    @Test
    void canApprove_adminAndSiteManagerReturnTrue() {
        User admin = User.builder().role(User.Role.TENANT_ADMIN).username("admin").email("a@test.com").password("pw").build();
        User siteManager = User.builder().role(User.Role.SITE_MANAGER).username("manager").email("b@test.com").password("pw").build();

        assertTrue(admin.canApprove());
        assertTrue(siteManager.canApprove());
    }

    @Test
    void canApprove_memberAndSecurityGuardReturnFalse() {
        User user = User.builder().role(User.Role.MEMBER).username("user").email("c@test.com").password("pw").build();
        User secOfficer = User.builder().role(User.Role.SECURITY_GUARD).username("sec").email("d@test.com").password("pw").build();

        assertFalse(user.canApprove());
        assertFalse(secOfficer.canApprove());
    }

    // --- canViewAllLogs helper ---

    @Test
    void canViewAllLogs_adminSiteManagerSecurityGuardReturnTrue() {
        User admin = User.builder().role(User.Role.TENANT_ADMIN).username("admin").email("a@test.com").password("pw").build();
        User siteManager = User.builder().role(User.Role.SITE_MANAGER).username("manager").email("b@test.com").password("pw").build();
        User secOfficer = User.builder().role(User.Role.SECURITY_GUARD).username("sec").email("d@test.com").password("pw").build();

        assertTrue(admin.canViewAllLogs());
        assertTrue(siteManager.canViewAllLogs());
        assertTrue(secOfficer.canViewAllLogs());
    }

    @Test
    void canViewAllLogs_userReturnsFalse() {
        User user = User.builder().role(User.Role.MEMBER).username("user").email("c@test.com").password("pw").build();
        assertFalse(user.canViewAllLogs());
    }

    // --- approveVehicle / rejectVehicle service methods ---

    @Test
    void approveVehicle_setsStatusToApproved() {
        vehicle.setStatus(Vehicle.VehicleStatus.rejected);
        when(vehicleRepository.findById(vehicle.getId())).thenReturn(Optional.of(vehicle));
        when(vehicleRepository.save(vehicle)).thenReturn(vehicle);

        VehicleDto result = vehicleService.approveVehicle(vehicle.getId());

        assertEquals(Vehicle.VehicleStatus.approved, vehicle.getStatus());
        verify(vehicleRepository).save(vehicle);
    }

    @Test
    void rejectVehicle_setsStatusToRejected() {
        vehicle.setStatus(Vehicle.VehicleStatus.approved);
        when(vehicleRepository.findById(vehicle.getId())).thenReturn(Optional.of(vehicle));
        when(vehicleRepository.save(vehicle)).thenReturn(vehicle);

        VehicleDto result = vehicleService.rejectVehicle(vehicle.getId());

        assertEquals(Vehicle.VehicleStatus.rejected, vehicle.getStatus());
        verify(vehicleRepository).save(vehicle);
    }

    @Test
    void approveVehicle_throwsWhenVehicleNotFound() {
        UUID missingId = UUID.randomUUID();
        when(vehicleRepository.findById(missingId)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class, () -> vehicleService.approveVehicle(missingId));
    }

    @Test
    void rejectVehicle_throwsWhenVehicleNotFound() {
        UUID missingId = UUID.randomUUID();
        when(vehicleRepository.findById(missingId)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class, () -> vehicleService.rejectVehicle(missingId));
    }
}
