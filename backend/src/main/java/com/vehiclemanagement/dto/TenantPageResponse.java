package com.vehiclemanagement.dto;

import java.util.List;

public record TenantPageResponse(
        List<TenantSummaryDto> content,
        long totalElements,
        int totalPages,
        int size,
        int number,
        boolean first,
        boolean last,
        int numberOfElements) {
}
