package com.vehiclemanagement.service;

import com.vehiclemanagement.config.TenantContext;
import com.vehiclemanagement.entity.User;
import com.vehiclemanagement.platform.PlatformAdminUserService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

// Dev-only demo users. Disabled in prod via app.seed-demo-users=false; the real
// PLATFORM_ADMIN is seeded fail-closed by Flyway V42. The demo PLATFORM_ADMIN
// (admin@vehiclemanagement.com) is inserted with tenant_id NULL. Demo MEMBER is
// platform-scoped (tenant_id NULL) with an affiliation to the DEFAULT tenant
// (ADR-0603 Phase C).
@Service
@Transactional
@ConditionalOnProperty(name = "app.seed-demo-users", havingValue = "true", matchIfMissing = true)
public class DataSeederService implements CommandLineRunner {

    private static final Logger logger = LoggerFactory.getLogger(DataSeederService.class);

    private static final String DEMO_ADMIN_USERNAME = "admin";
    private static final String DEMO_ADMIN_EMAIL = "admin@vehiclemanagement.com";
    private static final String DEMO_ADMIN_PASSWORD = "SecurePass123!";

    @Autowired
    private PlatformAdminUserService platformAdminUserService;

    @Autowired
    private PlatformMemberUserService platformMemberUserService;

    @Autowired
    private UserService userService;

    @Override
    public void run(String... args) throws Exception {
        seedAdminUser();
    }

    private void seedAdminUser() {
        if (platformAdminUserService.existsByUsername(DEMO_ADMIN_USERNAME)) {
            if (platformAdminUserService.promoteToPlatformAdmin(DEMO_ADMIN_USERNAME)) {
                logger.info("Promoted existing '{}' to PLATFORM_ADMIN (tenant_id NULL)", DEMO_ADMIN_USERNAME);
            } else {
                logger.info("Admin user already exists as PLATFORM_ADMIN, skipping seed data creation");
            }
            return;
        }

        long userCount = platformAdminUserService.countAllUsers();
        if (userCount > 0) {
            logger.info("Database already contains {} users, skipping seed data creation", userCount);
            return;
        }

        logger.info("Database is empty, creating seed data...");

        platformAdminUserService.insertPlatformAdmin(
                DEMO_ADMIN_USERNAME,
                DEMO_ADMIN_EMAIL,
                DEMO_ADMIN_PASSWORD,
                "System",
                "Administrator");

        UUID memberId = platformMemberUserService.insertPlatformMember(
                "user",
                "user@vehiclemanagement.com",
                "UserPass123!",
                "Regular",
                "User",
                User.UserStatus.ACTIVE);

        UUID previous = TenantContext.getTenantId();
        TenantContext.setTenantId(TenantContext.DEFAULT_TENANT_ID);
        try {
            User memberStub = new User();
            memberStub.setId(memberId);
            memberStub.setRole(User.Role.MEMBER);
            userService.ensureMemberAffiliation(memberStub);
        } finally {
            if (previous == null) {
                TenantContext.clear();
            } else {
                TenantContext.setTenantId(previous);
            }
        }

        logger.info("Seed data created successfully");
        logger.info("Admin: {} / {} (PLATFORM_ADMIN)", DEMO_ADMIN_USERNAME, DEMO_ADMIN_PASSWORD);
        logger.info("Member: user / UserPass123! (MEMBER, platform + default affiliation)");
    }
}
