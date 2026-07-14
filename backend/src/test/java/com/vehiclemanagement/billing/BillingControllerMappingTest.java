package com.vehiclemanagement.billing;

import org.junit.jupiter.api.Test;
import org.springframework.web.bind.annotation.GetMapping;

import java.util.Arrays;

import static org.assertj.core.api.Assertions.assertThat;

class BillingControllerMappingTest {

    @Test
    void subscriptionContractAndLegacyStatusAliasAreBothExposed() throws Exception {
        GetMapping mapping = BillingController.class.getMethod("getStatus").getAnnotation(GetMapping.class);

        assertThat(Arrays.asList(mapping.value()))
                .containsExactlyInAnyOrder("/subscription", "/status");
    }
}
