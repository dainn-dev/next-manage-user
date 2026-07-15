package com.vehiclemanagement.parking;

import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

/** Computes and validates a pixel-to-site-local projective transform without native dependencies. */
@Service
public class HomographyCalibrationService {
    private static final double EPSILON = 1e-10;
    private static final double MAX_RMSE_METERS = 0.50;

    public HomographyCalibration calibrate(List<CalibrationControlPoint> points) {
        if (points == null || points.size() < 4) {
            throw new IllegalArgumentException("Calibration requires at least four control points");
        }
        List<CalibrationControlPoint> safe = List.copyOf(points);
        double[][] normal = new double[8][8];
        double[] rhs = new double[8];
        for (CalibrationControlPoint point : safe) {
            requireFinite(point);
            accumulate(normal, rhs,
                    new double[]{point.pixelX(), point.pixelY(), 1, 0, 0, 0,
                            -point.siteX() * point.pixelX(), -point.siteX() * point.pixelY()}, point.siteX());
            accumulate(normal, rhs,
                    new double[]{0, 0, 0, point.pixelX(), point.pixelY(), 1,
                            -point.siteY() * point.pixelX(), -point.siteY() * point.pixelY()}, point.siteY());
        }
        double[] h = solve(normal, rhs);
        List<Double> matrix = new ArrayList<>(9);
        for (double value : h) matrix.add(value);
        matrix.add(1.0);

        double squaredError = 0;
        for (CalibrationControlPoint point : safe) {
            ParkingMapPoint projected = transform(matrix, point.pixelX(), point.pixelY());
            squaredError += Math.pow(projected.x() - point.siteX(), 2)
                    + Math.pow(projected.y() - point.siteY(), 2);
        }
        double rmse = Math.sqrt(squaredError / safe.size());
        if (!Double.isFinite(rmse) || rmse > MAX_RMSE_METERS) {
            throw new IllegalArgumentException("Calibration reprojection error exceeds 0.50 metres");
        }
        return new HomographyCalibration(matrix, rmse, safe);
    }

    public ParkingMapPoint transform(List<Double> matrix, double pixelX, double pixelY) {
        if (matrix == null || matrix.size() != 9) throw new IllegalArgumentException("Homography must contain nine values");
        double denominator = matrix.get(6) * pixelX + matrix.get(7) * pixelY + matrix.get(8);
        if (Math.abs(denominator) < EPSILON) throw new IllegalArgumentException("Point is outside the calibrated projective plane");
        double x = (matrix.get(0) * pixelX + matrix.get(1) * pixelY + matrix.get(2)) / denominator;
        double y = (matrix.get(3) * pixelX + matrix.get(4) * pixelY + matrix.get(5)) / denominator;
        if (!Double.isFinite(x) || !Double.isFinite(y)) throw new IllegalArgumentException("Homography produced a non-finite point");
        return new ParkingMapPoint(x, y);
    }

    private void accumulate(double[][] normal, double[] rhs, double[] row, double value) {
        for (int i = 0; i < 8; i++) {
            rhs[i] += row[i] * value;
            for (int j = 0; j < 8; j++) normal[i][j] += row[i] * row[j];
        }
    }

    private double[] solve(double[][] matrix, double[] rhs) {
        double[][] augmented = new double[8][9];
        for (int row = 0; row < 8; row++) {
            System.arraycopy(matrix[row], 0, augmented[row], 0, 8);
            augmented[row][8] = rhs[row];
        }
        for (int column = 0; column < 8; column++) {
            int pivot = column;
            for (int row = column + 1; row < 8; row++)
                if (Math.abs(augmented[row][column]) > Math.abs(augmented[pivot][column])) pivot = row;
            if (Math.abs(augmented[pivot][column]) < EPSILON)
                throw new IllegalArgumentException("Calibration control points are degenerate or collinear");
            double[] swap = augmented[column]; augmented[column] = augmented[pivot]; augmented[pivot] = swap;
            double divisor = augmented[column][column];
            for (int j = column; j <= 8; j++) augmented[column][j] /= divisor;
            for (int row = 0; row < 8; row++) {
                if (row == column) continue;
                double factor = augmented[row][column];
                for (int j = column; j <= 8; j++) augmented[row][j] -= factor * augmented[column][j];
            }
        }
        double[] result = new double[8];
        for (int i = 0; i < 8; i++) result[i] = augmented[i][8];
        return result;
    }

    private void requireFinite(CalibrationControlPoint point) {
        if (point == null || !Double.isFinite(point.pixelX()) || !Double.isFinite(point.pixelY())
                || !Double.isFinite(point.siteX()) || !Double.isFinite(point.siteY()))
            throw new IllegalArgumentException("Calibration points must contain finite coordinates");
    }
}

