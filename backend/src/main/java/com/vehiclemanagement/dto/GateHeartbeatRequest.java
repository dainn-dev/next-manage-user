package com.vehiclemanagement.dto;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

/**
 * Optional heartbeat payload. The gate id is taken from the path; the body is
 * reserved for future health details (e.g. camera up/down) and is not required.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GateHeartbeatRequest {

    /**
     * Optional free-form status note reported by the edge app.
     */
    private String note;
}
