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
import java.util.Map;

@Service
public class AuthService {
    
    @Autowired
    private AuthenticationManager authenticationManager;
    
    @Autowired
    private JwtUtil jwtUtil;
    
    @Autowired
    private UserService userService;
    
    public LoginResponse login(LoginRequest loginRequest) {
        // Authenticate user
        Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(
                        loginRequest.getUsername(),
                        loginRequest.getPassword()
                )
        );
        
        UserDetails userDetails = (UserDetails) authentication.getPrincipal();
        User user = (User) userDetails;
        
        // Create extra claims for JWT
        Map<String, Object> extraClaims = new HashMap<>();
        extraClaims.put("role", user.getRole().name());
        extraClaims.put("email", user.getEmail());
        extraClaims.put("userId", user.getId().toString());
        
        // Generate JWT token
        String token = jwtUtil.generateToken(userDetails, extraClaims);
        
        // Update last login
        userService.updateLastLogin(user.getUsername());
        
        // Create response
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
                .user(new UserDto(user))
                .build();
    }
    
    public UserDto getCurrentUser(String username) {
        return userService.getUserByUsername(username);
    }
}
