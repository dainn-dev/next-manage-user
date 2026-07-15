package com.vehiclemanagement.config;

import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

class GateApiKeyAuthFilterTest {
    @Test
    void rejectsProtectedRequestWhenKeyIsMissingAndOpenModeIsDisabled() throws Exception {
        GateApiKeyAuthFilter filter = new GateApiKeyAuthFilter();
        ReflectionTestUtils.setField(filter, "gateApiKey", "");
        ReflectionTestUtils.setField(filter, "allowOpen", false);
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/gates/register");
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        filter.doFilter(request, response, chain);

        assertThat(response.getStatus()).isEqualTo(401);
        verify(chain, never()).doFilter(request, response);
    }

    @Test
    void acceptsOnlyTheConfiguredKey() throws Exception {
        GateApiKeyAuthFilter filter = new GateApiKeyAuthFilter();
        ReflectionTestUtils.setField(filter, "gateApiKey", "expected-secret");
        ReflectionTestUtils.setField(filter, "allowOpen", false);
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/gates/register");
        request.addHeader("X-Gate-Key", "expected-secret");
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        filter.doFilter(request, response, chain);

        verify(chain).doFilter(request, response);
    }
}

