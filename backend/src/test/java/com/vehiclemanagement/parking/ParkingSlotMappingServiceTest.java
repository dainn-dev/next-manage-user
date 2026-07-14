package com.vehiclemanagement.parking;

import com.vehiclemanagement.repository.ParkingSlotMappingRepository;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatIllegalArgumentException;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class ParkingSlotMappingServiceTest {

    private final ParkingSlotMappingRepository repository = mock(ParkingSlotMappingRepository.class);
    private final ParkingSlotMappingService service = new ParkingSlotMappingService(repository);
    private final UUID siteId = UUID.randomUUID();

    @Test
    void returnsNoSlotWhenPostgisFindsNoCoveringPolygon() {
        ParkingSlotMappingRequest request = request(null);
        when(repository.findCoveringSlots(request)).thenReturn(List.of());

        ParkingSlotMappingResult result = service.map(request);

        assertThat(result.status()).isEqualTo(ParkingSlotMappingStatus.NO_SLOT);
        assertThat(result.match()).isNull();
        assertThat(result.candidates()).isEmpty();
    }

    @Test
    void returnsTheOnlyCoveredSlot() {
        ParkingSlotMappingRequest request = request(null);
        ParkingSlotMappingCandidate candidate = candidate("A01");
        when(repository.findCoveringSlots(request)).thenReturn(List.of(candidate));

        ParkingSlotMappingResult result = service.map(request);

        assertThat(result.status()).isEqualTo(ParkingSlotMappingStatus.MATCHED);
        assertThat(result.match()).isEqualTo(candidate);
    }

    @Test
    void preservesTheCurrentSlotOnASharedBoundaryAndOtherwiseReturnsAmbiguous() {
        ParkingSlotMappingCandidate first = candidate("A01");
        ParkingSlotMappingCandidate second = candidate("A02");
        ParkingSlotMappingRequest unassigned = request(null);
        ParkingSlotMappingRequest assigned = request(second.slotId());
        when(repository.findCoveringSlots(unassigned)).thenReturn(List.of(first, second));
        when(repository.findCoveringSlots(assigned)).thenReturn(List.of(first, second));

        ParkingSlotMappingResult ambiguous = service.map(unassigned);
        ParkingSlotMappingResult retained = service.map(assigned);

        assertThat(ambiguous.status()).isEqualTo(ParkingSlotMappingStatus.AMBIGUOUS);
        assertThat(ambiguous.candidates()).containsExactly(first, second);
        assertThat(retained.status()).isEqualTo(ParkingSlotMappingStatus.MATCHED);
        assertThat(retained.match()).isEqualTo(second);
    }

    @Test
    void rejectsNonFiniteCoordinates() {
        assertThatIllegalArgumentException().isThrownBy(() ->
                new ParkingSlotMappingRequest(siteId, null, Double.NEGATIVE_INFINITY, 1, null));
    }

    private ParkingSlotMappingRequest request(UUID currentSlotId) {
        return new ParkingSlotMappingRequest(siteId, null, 1.5, 2.5, currentSlotId);
    }

    private ParkingSlotMappingCandidate candidate(String code) {
        return new ParkingSlotMappingCandidate(UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(),
                null, code);
    }
}
