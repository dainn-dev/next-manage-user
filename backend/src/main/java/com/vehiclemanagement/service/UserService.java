package com.vehiclemanagement.service;

import com.vehiclemanagement.config.TenantContext;
import com.vehiclemanagement.dto.CreateUserRequest;
import com.vehiclemanagement.dto.UpdateUserRequest;
import com.vehiclemanagement.dto.UserDto;
import com.vehiclemanagement.billing.EntitlementGuard;
import com.vehiclemanagement.config.AuthDataSourceContext;
import com.vehiclemanagement.entity.MemberAffiliation;
import com.vehiclemanagement.entity.User;
import com.vehiclemanagement.entity.UserSite;
import com.vehiclemanagement.exception.ResourceNotFoundException;
import com.vehiclemanagement.repository.MemberAffiliationRepository;
import com.vehiclemanagement.repository.SiteRepository;
import com.vehiclemanagement.repository.UserRepository;
import com.vehiclemanagement.repository.UserSiteRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@Transactional
public class UserService implements UserDetailsService {
    
    @Autowired
    private UserRepository userRepository;
    
    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private EntitlementGuard entitlementGuard;

    @Autowired
    private UserSiteRepository userSiteRepository;

    @Autowired
    private MemberAffiliationRepository memberAffiliationRepository;

    @Autowired
    private SiteRepository siteRepository;

    @Autowired
    private PlatformTransactionManager transactionManager;
    
    @Override
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public UserDetails loadUserByUsername(String usernameOrEmail) throws UsernameNotFoundException {
        return AuthDataSourceContext.callWithAuthLookup(() -> userRepository.findByUsernameIgnoreCase(usernameOrEmail)
                .or(() -> userRepository.findByEmailIgnoreCase(usernameOrEmail))
                .orElseThrow(() -> new UsernameNotFoundException(
                        "User not found with username or email: " + usernameOrEmail)));
    }
    
    public Page<UserDto> getAllUsers(Pageable pageable) {
        return userRepository.findAll(pageable).map(this::toDto);
    }
    
    public List<UserDto> getAllUsersList() {
        return userRepository.findAll().stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }
    
