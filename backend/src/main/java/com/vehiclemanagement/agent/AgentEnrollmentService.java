package com.vehiclemanagement.agent;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Service for generating and validating one-time enrollment codes.
 * Codes are used to pair desktop agents with sites.
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class AgentEnrollmentService {

    private static final String CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // No 0/O/1/I confusion
    private static final int CODE_LENGTH = 8;
    private static final int CODE_EXPIRY_MINUTES = 10;

    private final SiteAgentEnrollmentCodeRepository enrollmentCodeRepository;
    private final SecureRandom secureRandom = new SecureRandom();

    /**
     * Generate a new enrollment code for a site.
     * @param siteId Site to pair with
     * @param createdByUserId User who generated the code (optional)
     * @return New enrollment code entity
     */
    @Transactional
    public SiteAgentEnrollmentCode generateEnrollmentCode(UUID siteId, UUID createdByUserId) {
        String code = generateCode();

        // Ensure uniqueness (very low collision probability with 8-char alphanumeric)
        while (enrollmentCodeRepository.findByCode(code).isPresent()) {
            code = generateCode();
        }

        SiteAgentEnrollmentCode enrollmentCode = SiteAgentEnrollmentCode.builder()
            .siteId(siteId)
            .code(code)
            .expiresAt(LocalDateTime.now().plusMinutes(CODE_EXPIRY_MINUTES))
            .createdByUserId(createdByUserId)
            .build();

        enrollmentCode = enrollmentCodeRepository.save(enrollmentCode);

        log.info("Generated enrollment code {} for site {} (expires in {} min)",
            code, siteId, CODE_EXPIRY_MINUTES);

        return enrollmentCode;
    }

    /**
     * Validate and consume an enrollment code.
     * @param code Enrollment code from user input
     * @return Enrollment code entity if valid
     * @throws IllegalArgumentException if code is invalid, expired, or already used
     */
    @Transactional
    public SiteAgentEnrollmentCode validateAndConsumeCode(String code) {
        SiteAgentEnrollmentCode enrollmentCode = enrollmentCodeRepository.findByCode(code)
            .orElseThrow(() -> new IllegalArgumentException("Invalid enrollment code"));

        if (enrollmentCode.getUsedAt() != null) {
            log.warn("Enrollment code {} already used by agent {}",
                code, enrollmentCode.getUsedByAgentId());
            throw new IllegalArgumentException("Enrollment code already used");
        }

        if (enrollmentCode.isExpired()) {
            log.warn("Enrollment code {} expired at {}", code, enrollmentCode.getExpiresAt());
            throw new IllegalArgumentException("Enrollment code expired");
        }

        log.info("Validated enrollment code {} for site {}", code, enrollmentCode.getSiteId());
        return enrollmentCode;
    }

    /**
     * Mark enrollment code as used by an agent.
     */
    @Transactional
    public void markCodeUsed(UUID codeId, UUID agentId) {
        SiteAgentEnrollmentCode code = enrollmentCodeRepository.findById(codeId)
            .orElseThrow(() -> new IllegalArgumentException("Enrollment code not found"));

        code.markUsed(agentId);
        enrollmentCodeRepository.save(code);

        log.info("Enrollment code {} used by agent {}", code.getCode(), agentId);
    }

    /**
     * List all enrollment codes for a site (for admin UI).
     */
    @Transactional(readOnly = true)
    public List<SiteAgentEnrollmentCode> listCodesBySite(UUID siteId) {
        return enrollmentCodeRepository.findBySiteIdOrderByCreatedAtDesc(siteId);
    }

    private String generateCode() {
        StringBuilder code = new StringBuilder(CODE_LENGTH);
        for (int i = 0; i < CODE_LENGTH; i++) {
            int index = secureRandom.nextInt(CODE_CHARS.length());
            code.append(CODE_CHARS.charAt(index));

            // Add hyphen after 4 characters for readability: ABCD-EFGH
            if (i == 3) {
                code.append('-');
            }
        }
        return code.toString();
    }
}
