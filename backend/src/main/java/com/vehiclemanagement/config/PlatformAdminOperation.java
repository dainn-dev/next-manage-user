package com.vehiclemanagement.config;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Marks service work that must run through the physically separate admin
 * datasource. Use sparingly for audited platform-admin operations that need to
 * bypass tenant RLS; normal request work must stay on the request datasource.
 */
@Target({ElementType.METHOD, ElementType.TYPE})
@Retention(RetentionPolicy.RUNTIME)
public @interface PlatformAdminOperation {
}
