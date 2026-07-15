package com.vehiclemanagement.repository;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vehiclemanagement.parking.CalibrationVersionView;
import com.vehiclemanagement.parking.HomographyCalibration;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.Types;
import java.util.List;
import java.util.UUID;

@Repository
public class ParkingMapCommissioningRepository {
    private final NamedParameterJdbcTemplate jdbc;
    private final ObjectMapper objectMapper;

    public ParkingMapCommissioningRepository(NamedParameterJdbcTemplate jdbc, ObjectMapper objectMapper) {
        this.jdbc = jdbc;
        this.objectMapper = objectMapper;
    }

    public boolean isOverviewCameraAtSite(UUID cameraId, UUID siteId) {
        Boolean result = jdbc.queryForObject("""
                SELECT EXISTS(SELECT 1 FROM camera
                 WHERE id=:cameraId AND site_id=:siteId AND role='OVERVIEW')
                """, params(siteId, cameraId), Boolean.class);
        return Boolean.TRUE.equals(result);
    }

    public CalibrationVersionView saveCalibration(UUID siteId, UUID cameraId, HomographyCalibration calibration) {
        Integer next = jdbc.queryForObject("""
                SELECT COALESCE(MAX(version_number), 0) + 1
                  FROM camera_calibration_version WHERE camera_id=:cameraId
                """, params(siteId, cameraId), Integer.class);
        int version = next == null ? 1 : next;
        UUID id = UUID.randomUUID();
        Double[] matrix = calibration.matrix().toArray(Double[]::new);
        jdbc.update("""
                INSERT INTO camera_calibration_version(
                    id, site_id, camera_id, version_number, control_points,
                    homography, reprojection_error, status)
                VALUES (:id, :siteId, :cameraId, :version, CAST(:points AS jsonb),
                        :matrix, :error, 'valid')
                """, params(siteId, cameraId)
                .addValue("id", id, Types.OTHER)
                .addValue("version", version)
                .addValue("points", json(calibration.controlPoints()))
                .addValue("matrix", matrix)
                .addValue("error", calibration.reprojectionError()));
        return new CalibrationVersionView(id, siteId, cameraId, version, calibration.matrix(),
                calibration.reprojectionError(), "site-local-meters-v1");
    }

    private MapSqlParameterSource params(UUID siteId, UUID cameraId) {
        return new MapSqlParameterSource()
                .addValue("siteId", siteId, Types.OTHER)
                .addValue("cameraId", cameraId, Types.OTHER);
    }

    private String json(Object value) {
        try { return objectMapper.writeValueAsString(value); }
        catch (JsonProcessingException exception) { throw new IllegalArgumentException("Invalid calibration control points", exception); }
    }
}

