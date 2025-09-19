package com.vehiclemanagement.service;

import com.vehiclemanagement.entity.User;
import com.vehiclemanagement.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class DataSeederService implements CommandLineRunner {
    
    private static final Logger logger = LoggerFactory.getLogger(DataSeederService.class);
    
    @Autowired
    private UserRepository userRepository;
    
    @Autowired
    private PasswordEncoder passwordEncoder;
    
    @Override
    public void run(String... args) throws Exception {
        seedAdminUser();
    }
    
    private void seedAdminUser() {
        // Check if admin user already exists
        if (userRepository.findByUsername("admin").isPresent()) {
            logger.info("Admin user already exists, skipping seed data creation");
            return;
        }
        
        // Check if database is empty
        long userCount = userRepository.count();
        if (userCount > 0) {
            logger.info("Database already contains {} users, skipping seed data creation", userCount);
            return;
        }
        
        logger.info("Database is empty, creating seed data...");
        
        // Create admin user
        User adminUser = User.builder()
                .username("admin")
                .email("admin@vehiclemanagement.com")
                .password(passwordEncoder.encode("SecurePass123!"))
                .firstName("System")
                .lastName("Administrator")
                .role(User.Role.ADMIN)
                .status(User.UserStatus.ACTIVE)
                .build();
        
        userRepository.save(adminUser);
        
        // Create a regular user for testing
        User regularUser = User.builder()
                .username("user")
                .email("user@vehiclemanagement.com")
                .password(passwordEncoder.encode("UserPass123!"))
                .firstName("Regular")
                .lastName("User")
                .role(User.Role.USER)
                .status(User.UserStatus.ACTIVE)
                .build();
        
        userRepository.save(regularUser);
        
        logger.info("✅ Seed data created successfully!");
        logger.info("📋 Created users:");
        logger.info("   👑 Admin User:");
        logger.info("      Username: admin");
        logger.info("      Password: SecurePass123!");
        logger.info("      Email: admin@vehiclemanagement.com");
        logger.info("      Role: ADMIN");
        logger.info("   👤 Regular User:");
        logger.info("      Username: user");
        logger.info("      Password: UserPass123!");
        logger.info("      Email: user@vehiclemanagement.com");
        logger.info("      Role: USER");
    }
}
