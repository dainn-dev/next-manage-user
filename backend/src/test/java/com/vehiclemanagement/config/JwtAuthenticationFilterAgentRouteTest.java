package com.vehiclemanagement.config;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

import static org.assertj.core.api.Assertions.assertThat;

class JwtAuthenticationFilterAgentRouteTest {

    private final JwtAuthenticationFilter filter = new JwtAuthenticationFilter(null, null);

    @Test
    void agentRoutesAreLeftToAgentTokenAuthenticationFilter() {
        var agentRequest = new MockHttpServletRequest("POST", "/api/agent/heartbeat");
        var userRequest = new MockHttpServletRequest("GET", "/api/cameras");

        assertThat(filter.shouldNotFilter(agentRequest)).isTrue();
        assertThat(filter.shouldNotFilter(userRequest)).isFalse();
    }
}
