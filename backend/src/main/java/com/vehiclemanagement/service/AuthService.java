package com.vehiclemanagement.service;

import com.vehiclemanagement.dto.LoginRequest;
import com.vehiclemanagement.dto.LoginResponse;
import com.vehiclemanagement.dto.UserDto;
import com.vehiclemanagement.entity.User;
import com.vehiclemanagement.util.JwtUtil;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class AuthService {
    
    @Autowired
    private AuthenticationManager authenticationManager;
    
    @Autowired
    private JwtUtil jwtUtil;
    
    @Autowired
    private UserService userService;
    
    public LoginResponse login(LoginRequest loginRequest) {
        Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(
                        loginRequest.getUsername(),
                        loginRequest.getPassword()
                )
        );
        
        UserDetails userDetails = (UserDetails) authentication.getPrincipal();
        User user = (User) userDetails;

        List<UUID> affiliationTenantIds = userService.findAffiliationTenantIdsForUser(user);
        
        Map<String, Object> extraClaims = new HashMap<>();
        extraClaims.put("role", user.getRole().name());
        extraClaims.put("email", user.getEmail());
        extraClaims.put("userId", user.getId().toString());
        // MEMBER is a platform consumer (ADR-0603): no home tenant_id in JWT.
        if (user.getRole() != User.Role.MEMBER && user.getTenantId() != null) {
            extraClaims.put("tenant_id", user.getTenantId().toString());
        }
        if (user.getRole() == User.Role.MEMBER) {
            extraClaims.put("affiliation_tenant_ids",
                    affiliationTenantIds.stream().map(UUID::toString).toList());
        }
        
        String token = jwtUtil.generateToken(userDetails, extraClaims);
        
        userService.updateLastLogin(user.getUsername());

        UserDto userDto = new UserDto(user);
        userDto.setAffiliationTenantIds(affiliationTenantIds);
        
        return LoginResponse.builder()
                .token(token)
                .tokenType("Bearer")
                .username(user.getUsername())
                .email(user.getEmail())
                .role(user.getRole().name())
                .expiresAt(LocalDateTime.ofInstant(
                        jwtUtil.getExpirationDate().toInstant(),
                        ZoneId.systemDefault()
                ))
                .user(userDto)
                .build();
    }
    
    public UserDto getCurrentUser(String username) {
        return userService.getCurrentUserForAuth(username);
    }
}
