package com.vehiclemanagement.service;

import com.vehiclemanagement.util.ImageProcessingUtil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardOpenOption;

/**
 * Persists gate snapshot evidence &mdash; the cropped license-plate image captured
 * by the edge on a check-vehicle call (Phase 4.2) &mdash; to the local filesystem
 * and returns a web path served by the existing {@code /uploads/**} static handler
 * (see {@link com.vehiclemanagement.config.WebConfig}).
 *
 * <p>Storage is <b>best-effort</b>: capturing evidence must never fail the vehicle
 * access check, so every failure (missing file, unreadable image, IO error) is
 * swallowed and {@code null} is returned. Callers treat {@code null} as
 * "no snapshot" and leave {@link com.vehiclemanagement.entity.VehicleLog#getImagePath()}
 * unset, preserving backward-compatible behaviour for gates that do not send one.
 */
@Service
public class SnapshotStorageService {

    private static final Logger log = LoggerFactory.getLogger(SnapshotStorageService.class);

    private final ImageProcessingUtil imageProcessingUtil;

    /** Physical directory (relative to the working dir) snapshots are written to. */
    @Value("${storage.snapshot-dir:uploads/snapshots}")
    private String snapshotDir;

    /** Public URL prefix that {@link #snapshotDir} is served under by the static handler. */
    @Value("${storage.snapshot-url-prefix:/uploads/snapshots}")
    private String snapshotUrlPrefix;

    public SnapshotStorageService(ImageProcessingUtil imageProcessingUtil) {
        this.imageProcessingUtil = imageProcessingUtil;
    }

    /**
     * Store {@code snapshot} as an optimized JPEG and return its web path (e.g.
     * {@code /uploads/snapshots/plate_76M51443_1712664000000.jpg}), or {@code null}
     * when there is nothing to store or storage failed.
     *
     * @param snapshot     the uploaded image (optional; may be {@code null}/empty)
     * @param licensePlate used only to make the stored filename human-readable
     */
    public String store(MultipartFile snapshot, String licensePlate) {
        if (snapshot == null || snapshot.isEmpty()) {
            return null;
        }
        if (!imageProcessingUtil.isValidImage(snapshot)) {
            log.warn("Ignoring snapshot for plate {}: not an image (content-type={})",
                    licensePlate, snapshot.getContentType());
            return null;
        }
        try {
            byte[] data = imageProcessingUtil.processImage(snapshot);

            Path dir = Paths.get(snapshotDir);
            Files.createDirectories(dir);

            String filename = "plate_" + sanitize(licensePlate) + "_" + System.currentTimeMillis() + ".jpg";
            Path filePath = dir.resolve(filename);
            Files.write(filePath, data, StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING);

            String webPath = joinUrl(snapshotUrlPrefix, filename);
            log.debug("Stored gate snapshot for plate {} -> {}", licensePlate, webPath);
            return webPath;
        } catch (Exception e) {
            // Never fail the access check because evidence capture failed.
            log.warn("Failed to store gate snapshot for plate {}: {}", licensePlate, e.getMessage());
            return null;
        }
    }

    /** Strip everything but alphanumerics so the plate is filename-safe. */
    private String sanitize(String licensePlate) {
        if (licensePlate == null || licensePlate.isBlank()) {
            return "unknown";
        }
        String cleaned = licensePlate.replaceAll("[^A-Za-z0-9]", "");
        return cleaned.isEmpty() ? "unknown" : cleaned;
    }

    private String joinUrl(String prefix, String filename) {
        String p = prefix.endsWith("/") ? prefix.substring(0, prefix.length() - 1) : prefix;
        return p + "/" + filename;
    }
}
