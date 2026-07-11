package com.vehiclemanagement.service;

import com.vehiclemanagement.dto.VehicleDto;
import com.vehiclemanagement.entity.User;
import com.vehiclemanagement.entity.Vehicle;
import com.vehiclemanagement.exception.ResourceNotFoundException;
import com.vehiclemanagement.repository.UserRepository;
import com.vehiclemanagement.repository.VehicleRepository;
import com.vehiclemanagement.security.SiteAccess;
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
    private UserRepository userRepository;

    @Mock
    private SiteAccess siteAccess;

    @InjectMocks
    private VehicleService vehicleService;

    private Vehicle vehicle;

    @BeforeEach
    void setUp() {
        lenient().when(siteAccess.isRestricted()).thenReturn(false);

        User owner = User.builder()
                .id(UUID.randomUUID())
                .username("test-driver")
                .email("driver@example.com")
                .password("pw")
                .build();

        vehicle = Vehicle.builder()
                .id(UUID.randomUUID())
                .licensePlate("51A-12345")
                .vehicleType(Vehicle.VehicleType.car)
                .status(Vehicle.VehicleStatus.approved)
                .registrationDate(LocalDate.now())
                .owner(owner)
                .build();
    }

    @Test
    void userRole_enumHasExpectedValues() {
        assertEquals(4, User.Role.values().length);
    }

    @Test
    void userRole_allExpectedValuesPresent() {
        assertDoesNotThrow(() -> User.Role.valueOf("PLATFORM_ADMIN"));
        assertDoesNotThrow(() -> User.Role.valueOf("TENANT_ADMIN"));
        assertDoesNotThrow(() -> User.Role.valueOf("SITE_MANAGER"));
        assertDoesNotThrow(() -> User.Role.valueOf("MEMBER"));
    }

    @Test
    void canApprove_adminsReturnTrue() {
        User platformAdmin = User.builder().role(User.Role.PLATFORM_ADMIN).username("pa").email("a@test.com").password("pw").build();
        User tenantAdmin = User.builder().role(User.Role.TENANT_ADMIN).username("ta").email("b@test.com").password("pw").build();
        User siteManager = User.builder().role(User.Role.SITE_MANAGER).username("sm").email("c@test.com").password("pw").build();

        assertFalse(platformAdmin.canApprove());
        assertTrue(tenantAdmin.canApprove());
        assertTrue(siteManager.canApprove());
        assertTrue(platformAdmin.isPlatformAdmin());
        assertFalse(platformAdmin.isAdmin());
        assertTrue(tenantAdmin.isAdmin());
        assertTrue(siteManager.isSiteManager());
        assertFalse(siteManager.isAdmin());
    }

    @Test
    void canApprove_memberReturnsFalse() {
        User user = User.builder().role(User.Role.MEMBER).username("user").email("c@test.com").password("pw").build();
        assertFalse(user.canApprove());
    }

    @Test
    void canViewAllLogs_adminsReturnTrue() {
        User platformAdmin = User.builder().role(User.Role.PLATFORM_ADMIN).username("pa").email("a@test.com").password("pw").build();
        User tenantAdmin = User.builder().role(User.Role.TENANT_ADMIN).username("ta").email("b@test.com").password("pw").build();

        assertFalse(platformAdmin.canViewAllLogs());
        assertTrue(tenantAdmin.canViewAllLogs());
    }

    @Test
    void canViewAllLogs_memberReturnsFalse() {
        User user = User.builder().role(User.Role.MEMBER).username("user").email("c@test.com").password("pw").build();
        assertFalse(user.canViewAllLogs());
    }

    @Test
    void approveVehicle_setsStatusToApproved() {
        vehicle.setStatus(Vehicle.VehicleStatus.rejected);
        when(vehicleRepository.findById(vehicle.getId())).thenReturn(Optional.of(vehicle));
        when(vehicleRepository.save(vehicle)).thenReturn(vehicle);

        vehicleService.approveVehicle(vehicle.getId());

        assertEquals(Vehicle.VehicleStatus.approved, vehicle.getStatus());
        verify(vehicleRepository).save(vehicle);
    }

    @Test
    void rejectVehicle_setsStatusToRejected() {
        vehicle.setStatus(Vehicle.VehicleStatus.approved);
        when(vehicleRepository.findById(vehicle.getId())).thenReturn(Optional.of(vehicle));
        when(vehicleRepository.save(vehicle)).thenReturn(vehicle);

        vehicleService.rejectVehicle(vehicle.getId());

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
