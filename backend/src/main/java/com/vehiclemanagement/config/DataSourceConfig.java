package com.vehiclemanagement.config;

import com.zaxxer.hikari.HikariDataSource;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.autoconfigure.jdbc.DataSourceProperties;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;

import javax.sql.DataSource;
import java.util.Map;

@Configuration
public class DataSourceConfig {

    @Bean
    @Primary
    @ConfigurationProperties("spring.datasource")
    public DataSourceProperties requestDataSourceProperties() {
        return new DataSourceProperties();
    }

    @Bean
    @ConfigurationProperties("app.admin-datasource")
    public DataSourceProperties adminDataSourceProperties() {
        return new DataSourceProperties();
    }

    @Bean
    @ConfigurationProperties("spring.datasource.hikari")
    public HikariDataSource requestDataSource(
            @Qualifier("requestDataSourceProperties") DataSourceProperties properties) {
        return properties.initializeDataSourceBuilder()
                .type(HikariDataSource.class)
                .build();
    }

    @Bean
    @ConfigurationProperties("app.admin-datasource.hikari")
    public HikariDataSource adminDataSource(
            @Qualifier("adminDataSourceProperties") DataSourceProperties properties) {
        return properties.initializeDataSourceBuilder()
                .type(HikariDataSource.class)
                .build();
    }

    @Bean
    @Primary
    public DataSource dataSource(
            @Qualifier("requestDataSource") DataSource requestDataSource,
            @Qualifier("adminDataSource") DataSource adminDataSource) {
        AdminRoutingDataSource routingDataSource = new AdminRoutingDataSource();
        routingDataSource.setDefaultTargetDataSource(requestDataSource);
        routingDataSource.setTargetDataSources(Map.of(
                AdminRoutingDataSource.REQUEST, requestDataSource,
                AdminRoutingDataSource.ADMIN, adminDataSource));
        return routingDataSource;
    }
}
