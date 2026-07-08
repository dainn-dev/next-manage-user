package com.vehiclemanagement.config;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.AuthenticationProvider;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import com.vehiclemanagement.util.JwtUtil;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity(prePostEnabled = true)
public class SecurityConfig {
    
    @Autowired
    private JwtUtil jwtUtil;
    
    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http, UserDetailsService userDetailsService) throws Exception {
        http
            // .cors(cors -> cors.configurationSource(corsConfigurationSource))
            .csrf(AbstractHttpConfigurer::disable)
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(authz -> authz
                // Public endpoints
                .requestMatchers("/api/auth/**").permitAll()
                .requestMatchers("/api/vehicles/check-vehicle").permitAll()
                .requestMatchers(HttpMethod.POST,"/api/vehicle-logs").permitAll()
                // Edge gate endpoints - guarded by the X-Gate-Key filter, not JWT
                .requestMatchers(HttpMethod.POST, "/api/gates/register").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/gates/*/heartbeat").permitAll()
                .requestMatchers("/actuator/**").permitAll()
                .requestMatchers("/api-docs/**", "/swagger-ui/**", "/swagger-ui.html").permitAll()
                .requestMatchers("/images/**").permitAll()
                .requestMatchers("/uploads/**").permitAll()
                .requestMatchers("/ws/**").permitAll()

                // Admin only
                .requestMatchers("/api/admin/**").hasAnyRole("ADMIN")
                .requestMatchers(HttpMethod.DELETE, "/api/vehicles/{id}").hasAnyRole("ADMIN")

                // Admin or Approver
                .requestMatchers(HttpMethod.POST, "/api/vehicles").hasAnyRole("ADMIN", "APPROVER")
                .requestMatchers(HttpMethod.PUT, "/api/vehicles/*/approve").hasAnyRole("ADMIN", "APPROVER")
                .requestMatchers(HttpMethod.PUT, "/api/vehicles/*/reject").hasAnyRole("ADMIN", "APPROVER")

                // Admin, Approver, or Security Officer
                .requestMatchers(HttpMethod.GET, "/api/vehicle-logs").hasAnyRole("ADMIN", "APPROVER", "SECURITY_OFFICER")
                .requestMatchers(HttpMethod.GET, "/api/vehicle-logs/export/**").hasAnyRole("ADMIN", "APPROVER", "SECURITY_OFFICER")

                // Vehicle export (template / selectable columns) / bulk import - Admin or Approver
                .requestMatchers(HttpMethod.GET, "/api/vehicles/export", "/api/vehicles/export/**").hasAnyRole("ADMIN", "APPROVER")
                .requestMatchers(HttpMethod.POST, "/api/vehicles/import").hasAnyRole("ADMIN", "APPROVER")

                // Employee export (selectable columns) - Admin or Approver
                .requestMatchers(HttpMethod.GET, "/api/employees/export").hasAnyRole("ADMIN", "APPROVER")

                // Access requests - Admin or Approver (list all / approve / reject)
                .requestMatchers(HttpMethod.GET, "/api/access-requests").hasAnyRole("ADMIN", "APPROVER")
                .requestMatchers(HttpMethod.GET, "/api/access-requests/pending").hasAnyRole("ADMIN", "APPROVER")
                .requestMatchers(HttpMethod.PUT, "/api/access-requests/*/approve").hasAnyRole("ADMIN", "APPROVER")
                .requestMatchers(HttpMethod.PUT, "/api/access-requests/*/reject").hasAnyRole("ADMIN", "APPROVER")

                // Protected endpoints
                .requestMatchers("/api/**").authenticated()

                // Default
                .anyRequest().authenticated()
            )
            .authenticationProvider(authenticationProvider(userDetailsService))
            .addFilterBefore(jwtAuthenticationFilter(userDetailsService), UsernamePasswordAuthenticationFilter.class)
            .addFilterBefore(gateApiKeyAuthFilter(), JwtAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public GateApiKeyAuthFilter gateApiKeyAuthFilter() {
        return new GateApiKeyAuthFilter();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(12);
    }
    
    @Bean
    public AuthenticationProvider authenticationProvider(UserDetailsService userDetailsService) {
        DaoAuthenticationProvider authProvider = new DaoAuthenticationProvider();
        authProvider.setUserDetailsService(userDetailsService);
        authProvider.setPasswordEncoder(passwordEncoder());
        return authProvider;
    }
    
    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config) throws Exception {
        return config.getAuthenticationManager();
    }
    
    @Bean
    public JwtAuthenticationFilter jwtAuthenticationFilter(UserDetailsService userDetailsService) {
        return new JwtAuthenticationFilter(jwtUtil, userDetailsService);
    }
}
