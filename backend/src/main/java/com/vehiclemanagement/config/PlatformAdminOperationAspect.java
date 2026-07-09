package com.vehiclemanagement.config;

import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

@Aspect
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class PlatformAdminOperationAspect {

    @Around("@within(com.vehiclemanagement.config.PlatformAdminOperation) "
            + "|| @annotation(com.vehiclemanagement.config.PlatformAdminOperation)")
    public Object routeToAdminDataSource(ProceedingJoinPoint pjp) throws Throwable {
        return AdminDataSourceContext.runInAdminOperation(pjp::proceed);
    }
}
