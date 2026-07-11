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
                .requestMatchers(HttpMethod.POST, "/api/v1/parking/webhooks/**").permitAll()

                // Platform admin: tenant registry + console + billing overview (SaaS operator)
                .requestMatchers("/api/v1/tenants/**").hasRole("PLATFORM_ADMIN")
                .requestMatchers("/api/v1/platform/**").hasRole("PLATFORM_ADMIN")
                .requestMatchers("/api/v1/billing/**").hasAnyRole("PLATFORM_ADMIN", "TENANT_ADMIN")

                // Own-tenant organization profile (TENANT_ADMIN only)
                .requestMatchers("/api/v1/tenant/**").hasRole("TENANT_ADMIN")

                // Tenant administration (TENANT_ADMIN only — not PLATFORM_ADMIN / SITE_MANAGER)
                .requestMatchers("/api/admin/**").hasRole("TENANT_ADMIN")
                .requestMatchers(HttpMethod.DELETE, "/api/vehicles/{id}").hasAnyRole("TENANT_ADMIN", "SITE_MANAGER")

                // Vehicle write / approval — tenant admin or site manager
                .requestMatchers(HttpMethod.POST, "/api/vehicles").hasAnyRole("TENANT_ADMIN", "SITE_MANAGER")
                .requestMatchers(HttpMethod.PUT, "/api/vehicles/*/approve").hasAnyRole("TENANT_ADMIN", "SITE_MANAGER")
                .requestMatchers(HttpMethod.PUT, "/api/vehicles/*/reject").hasAnyRole("TENANT_ADMIN", "SITE_MANAGER")

                // Vehicle logs
                .requestMatchers(HttpMethod.GET, "/api/vehicle-logs").hasAnyRole("TENANT_ADMIN", "SITE_MANAGER")
                .requestMatchers(HttpMethod.GET, "/api/vehicle-logs/export/**").hasAnyRole("TENANT_ADMIN", "SITE_MANAGER")

                // Vehicle export / bulk import
                .requestMatchers(HttpMethod.GET, "/api/vehicles/export", "/api/vehicles/export/**").hasAnyRole("TENANT_ADMIN", "SITE_MANAGER")
                .requestMatchers(HttpMethod.POST, "/api/vehicles/import").hasAnyRole("TENANT_ADMIN", "SITE_MANAGER")

                // Employee export
                .requestMatchers(HttpMethod.GET, "/api/employees/export").hasAnyRole("TENANT_ADMIN", "SITE_MANAGER")

                // Access requests - admin list / approve / reject
                .requestMatchers(HttpMethod.GET, "/api/access-requests").hasAnyRole("TENANT_ADMIN", "SITE_MANAGER")
                .requestMatchers(HttpMethod.GET, "/api/access-requests/pending").hasAnyRole("TENANT_ADMIN", "SITE_MANAGER")
                .requestMatchers(HttpMethod.PUT, "/api/access-requests/*/approve").hasAnyRole("TENANT_ADMIN", "SITE_MANAGER")
                .requestMatchers(HttpMethod.PUT, "/api/access-requests/*/reject").hasAnyRole("TENANT_ADMIN", "SITE_MANAGER")

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
