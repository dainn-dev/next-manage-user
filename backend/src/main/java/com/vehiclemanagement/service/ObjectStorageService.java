package com.vehiclemanagement.service;

import com.vehiclemanagement.config.ObjectStorageProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.CreateBucketRequest;
import software.amazon.awssdk.services.s3.model.HeadBucketRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.model.S3Exception;

import java.util.UUID;

/** Stores processed camera-ingest snapshots with a tenant-isolated object key. */
@Service
public class ObjectStorageService {

    private static final Logger log = LoggerFactory.getLogger(ObjectStorageService.class);

    private final S3Client s3Client;
    private final ObjectStorageProperties properties;
    private volatile boolean bucketReady;

    public ObjectStorageService(S3Client s3Client, ObjectStorageProperties properties) {
        this.s3Client = s3Client;
        this.properties = properties;
    }

    /**
     * Stores a processed image using scope established by camera-key authentication.
     * The returned key is an opaque database reference; it is never a public URL.
     */
    public String storeIngestSnapshot(UUID tenantId, UUID cameraId, UUID eventId,
                                      byte[] snapshot, String contentType) {
        if (tenantId == null || cameraId == null || eventId == null) {
            throw new IllegalArgumentException("Tenant, camera, and event IDs are required for snapshot storage");
        }
        if (snapshot == null || snapshot.length == 0) {
            throw new IllegalArgumentException("Snapshot data is required");
        }

        ensureBucket();
        String key = ingestSnapshotKey(tenantId, cameraId, eventId, contentType);
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

    private String extensionFor(String contentType) {
        return switch (contentType) {
            case "image/jpeg", "image/jpg" -> "jpg";
            case "image/png" -> "png";
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