    public UserDto getUserById(UUID id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + id));
        return toDto(user);
    }
    
    public UserDto getUserByUsername(String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with username: " + username));
        return toDto(user);
    }
    
    public Page<UserDto> searchUsers(String searchTerm, Pageable pageable) {
        return userRepository.findBySearchTerm(searchTerm, pageable).map(this::toDto);
    }
    
    public Page<UserDto> getUsersByRole(User.Role role, Pageable pageable) {
        return userRepository.findByRole(role, pageable).map(this::toDto);
    }
    
    public Page<UserDto> getUsersByStatus(User.UserStatus status, Pageable pageable) {
        return userRepository.findByStatus(status, pageable).map(this::toDto);
    }
    
    public UserDto createUser(CreateUserRequest request) {
        if (request.getRole() == User.Role.PLATFORM_ADMIN) {
            throw new IllegalArgumentException("Cannot create PLATFORM_ADMIN via tenant user API");
        }
        if (userRepository.existsByUsername(request.getUsername())) {
            throw new IllegalArgumentException("Username already exists: " + request.getUsername());
        }
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new IllegalArgumentException("Email already exists: " + request.getEmail());
        }

        entitlementGuard.assertUserCreationAllowed();
        
        User user = User.builder()
                .username(request.getUsername())
                .email(request.getEmail())
                .password(passwordEncoder.encode(request.getPassword()))
                .firstName(request.getFirstName())
                .lastName(request.getLastName())
                .role(request.getRole())
                .status(request.getStatus())
                .build();
        
        User savedUser = userRepository.saveAndFlush(user);
        replaceSiteAssignments(savedUser, request.getRole(), request.getSiteIds());
        ensureMemberAffiliation(savedUser);
        return toDto(savedUser);
    }
    
    public UserDto updateUser(UUID id, UpdateUserRequest request) {
        User existingUser = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + id));
        
        if (request.getUsername() != null && !existingUser.getUsername().equals(request.getUsername()) &&
            userRepository.existsByUsername(request.getUsername())) {
            throw new IllegalArgumentException("Username already exists: " + request.getUsername());
        }
        
        if (request.getEmail() != null && !existingUser.getEmail().equals(request.getEmail()) &&
            userRepository.existsByEmail(request.getEmail())) {
            throw new IllegalArgumentException("Email already exists: " + request.getEmail());
        }

        if (request.getRole() == User.Role.PLATFORM_ADMIN) {
            throw new IllegalArgumentException("Cannot assign PLATFORM_ADMIN via tenant user API");
        }
        
        if (request.getUsername() != null) {
            existingUser.setUsername(request.getUsername());
        }
        if (request.getEmail() != null) {
            existingUser.setEmail(request.getEmail());
        }
        if (request.getPassword() != null) {
            existingUser.setPassword(passwordEncoder.encode(request.getPassword()));
            existingUser.setPasswordChangedAt(LocalDateTime.now());
            existingUser.setPasswordVersion(existingUser.getPasswordVersion() + 1);
        }
        if (request.getFirstName() != null) {
            existingUser.setFirstName(request.getFirstName());
        }
        if (request.getLastName() != null) {
            existingUser.setLastName(request.getLastName());
        }
        if (request.getRole() != null) {
            existingUser.setRole(request.getRole());
        }
        if (request.getStatus() != null) {
            existingUser.setStatus(request.getStatus());
        }
        
        User updatedUser = userRepository.saveAndFlush(existingUser);
        User.Role effectiveRole = updatedUser.getRole();
        if (request.getRole() != null || request.getSiteIds() != null) {
            replaceSiteAssignments(updatedUser, effectiveRole,
                    request.getSiteIds() != null ? request.getSiteIds() : userSiteRepository.findSiteIdsByUserId(id));
        }
        ensureMemberAffiliation(updatedUser);
        return toDto(updatedUser);
    }
    
    public void deleteUser(UUID id) {
        if (!userRepository.existsById(id)) {
            throw new ResourceNotFoundException("User not found with id: " + id);
        }
        userSiteRepository.deleteByUserId(id);
        userRepository.deleteById(id);
    }
    
    public boolean checkUsernameExists(String username) {
        return userRepository.existsByUsername(username);
    }
    
    public boolean checkEmailExists(String email) {
        return userRepository.existsByEmail(email);
    }
    
    public long getUserCountByRole(User.Role role) {
        return userRepository.countByRole(role);
    }
    
    public long getUserCountByStatus(User.UserStatus status) {
        return userRepository.countByStatus(status);
    }
    
    public UserDto updateUserStatus(UUID id, User.UserStatus status) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + id));
        
        user.setStatus(status);
        return toDto(userRepository.save(user));
    }
    
    public UserDto updateUserRole(UUID id, User.Role role) {
        if (role == User.Role.PLATFORM_ADMIN) {
            throw new IllegalArgumentException("Cannot assign PLATFORM_ADMIN via tenant user API");
        }
        if (role == User.Role.SITE_MANAGER) {
            throw new IllegalArgumentException("Assign SITE_MANAGER via user update with siteIds");
        }
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + id));
        
        user.setRole(role);
        User updated = userRepository.save(user);
        userSiteRepository.deleteByUserId(id);
        return toDto(updated);
    }
    
    public void updateLastLogin(String username) {
        Optional<User> userOpt = userRepository.findByUsername(username);
        if (userOpt.isPresent()) {
            User user = userOpt.get();
            user.setLastLogin(LocalDateTime.now());
            userRepository.save(user);
        }
    }

    /**
     * Load site membership for JWT issuance. Tenant GUC must be bound
     * <em>before</em> the transaction begins (RLS on {@code user_site}).
     */
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public List<UUID> findSiteIdsForUser(User user) {
        if (user.getRole() != User.Role.SITE_MANAGER || user.getId() == null || user.getTenantId() == null) {
            return Collections.emptyList();
        }
        UUID previous = TenantContext.getTenantId();
        TenantContext.setTenantId(user.getTenantId());
        try {
            TransactionTemplate tx = new TransactionTemplate(transactionManager);
            tx.setReadOnly(true);
            List<UUID> ids = tx.execute(status -> userSiteRepository.findSiteIdsByUserId(user.getId()));
            return ids != null ? ids : Collections.emptyList();
        } finally {
            if (previous == null) {
                TenantContext.clear();
            } else {
                TenantContext.setTenantId(previous);
            }
        }
    }
    
    /**
     * Load active MEMBER affiliations for JWT. Uses {@code app_auth} so rows across
     * tenants are visible (RLS exception on {@code member_affiliation}).
     */
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public List<UUID> findAffiliationTenantIdsForUser(User user) {
        if (user.getRole() != User.Role.MEMBER || user.getId() == null) {
            return Collections.emptyList();
        }
        return AuthDataSourceContext.callWithAuthLookup(() -> {
            TransactionTemplate tx = new TransactionTemplate(transactionManager);
            tx.setReadOnly(true);
            List<UUID> ids = tx.execute(status ->
                    memberAffiliationRepository.findActiveTenantIdsByUserId(user.getId()));
            return ids != null ? ids : Collections.emptyList();
        });
    }

    /**
     * Ensure a MEMBER created/updated under the current tenant GUC has an ACTIVE affiliation.
     * Phase B: {@code users.tenant_id} may still be stamped by DB default for list visibility;
     * affiliation is the multi-org source of truth (ADR-0603).
     */
    void ensureMemberAffiliation(User user) {
        if (user.getRole() != User.Role.MEMBER || user.getId() == null) {
            return;
        }
        UUID tenantId = TenantContext.getTenantId();
        if (tenantId == null) {
            tenantId = user.getTenantId();
        }
        if (tenantId == null) {
            return;
        }
        MemberAffiliation.MemberAffiliationId pk =
                new MemberAffiliation.MemberAffiliationId(user.getId(), tenantId);
        Optional<MemberAffiliation> existing = memberAffiliationRepository.findById(pk);
        if (existing.isPresent()) {
            MemberAffiliation row = existing.get();
            if (row.getStatus() != MemberAffiliation.Status.ACTIVE) {
                row.setStatus(MemberAffiliation.Status.ACTIVE);
                memberAffiliationRepository.save(row);
            }
            return;
        }
        memberAffiliationRepository.save(MemberAffiliation.builder()
                .userId(user.getId())
                .tenantId(tenantId)
                .status(MemberAffiliation.Status.ACTIVE)
                .build());
    }
    
    public void bulkDeleteUsers(List<UUID> userIds) {
        for (UUID id : userIds) {
            if (userRepository.existsById(id)) {
                userSiteRepository.deleteByUserId(id);
                userRepository.deleteById(id);
            }
        }
    }
    
    public List<UserDto> bulkUpdateUserStatus(List<UUID> userIds, User.UserStatus status) {
        List<User> users = userRepository.findAllById(userIds);
        for (User user : users) {
            user.setStatus(status);
        }
        return userRepository.saveAll(users).stream().map(this::toDto).collect(Collectors.toList());
    }
    
    public List<UserDto> bulkUpdateUserRole(List<UUID> userIds, User.Role role) {
        if (role == User.Role.PLATFORM_ADMIN) {
            throw new IllegalArgumentException("Cannot assign PLATFORM_ADMIN via tenant user API");
        }
        if (role == User.Role.SITE_MANAGER) {
            throw new IllegalArgumentException("Assign SITE_MANAGER via user update with siteIds");
        }
        List<User> users = userRepository.findAllById(userIds);
        for (User user : users) {
            user.setRole(role);
            userSiteRepository.deleteByUserId(user.getId());
        }
        return userRepository.saveAll(users).stream().map(this::toDto).collect(Collectors.toList());
    }

    private void replaceSiteAssignments(User user, User.Role role, List<UUID> siteIds) {
        userSiteRepository.deleteByUserId(user.getId());
        if (role != User.Role.SITE_MANAGER) {
            return;
        }
        if (siteIds == null || siteIds.isEmpty()) {
            throw new IllegalArgumentException("SITE_MANAGER requires at least one site assignment");
        }
        List<UserSite> rows = new ArrayList<>();
        for (UUID siteId : siteIds.stream().distinct().toList()) {
            if (!siteRepository.existsById(siteId)) {
                throw new IllegalArgumentException("Site not found: " + siteId);
            }
            rows.add(UserSite.builder().userId(user.getId()).siteId(siteId).build());
        }
        userSiteRepository.saveAll(rows);
    }

    private UserDto toDto(User user) {
        UserDto dto = new UserDto(user);
        if (user.getRole() == User.Role.SITE_MANAGER) {
            dto.setSiteIds(userSiteRepository.findSiteIdsByUserId(user.getId()));
        } else {
            dto.setSiteIds(Collections.emptyList());
        }
        if (user.getRole() == User.Role.MEMBER) {
            dto.setAffiliationTenantIds(findAffiliationTenantIdsForUser(user));
        } else {
            dto.setAffiliationTenantIds(Collections.emptyList());
        }
        return dto;
    }
}
