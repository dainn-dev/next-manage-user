package com.vehiclemanagement.parking;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class HomographyCalibrationServiceTest {
    private final HomographyCalibrationService service = new HomographyCalibrationService();

    @Test
    void computesPixelToMetreTransformFromFourPoints() {
        HomographyCalibration result = service.calibrate(List.of(
                new CalibrationControlPoint(0, 0, 10, 20),
                new CalibrationControlPoint(100, 0, 20, 20),
                new CalibrationControlPoint(100, 200, 20, 40),
                new CalibrationControlPoint(0, 200, 10, 40)));

        ParkingMapPoint centre = service.transform(result.matrix(), 50, 100);
        assertThat(centre.x()).isCloseTo(15, within(1e-8));
        assertThat(centre.y()).isCloseTo(30, within(1e-8));
        assertThat(result.reprojectionError()).isLessThan(1e-8);
    }

    @Test
    void rejectsInsufficientAndDegenerateControlPoints() {
        assertThatThrownBy(() -> service.calibrate(List.of()))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("four");
        assertThatThrownBy(() -> service.calibrate(List.of(
                new CalibrationControlPoint(0, 0, 0, 0),
                new CalibrationControlPoint(1, 1, 1, 1),
                new CalibrationControlPoint(2, 2, 2, 2),
                new CalibrationControlPoint(3, 3, 3, 3))))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("degenerate");
    }

    @Test
    void rejectsIllConditionedCalibrationWithOutlierSiteCoordinate() {
        // Three site coordinates cluster near (60,48) while the fourth is an outlier
        // at (8,25); with only four points the reprojection error is ~0, so without a
        // conditioning guard this would produce a "valid" but degenerate homography
        // whose projective singularity crosses the parking area.
        assertThatThrownBy(() -> service.calibrate(List.of(
                new CalibrationControlPoint(197, 50, 8, 25),
                new CalibrationControlPoint(423, 50, 67, 46),
                new CalibrationControlPoint(452, 109, 65, 47),
                new CalibrationControlPoint(182, 113, 57, 50))))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("ill-conditioned");
    }

    private static org.assertj.core.data.Offset<Double> within(double value) {
        return org.assertj.core.data.Offset.offset(value);
    }
}
