package com.vehiclemanagement.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class WebSocketServiceTest {

    @Mock
    private SimpMessagingTemplate messagingTemplate;

    @InjectMocks
    private WebSocketService webSocketService;

    @Test
    void simpleMessageWithoutGate_publishesToGlobalTopicOnly() {
        webSocketService.sendVehicleCheckMessage("76M5-1443", "entry", "welcome");

        verify(messagingTemplate).convertAndSend(eq("/topic/vehicle-check"), any(Object.class));
        verifyNoMoreInteractions(messagingTemplate);
    }

    @Test
    void simpleMessageWithGate_publishesToBothTopicsAndCarriesGateId() {
        UUID gateId = UUID.randomUUID();

        webSocketService.sendVehicleCheckMessage("76M5-1443", "entry", "welcome", gateId);

        // Global topic gets the event with the gate id embedded in the payload.
        ArgumentCaptor<Object> payloadCaptor = ArgumentCaptor.forClass(Object.class);
        verify(messagingTemplate).convertAndSend(eq("/topic/vehicle-check"), payloadCaptor.capture());
        verify(messagingTemplate).convertAndSend(eq("/topic/gate/" + gateId + "/check"), any(Object.class));

        WebSocketService.VehicleCheckMessage payload =
                (WebSocketService.VehicleCheckMessage) payloadCaptor.getValue();
        assertEquals(gateId.toString(), payload.getGateId());
        assertEquals("76M5-1443", payload.getLicensePlateNumber());
    }

    @Test
    void richPayloadWithGate_isFannedOutToBothTopics() {
        UUID gateId = UUID.randomUUID();
        Object monitorInfo = new Object();

        webSocketService.sendVehicleCheckMessage(monitorInfo, gateId);

        verify(messagingTemplate).convertAndSend("/topic/vehicle-check", monitorInfo);
        verify(messagingTemplate).convertAndSend("/topic/gate/" + gateId + "/check", monitorInfo);
    }

    @Test
    void richPayloadWithoutGate_goesToGlobalTopicOnly() {
        Object monitorInfo = new Object();

        webSocketService.sendVehicleCheckMessage(monitorInfo);

        verify(messagingTemplate).convertAndSend("/topic/vehicle-check", monitorInfo);
        verify(messagingTemplate, never()).convertAndSend(startsWith("/topic/gate/"), any(Object.class));
    }
}
