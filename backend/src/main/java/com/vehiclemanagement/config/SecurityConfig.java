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
import org.springframework.security.config.Customizer;
import com.vehiclemanagement.util.JwtUtil;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity(prePostEnabled = true)
public class SecurityConfig {
    
    @Autowired
    private JwtUtil jwtUtil;

    // Deploy 2 = RLS enforced = default-tenant fallback off. When off, a validated
    // non-PLATFORM_ADMIN token with no tenant_id is rejected 401 by TenantContextFilter.
    @org.springframework.beans.factory.annotation.Value("${multitenancy.default-tenant-fallback:true}")
    private boolean defaultTenantFallback;

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http, UserDetailsService userDetailsService) throws Exception {
        http
            .cors(Customizer.withDefaults())
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
                .requestMatchers(HttpMethod.POST, "/api/v1/billing/webhooks").permitAll()

                // Platform admin tenant registry and onboarding
                .requestMatchers("/api/v1/tenants/**").hasRole("PLATFORM_ADMIN")
                .requestMatchers("/api/v1/billing/**").hasAnyRole("PLATFORM_ADMIN", "TENANT_ADMIN")

                // Tenant administration
                .requestMatchers("/api/admin/**").hasAnyRole("PLATFORM_ADMIN", "TENANT_ADMIN")
                .requestMatchers(HttpMethod.DELETE, "/api/vehicles/{id}").hasAnyRole("PLATFORM_ADMIN", "TENANT_ADMIN")

                // Tenant admin or site manager
                .requestMatchers(HttpMethod.POST, "/api/vehicles").hasAnyRole("PLATFORM_ADMIN", "TENANT_ADMIN", "SITE_MANAGER")
                .requestMatchers(HttpMethod.PUT, "/api/vehicles/*/approve").hasAnyRole("PLATFORM_ADMIN", "TENANT_ADMIN", "SITE_MANAGER")
                .requestMatchers(HttpMethod.PUT, "/api/vehicles/*/reject").hasAnyRole("PLATFORM_ADMIN", "TENANT_ADMIN", "SITE_MANAGER")

                // Operational roles that can view vehicle logs
                .requestMatchers(HttpMethod.GET, "/api/vehicle-logs").hasAnyRole("PLATFORM_ADMIN", "TENANT_ADMIN", "SITE_MANAGER", "SECURITY_GUARD")
                .requestMatchers(HttpMethod.GET, "/api/vehicle-logs/export/**").hasAnyRole("PLATFORM_ADMIN", "TENANT_ADMIN", "SITE_MANAGER", "SECURITY_GUARD")

                // Vehicle export (template / selectable columns) / bulk import
                .requestMatchers(HttpMethod.GET, "/api/vehicles/export", "/api/vehicles/export/**").hasAnyRole("PLATFORM_ADMIN", "TENANT_ADMIN", "SITE_MANAGER")
                .requestMatchers(HttpMethod.POST, "/api/vehicles/import").hasAnyRole("PLATFORM_ADMIN", "TENANT_ADMIN", "SITE_MANAGER")

                // Employee export (selectable columns)
                .requestMatchers(HttpMethod.GET, "/api/employees/export").hasAnyRole("PLATFORM_ADMIN", "TENANT_ADMIN", "SITE_MANAGER")

                // Access requests - tenant admin or site manager (list all / approve / reject)
                .requestMatchers(HttpMethod.GET, "/api/access-requests").hasAnyRole("PLATFORM_ADMIN", "TENANT_ADMIN", "SITE_MANAGER")
                .requestMatchers(HttpMethod.GET, "/api/access-requests/pending").hasAnyRole("PLATFORM_ADMIN", "TENANT_ADMIN", "SITE_MANAGER")
                .requestMatchers(HttpMethod.PUT, "/api/access-requests/*/approve").hasAnyRole("PLATFORM_ADMIN", "TENANT_ADMIN", "SITE_MANAGER")
                .requestMatchers(HttpMethod.PUT, "/api/access-requests/*/reject").hasAnyRole("PLATFORM_ADMIN", "TENANT_ADMIN", "SITE_MANAGER")

                // Protected endpoints
                .requestMatchers("/api/**").authenticated()

                // Default
                .anyRequest().authenticated()
            )
            .authenticationProvider(authenticationProvider(userDetailsService))
            .addFilterBefore(jwtAuthenticationFilter(userDetailsService), UsernamePasswordAuthenticationFilter.class)
            .addFilterAfter(tenantContextFilter(), JwtAuthenticationFilter.class)
            .addFilterBefore(gateApiKeyAuthFilter(), JwtAuthenticationFilter.class)
            .addFilterBefore(registrationRateLimitFilter(), JwtAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public TenantContextFilter tenantContextFilter() {
        return new TenantContextFilter(jwtUtil, !defaultTenantFallback);
    }

    @Bean
    public GateApiKeyAuthFilter gateApiKeyAuthFilter() {
        return new GateApiKeyAuthFilter();
    }

    @Autowired
    private RegistrationRateLimitService registrationRateLimitService;

    @Autowired
    private RegistrationRateLimitProperties registrationRateLimitProperties;

    @Bean
    public RegistrationRateLimitFilter registrationRateLimitFilter() {
        return new RegistrationRateLimitFilter(registrationRateLimitService, registrationRateLimitProperties);
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
