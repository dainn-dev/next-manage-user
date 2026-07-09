package com.vehiclemanagement.config;

import org.springframework.jdbc.datasource.lookup.AbstractRoutingDataSource;

final class AdminRoutingDataSource extends AbstractRoutingDataSource {

    static final String REQUEST = "request";
    static final String ADMIN = "admin";

    @Override
    protected Object determineCurrentLookupKey() {
        return AdminDataSourceContext.isAdminOperation() ? ADMIN : REQUEST;
    }
}
