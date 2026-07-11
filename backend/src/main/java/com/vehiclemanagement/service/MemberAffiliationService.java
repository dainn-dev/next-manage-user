package com.vehiclemanagement.service;

import com.vehiclemanagement.billing.EntitlementGuard;
import com.vehiclemanagement.config.AuthDataSourceContext;
import com.vehiclemanagement.config.TenantContext;
import com.vehiclemanagement.dto.CreateUserRequest;
import com.vehiclemanagement.dto.MemberAffiliationDto;
import com.vehiclemanagement.dto.MemberAffiliationInviteRequest;
import com.vehiclemanagement.dto.UserDto;
import com.vehiclemanagement.entity.MemberAffiliation;
import com.vehiclemanagement.entity.User;
import com.vehiclemanagement.exception.ResourceNotFoundException;
import com.vehiclemanagement.repository.MemberAffiliationRepository;
import com.vehiclemanagement.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
public class MemberAffiliationService {

    private final MemberAffiliationRepository memberAffiliationRepository;
    private final UserRepository userRepository;
    private final UserService userService;
    private final EntitlementGuard entitlementGuard;
    private final PlatformTransactionManager transactionManager;

    public MemberAffiliationService(
            MemberAffiliationRepository memberAffiliationRepository,
            UserRepository userRepository,
            UserService userService,
            EntitlementGuard entitlementGuard,
            PlatformTransactionManager transactionManager) {
        this.memberAffiliationRepository = memberAffiliationRepository;
        this.userRepository = userRepository;
        this.userService = userService;
        this.entitlementGuard = entitlementGuard;
        this.transactionManager = transactionManager;
    }

    @Transactional(readOnly = true)
    public List<MemberAffiliationDto> listForCurrentTenant() {
        UUID tenantId = requireTenant();
        return memberAffiliationRepository.findByTenantId(tenantId).stream()
                .map(this::toDto)
                .toList();
    }

    /**
     * Create a new MEMBER in this tenant, or link an existing platform MEMBER by email.
     */
    @Transactional
    public MemberAffiliationDto inviteOrLink(MemberAffiliationInviteRequest request) {
        UUID tenantId = requireTenant();
        String email = request.getEmail().trim();

        Optional<User> existing = findUserByEmailAcrossTenants(email);
        if (existing.isPresent()) {
            User user = existing.get();
            if (user.getRole() != User.Role.MEMBER) {
                throw new IllegalArgumentException(
                        "Email belongs to a non-MEMBER account; cannot affiliate");
            }
            return upsertAffiliation(user, tenantId, MemberAffiliation.Status.ACTIVE);
        }

        if (request.getUsername() == null || request.getUsername().isBlank()
                || request.getPassword() == null || request.getPassword().isBlank()) {
            throw new IllegalArgumentException(
                    "username and password are required when inviting a new MEMBER");
        }

        entitlementGuard.assertUserCreationAllowed();

        CreateUserRequest create = new CreateUserRequest();
        create.setUsername(request.getUsername().trim());
        create.setEmail(email);
        create.setPassword(request.getPassword());
        create.setFirstName(request.getFirstName());
        create.setLastName(request.getLastName());
        create.setRole(User.Role.MEMBER);
        create.setStatus(User.UserStatus.ACTIVE);

        UserDto created = userService.createUser(create);
        User user = userRepository.findById(created.getId())
                .orElseThrow(() -> new ResourceNotFoundException("User not found after create"));
        return upsertAffiliation(user, tenantId, MemberAffiliation.Status.ACTIVE);
    }

    @Transactional
    public MemberAffiliationDto revoke(UUID userId) {
        UUID tenantId = requireTenant();
        MemberAffiliation.MemberAffiliationId pk =
                new MemberAffiliation.MemberAffiliationId(userId, tenantId);
        MemberAffiliation row = memberAffiliationRepository.findById(pk)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Affiliation not found for user " + userId));
        row.setStatus(MemberAffiliation.Status.REVOKED);
        return toDto(memberAffiliationRepository.save(row));
    }

    private MemberAffiliationDto upsertAffiliation(
            User user, UUID tenantId, MemberAffiliation.Status status) {
        MemberAffiliation.MemberAffiliationId pk =
                new MemberAffiliation.MemberAffiliationId(user.getId(), tenantId);
        MemberAffiliation row = memberAffiliationRepository.findById(pk)
                .orElseGet(() -> MemberAffiliation.builder()
                        .userId(user.getId())
                        .tenantId(tenantId)
                        .build());
        row.setStatus(status);
        return toDto(memberAffiliationRepository.save(row));
    }

    private Optional<User> findUserByEmailAcrossTenants(String email) {
        return AuthDataSourceContext.callWithAuthLookup(() -> {
            TransactionTemplate tx = new TransactionTemplate(transactionManager);
            tx.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
            tx.setReadOnly(true);
            return tx.execute(status -> userRepository.findByEmailIgnoreCase(email));
        });
    }

    private MemberAffiliationDto toDto(MemberAffiliation row) {
        User user = AuthDataSourceContext.callWithAuthLookup(() -> {
            TransactionTemplate tx = new TransactionTemplate(transactionManager);
            tx.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
            tx.setReadOnly(true);
            return tx.execute(status -> userRepository.findById(row.getUserId()).orElse(null));
        });
        return MemberAffiliationDto.builder()
                .userId(row.getUserId())
                .tenantId(row.getTenantId())
                .status(row.getStatus())
                .username(user != null ? user.getUsername() : null)
                .email(user != null ? user.getEmail() : null)
                .fullName(user != null ? user.getFullName() : null)
                .createdAt(row.getCreatedAt())
                .updatedAt(row.getUpdatedAt())
                .build();
    }

    private UUID requireTenant() {
        UUID tenantId = TenantContext.getTenantId();
        if (tenantId == null) {
            throw new IllegalStateException("Tenant context required");
        }
        return tenantId;
    }
}
