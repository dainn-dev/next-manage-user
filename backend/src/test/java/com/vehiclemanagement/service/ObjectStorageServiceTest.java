package com.vehiclemanagement.service;

import com.vehiclemanagement.config.ObjectStorageProperties;
import com.vehiclemanagement.config.TenantContext;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
class ObjectStorageServiceTest {

    private static final StaticCredentialsProvider CREDENTIALS = StaticCredentialsProvider.create(
            AwsBasicCredentials.create("test", "test"));
    private final S3Client s3 = S3Client.builder().region(Region.US_EAST_1)
            .credentialsProvider(CREDENTIALS).build();
    private final S3Presigner presigner = S3Presigner.builder().region(Region.US_EAST_1)
            .credentialsProvider(CREDENTIALS).build();
    private final ObjectStorageService service = new ObjectStorageService(
            s3, presigner, new ObjectStorageProperties());

    @AfterEach
    void clearTenant() {
        TenantContext.clear();
        s3.close();
        presigner.close();
    }

    @Test
    void preservesLegacyUploadUrls() {
        assertThat(service.resolveReadUrl("/uploads/snapshots/plate.jpg"))
                .isEqualTo("/uploads/snapshots/plate.jpg");
    }

    @Test
    void rejectsOpaqueKeysOutsideCurrentTenant() {
        TenantContext.setTenantId(UUID.fromString("00000000-0000-0000-0000-000000000001"));

        assertThat(service.resolveReadUrl(
                "tenants/00000000-0000-0000-0000-000000000002/cameras/c/events/e.jpg"))
                .isNull();
    }

    @Test
    void signsOpaqueKeysInsideCurrentTenant() {
        UUID tenantId = UUID.fromString("00000000-0000-0000-0000-000000000001");
        TenantContext.setTenantId(tenantId);

        assertThat(service.resolveReadUrl("tenants/" + tenantId + "/cameras/c/events/e.jpg"))
                .contains("X-Amz-Signature=")
                .contains("tenants/" + tenantId + "/cameras/c/events/e.jpg");
    }
}
