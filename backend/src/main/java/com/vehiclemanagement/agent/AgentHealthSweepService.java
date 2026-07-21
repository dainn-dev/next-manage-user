package com.vehiclemanagement.agent;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Scheduled task to mark agents and cameras offline when heartbeats/frames become stale.
 */
@Component
@Slf4j
@RequiredArgsConstructor
public class AgentHealthSweepService {

    private final AgentHealthService healthService;

    /**
     * Check for stale agent heartbeats and mark them offline.
     * Runs every 30 seconds.
     */
    @Scheduled(fixedDelay = 30000, initialDelay = 30000)
    public void sweepStaleAgents() {
        try {
            healthService.sweepStaleAgents();
        } catch (Exception e) {
            log.error("Error during agent health sweep", e);
        }
    }

    /**
     * Check for stale camera frames and mark them as error.
     * Runs every 30 seconds.
     */
    @Scheduled(fixedDelay = 30000, initialDelay = 45000)
    public void sweepStaleCameras() {
        try {
            healthService.sweepStaleCameras();
        } catch (Exception e) {
            log.error("Error during camera health sweep", e);
        }
    }
}
