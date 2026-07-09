package com.vehiclemanagement.config;

final class AdminDataSourceContext {

    private static final ThreadLocal<Boolean> ADMIN_OPERATION = ThreadLocal.withInitial(() -> false);

    private AdminDataSourceContext() {
    }

    static boolean isAdminOperation() {
        return ADMIN_OPERATION.get();
    }

    static Object runInAdminOperation(ThrowingSupplier action) throws Throwable {
        boolean previous = ADMIN_OPERATION.get();
        ADMIN_OPERATION.set(true);
        try {
            return action.get();
        } finally {
            ADMIN_OPERATION.set(previous);
        }
    }

    @FunctionalInterface
    interface ThrowingSupplier {
        Object get() throws Throwable;
    }
}
