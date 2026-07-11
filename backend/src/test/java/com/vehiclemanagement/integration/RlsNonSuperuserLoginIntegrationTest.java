package com.vehiclemanagement.integration;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Confirms the prod-critical property the Testcontainers superuser login cannot
 * prove on its own: RLS is real for a NON-superuser base login that is merely a
 * member of the app roles.
 *
 * <p>A superuser bypasses RLS entirely, so all other integration tests (which
 * connect as the container's superuser and only reach the app_rls role via
 * {@code SET LOCAL ROLE}) do not by themselves prove the production datasource —
 * a plain {@code NOSUPERUSER} login that is a member of app_rls/app_auth — behaves
 * the same. This test connects as exactly such a login and asserts:
 * <ol>
 *   <li>it is genuinely not a superuser;</li>
 *   <li>with no tenant bound it sees ZERO user rows — RLS applies to the login
 *       itself, it does not silently bypass;</li>
 *   <li>after {@code SET ROLE app_rls} + the tenant var it sees only its tenant's
 *       rows — the enforcement mechanism works from a non-superuser login;</li>
 *   <li>it CANNOT {@code SET ROLE app_admin} (the BYPASSRLS role) — because it is
 *       not a member of it. This is the escalation guard: the request login must
 *       be a member of app_rls/app_auth only, never app_admin.</li>
 * </ol>
 */
class RlsNonSuperuserLoginIntegrationTest extends AbstractPostgresIntegrationTest {

    private static final UUID DEFAULT_TENANT = UUID.fromString("00000000-0000-0000-0000-000000000001");
    private static final String LOGIN = "app_login";
    private static final String LOGIN_PW = "app_login_pw";

    @Autowired
    private JdbcTemplate jdbc;

    @Test
    void nonSuperuserLoginTrulyEnforcesRlsAndCannotEscalate() throws SQLException {
        // A real request login: NOSUPERUSER, member of app_rls + app_auth, NOT app_admin.
        jdbc.execute("DO $$ BEGIN "
                + "IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '" + LOGIN + "') THEN "
                + "CREATE ROLE " + LOGIN + " LOGIN PASSWORD '" + LOGIN_PW + "' NOSUPERUSER NOBYPASSRLS; "
                + "END IF; END $$;");
        jdbc.execute("GRANT app_rls  TO " + LOGIN);
        jdbc.execute("GRANT app_auth TO " + LOGIN);
        // A DEFAULT-tenant user to look for (seeded bypassing RLS as the superuser).
        jdbc.update("INSERT INTO users(id, username, email, password, role, status, tenant_id, created_at, updated_at) "
                + "VALUES (?, 'nonsuper-default', 'nonsuper-default@example.com', 'x', 'TENANT_ADMIN', 'ACTIVE', ?, now(), now())",
                UUID.randomUUID(), DEFAULT_TENANT);

        try (Connection conn = DriverManager.getConnection(POSTGRES.getJdbcUrl(), LOGIN, LOGIN_PW)) {

            // (1) genuinely not a superuser.
            assertThat(queryString(conn, "SHOW is_superuser")).isEqualTo("off");

            // (2) no tenant bound -> RLS applies to the login itself -> zero rows.
            assertThat(queryLong(conn, "SELECT count(*) FROM users")).isZero();

            // (3) mechanism works from this non-superuser login.
            try (Statement st = conn.createStatement()) {
                st.execute("SET ROLE app_rls");
                st.execute("SELECT set_config('app.tenant_id', '" + DEFAULT_TENANT + "', false)");
            }
            long visible = queryLong(conn, "SELECT count(*) FROM users");
            assertThat(visible).isGreaterThanOrEqualTo(1L);
            assertThat(queryLong(conn,
                    "SELECT count(*) FROM users WHERE tenant_id <> '" + DEFAULT_TENANT + "'")).isZero();
            try (Statement st = conn.createStatement()) {
                st.execute("RESET ROLE");
            }

            // app_auth is the pre-tenant identity lookup role: it can read users
            // without tenant context, but V44 keeps it read-only.
            try (Statement st = conn.createStatement()) {
                st.execute("SET ROLE app_auth");
            }
            assertThat(queryLong(conn, "SELECT count(*) FROM users")).isGreaterThanOrEqualTo(1L);
            assertThatThrownBy(() -> {
                try (Statement st = conn.createStatement()) {
                    st.execute("INSERT INTO users(id, username, email, password, role, status, tenant_id, created_at, updated_at) "
                            + "VALUES ('" + UUID.randomUUID() + "', 'auth-write-denied', 'auth-write-denied@example.com', 'x', 'TENANT_ADMIN', 'ACTIVE', '"
                            + DEFAULT_TENANT + "', now(), now())");
                }
            }).isInstanceOf(SQLException.class);
            assertThatThrownBy(() -> {
                try (Statement st = conn.createStatement()) {
                    st.execute("UPDATE users SET status = 'LOCKED' WHERE username = 'nonsuper-default'");
                }
            }).isInstanceOf(SQLException.class);
            try (Statement st = conn.createStatement()) {
                st.execute("RESET ROLE");
            }

            // (4) escalation guard: cannot become the BYPASSRLS role it is not a member of.
            assertThatThrownBy(() -> {
                try (Statement st = conn.createStatement()) {
                    st.execute("SET ROLE app_admin");
                }
            }).isInstanceOf(SQLException.class)
              .hasMessageContaining("app_admin");
        }
    }

    private String queryString(Connection conn, String sql) throws SQLException {
        try (Statement st = conn.createStatement(); ResultSet rs = st.executeQuery(sql)) {
            rs.next();
            return rs.getString(1);
        }
    }

    private long queryLong(Connection conn, String sql) throws SQLException {
        try (Statement st = conn.createStatement(); ResultSet rs = st.executeQuery(sql)) {
            rs.next();
            return rs.getLong(1);
        }
    }
}
