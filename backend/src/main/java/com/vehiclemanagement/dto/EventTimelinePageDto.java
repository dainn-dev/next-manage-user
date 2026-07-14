package com.vehiclemanagement.dto;

import java.util.List;

public record EventTimelinePageDto(
        List<EventTimelineItemDto> content,
        int page,
        int size,
        long totalElements,
        boolean hasNext
) { }
