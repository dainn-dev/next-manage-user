package com.vehiclemanagement.parking;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.UUID;

public record ParkingMapGeoJsonImportRequest(UUID sourceImageId, UUID calibrationVersionId, JsonNode geoJson) { }
