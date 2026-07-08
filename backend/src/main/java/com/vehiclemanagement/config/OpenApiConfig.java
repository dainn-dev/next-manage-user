package com.vehiclemanagement.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import io.swagger.v3.oas.models.security.SecurityScheme;
import io.swagger.v3.oas.models.servers.Server;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.List;

@Configuration
public class OpenApiConfig {
    
    @Bean
    public OpenAPI customOpenAPI() {
        return new OpenAPI()
                .info(new Info()
                        .title("Vehicle Management System API")
                        .description("REST API for managing vehicles and entry/exit requests")
                        .version("1.0.0")
                        .contact(new Contact()
                                .name("Vehicle Management Team")
                                .email("support@vehiclemanagement.com"))
                        .license(new License()
                                .name("MIT License")
                                .url("https://opensource.org/licenses/MIT")))
                .servers(List.of(
                        new Server()
                                .url("http://localhost:8080")
                                .description("Development server"),
                        new Server()
                                .url("https://api.vehiclemanagement.com")
                                .description("Production server")
                ))
                .components(new Components().addSecuritySchemes("X-Gate-Key",
                        new SecurityScheme()
                                .type(SecurityScheme.Type.APIKEY)
                                .in(SecurityScheme.In.HEADER)
                                .name("X-Gate-Key")
                                .description("Shared secret required by the parking-gate detection app "
                                        + "for side-effecting public endpoints "
                                        + "(POST /api/vehicles/check-vehicle, POST /api/vehicle-logs, "
                                        + "POST /api/gates/register, POST /api/gates/{id}/heartbeat).")));
    }
}
