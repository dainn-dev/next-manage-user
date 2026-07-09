package com.vehiclemanagement.config;

import java.util.function.Supplier;

/**
 * Marks the current thread as using the pre-tenant authentication DB role.
 *
 * <p>Login identity lookup happens before a tenant can be trusted from a JWT.
 * The transaction manager checks this flag at transaction start and switches to
 * {@code app_auth}, whose database grants are read-only and limited to
 * {@code users}.
 */
public final class AuthDataSourceContext {

    private static final ThreadLocal<Boolean> AUTH_LOOKUP = ThreadLocal.withInitial(() -> false);

    private AuthDataSourceContext() {
    }

    public static <T> T callWithAuthLookup(Supplier<T> operation) {
        boolean previous = AUTH_LOOKUP.get();
        AUTH_LOOKUP.set(true);
        try {
            return operation.get();
        } finally {
            AUTH_LOOKUP.set(previous);
        }
    }

    public static boolean isAuthLookup() {
        return AUTH_LOOKUP.get();
    }
}
