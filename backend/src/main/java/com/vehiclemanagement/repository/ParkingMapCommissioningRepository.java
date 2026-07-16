package com.vehiclemanagement.repository;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vehiclemanagement.parking.CalibrationVersionView;
import com.vehiclemanagement.parking.HomographyCalibration;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.Types;
import java.time.OffsetDateTime;
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

    public boolean sourceImageAtCamera(UUID imageId, UUID siteId, UUID cameraId) {
        if (imageId == null) return false;
        Boolean result = jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM parking_map_source_image WHERE id=:imageId AND site_id=:siteId AND camera_id=:cameraId)",
                params(siteId, cameraId).addValue("imageId", imageId, Types.OTHER), Boolean.class);
        return Boolean.TRUE.equals(result);
    }

    public CalibrationVersionView saveCalibration(UUID siteId, UUID cameraId, UUID sourceImageId, HomographyCalibration calibration) {
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
                    homography, reprojection_error, status, source_image_id)
                VALUES (:id, :siteId, :cameraId, :version, CAST(:points AS jsonb),
                        :matrix, :error, 'valid', :sourceImageId)
                """, params(siteId, cameraId)
                .addValue("id", id, Types.OTHER)
                .addValue("version", version)
                .addValue("points", json(calibration.controlPoints()))
                .addValue("matrix", matrix)
                .addValue("error", calibration.reprojectionError())
                .addValue("sourceImageId", sourceImageId, Types.OTHER));
        return calibration(id, siteId, cameraId);
    }

    public List<CalibrationVersionView> calibrations(UUID siteId, UUID cameraId) {
        return jdbc.query("""
                SELECT id,site_id,camera_id,version_number,homography,reprojection_error,
                       coordinate_space,source_image_id,status,created_at
                  FROM camera_calibration_version
                 WHERE site_id=:siteId AND camera_id=:cameraId ORDER BY version_number DESC
                """, params(siteId, cameraId), this::mapCalibration);
    }

    public CalibrationVersionView calibration(UUID id, UUID siteId, UUID cameraId) {
        return jdbc.queryForObject("""
                SELECT id,site_id,camera_id,version_number,homography,reprojection_error,
                       coordinate_space,source_image_id,status,created_at
                  FROM camera_calibration_version
                 WHERE id=:id AND site_id=:siteId AND camera_id=:cameraId
                """, params(siteId, cameraId).addValue("id", id, Types.OTHER), this::mapCalibration);
    }

    public void invalidateCalibration(UUID id, UUID siteId, UUID cameraId) {
        int changed = jdbc.update("""
                UPDATE camera_calibration_version SET status='invalid'
                 WHERE id=:id AND site_id=:siteId AND camera_id=:cameraId AND status<>'invalid'
                """, params(siteId, cameraId).addValue("id", id, Types.OTHER));
        if (changed != 1) throw new com.vehiclemanagement.exception.ConflictException(
                "Calibration is already invalid or unavailable");
    }

    private MapSqlParameterSource params(UUID siteId, UUID cameraId) {
        return new MapSqlParameterSource()
                .addValue("siteId", siteId, Types.OTHER)
                .addValue("cameraId", cameraId, Types.OTHER);
    }

    private CalibrationVersionView mapCalibration(java.sql.ResultSet rs, int row) throws java.sql.SQLException {
        Double[] matrix = (Double[]) rs.getArray("homography").getArray();
        return new CalibrationVersionView(rs.getObject("id", UUID.class),
                rs.getObject("site_id", UUID.class), rs.getObject("camera_id", UUID.class),
                rs.getInt("version_number"), List.of(matrix), rs.getDouble("reprojection_error"),
                rs.getString("coordinate_space"), rs.getObject("source_image_id", UUID.class),
                rs.getString("status"), rs.getObject("created_at", OffsetDateTime.class));
    }

    private String json(Object value) {
        try { return objectMapper.writeValueAsString(value); }
        catch (JsonProcessingException exception) { throw new IllegalArgumentException("Invalid calibration control points", exception); }
    }
}
