package com.vehiclemanagement.service;

import com.vehiclemanagement.config.ObjectStorageProperties;
import com.vehiclemanagement.config.TenantContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.CreateBucketRequest;
import software.amazon.awssdk.services.s3.model.HeadBucketRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.model.S3Exception;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;

import java.util.UUID;

/** Stores processed camera-ingest snapshots with a tenant-isolated object key. */
@Service
public class ObjectStorageService {

    private static final Logger log = LoggerFactory.getLogger(ObjectStorageService.class);

    private final S3Client s3Client;
    private final ObjectStorageProperties properties;
    private final S3Presigner s3Presigner;
    private volatile boolean bucketReady;

    public ObjectStorageService(S3Client s3Client, S3Presigner s3Presigner, ObjectStorageProperties properties) {
        this.s3Client = s3Client;
        this.s3Presigner = s3Presigner;
        this.properties = properties;
    }

    /** Resolves a stored reference without ever exposing another tenant's object key. */
    public String resolveReadUrl(String reference) {
        if (reference == null || reference.isBlank()) {
            return null;
        }
        String value = reference.trim();
        if (value.startsWith("/uploads/") && !value.startsWith("//")) {
            return value;
        }
        if (value.startsWith("http://") || value.startsWith("https://")) {
            return value;
        }
        UUID tenantId = TenantContext.getTenantId();
        String tenantPrefix = tenantId == null ? null : "tenants/" + tenantId + "/";
        if (tenantPrefix == null || !value.startsWith(tenantPrefix)) {
            log.warn("Rejected snapshot reference outside current tenant scope");
            return null;
        }
        GetObjectRequest get = GetObjectRequest.builder()
                .bucket(properties.getBucket()).key(value).build();
        return s3Presigner.presignGetObject(GetObjectPresignRequest.builder()
                        .signatureDuration(properties.getReadUrlTtl())
                        .getObjectRequest(get)
                        .build())
                .url().toExternalForm();
    }

    /**
     * Stores a processed image using scope established by camera-key authentication.
     * The returned key is an opaque database reference; it is never a public URL.
     */
    public String storeIngestSnapshot(UUID tenantId, UUID cameraId, UUID eventId,
                                      byte[] snapshot, String contentType) {
        return storeIngestSnapshot(tenantId, cameraId, eventId, null, snapshot, contentType);
    }

    public String storeIngestSnapshot(UUID tenantId, UUID cameraId, UUID eventId, String kind,
                                      byte[] snapshot, String contentType) {
        if (tenantId == null || cameraId == null || eventId == null) {
            throw new IllegalArgumentException("Tenant, camera, and event IDs are required for snapshot storage");
        }
        if (snapshot == null || snapshot.length == 0) {
            throw new IllegalArgumentException("Snapshot data is required");
        }

        ensureBucket();
        String key = kind == null ? ingestSnapshotKey(tenantId, cameraId, eventId, contentType)
                : "tenants/" + tenantId + "/cameras/" + cameraId + "/events/" + eventId
                + "/" + kind + "." + extensionFor(contentType);
        s3Client.putObject(PutObjectRequest.builder()
                        .bucket(properties.getBucket())
                        .key(key)
                        .contentType(contentType)
                        .build(),
                RequestBody.fromBytes(snapshot));
        log.debug("Stored ingest snapshot for tenant {} camera {} event {} -> {}",
                tenantId, cameraId, eventId, key);
        return key;
    }

    public String ingestSnapshotKey(UUID tenantId, UUID cameraId, UUID eventId, String contentType) {
        return "tenants/" + tenantId + "/cameras/" + cameraId + "/events/" + eventId
                + "." + extensionFor(contentType);
    }

    public String storeParkingMapStill(UUID tenantId, UUID cameraId, UUID imageId,
                                       byte[] image, String contentType) {
        if (tenantId == null || cameraId == null || imageId == null || image == null || image.length == 0) {
            throw new IllegalArgumentException("Tenant, camera, image ID, and bytes are required");
        }
        ensureBucket();
        String key = "tenants/" + tenantId + "/cameras/" + cameraId + "/parking-map-stills/"
                + imageId + "." + extensionFor(contentType);
        s3Client.putObject(PutObjectRequest.builder().bucket(properties.getBucket()).key(key)
                .contentType(contentType).build(), RequestBody.fromBytes(image));
        return key;
    }

    private String extensionFor(String contentType) {
        return switch (contentType) {
            case "image/jpeg", "image/jpg" -> "jpg";
            case "image/png" -> "png";
            case "image/webp" -> "webp";
            case "image/gif" -> "gif";
            case "image/bmp" -> "bmp";
            case "image/wbmp" -> "wbmp";
            default -> throw new IllegalArgumentException("Unsupported snapshot content type: " + contentType);
        };
    }

    private void ensureBucket() {
        if (bucketReady) {
            return;
        }
        synchronized (this) {
            if (bucketReady) {
                return;
            }
            try {
                s3Client.headBucket(HeadBucketRequest.builder().bucket(properties.getBucket()).build());
            } catch (S3Exception ex) {
                if (ex.statusCode() != 404) {
                    throw ex;
                }
                try {
                    s3Client.createBucket(CreateBucketRequest.builder().bucket(properties.getBucket()).build());
                } catch (S3Exception createEx) {
                    if (createEx.statusCode() != 409) {
                        throw createEx;
                    }
                }
            }
            bucketReady = true;
        }
    }
}
