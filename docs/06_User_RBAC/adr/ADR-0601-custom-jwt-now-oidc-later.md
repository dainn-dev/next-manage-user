# ADR-0601: Keep Custom JWT Now, Optional OIDC/Keycloak Later

- Status: Proposed
- Date: 2026-07-09
- Deciders: Principal Architect
- Context doc: 06_User_RBAC

## Context

Today's authentication is a self-issued JWT (jjwt 0.11.5, HS256, claims `role`/`email`/
`userId`, 86400s expiry) validated by Spring Security in stateless mode, with BCrypt(12) for
password storage — no external identity provider (brief §1). The target vision needs the JWT
to carry `tenant_id` + site scope in addition to role (`04_Multi_Tenant_Design` ADR-0402), and
raises Keycloak/OIDC as an optional future identity provider (brief §3.9). The question is
whether to introduce an external IdP now, alongside the tenant-claim work, or continue
self-issuing tokens and defer IdP adoption.

## Decision

**Keep the existing custom JWT issuance** (extended with `tenant_id`/`site_ids[]` claims per
ADR-0402) as the authentication mechanism for the near-term multi-tenant rollout. Do not
introduce Keycloak/OIDC now. Structure the `iam` module's token-issuance and validation code
behind a narrow internal interface (`TokenIssuer`/`TokenValidator`) so that swapping to an
OIDC-issued token later is a contained change, not a rewrite. Revisit external IdP adoption
when a concrete driver appears: enterprise tenant SSO requirements (SAML/OIDC federation),
need for centralized session/device management, or MFA requirements beyond what a
homegrown solution should own.

## Alternatives considered

- **Adopt Keycloak/OIDC now** — pros: get SSO, MFA, centralized session revocation, and a
  battle-tested token/claims model "for free"; standard tooling for multi-tenant realm
  modeling. cons: adds a new stateful, operationally significant service to run (Keycloak
  itself needs its own HA/backup story) before there's a single paying multi-tenant customer;
  today's JWT+BCrypt code already works and migrating login/session code mid-flight adds risk
  to the higher-priority tenancy rollout (ADR-0401/0402); no current requirement (no
  enterprise SSO ask yet) justifies the operational cost.
- **Hybrid — self-issued JWT now, OIDC-compatible claim shape from day one** (chosen,
  refined) — the decision above already does this: the JWT claim shape (`sub`, `role`,
  `tenant_id`, `site_ids`, `exp`) is deliberately unremarkable/OIDC-adjacent so a future
  Keycloak-issued token could carry equivalent claims with minimal downstream (`tenancy`,
  `06_User_RBAC` authorization) code change.
- **Keep custom JWT indefinitely, never adopt OIDC** — pros: no future migration cost; cons:
  forecloses enterprise SSO as a sales requirement, which the Enterprise plan tier
  (`05_Subscription_Billing`) is likely to eventually need — rejected as too rigid for a
  brief that explicitly names Enterprise as a tier.

## Consequences

- Positive: near-term multi-tenant work proceeds without adding a new operational dependency;
  existing login/JWT code, tests, and frontend `auth_token`/localStorage handling continue to
  work with additive changes only (new claims, not a new protocol).
- Negative / trade-offs: today's known weaknesses carry forward until addressed by a separate
  effort — JWT in `localStorage` is XSS-exposed (frontend should migrate toward an httpOnly
  cookie or in-memory token with silent refresh, tracked as a follow-up, not blocked on OIDC);
  no MFA, no centralized revocation (a compromised token is valid until its 86400s expiry
  elapses — consider shortening expiry + refresh tokens as an interim hardening step); no SSO
  for enterprise tenants until OIDC is adopted.
- Follow-ups: track a concrete trigger (first enterprise tenant requesting SSO, or a security
  review requiring MFA) that promotes OIDC adoption from optional to planned; evaluate
  moving the frontend off `localStorage` token storage independently of this ADR; add a
  refresh-token flow if 86400s proves too long for multi-tenant risk tolerance (see
  `04_Multi_Tenant_Design` ADR-0402 open question on site-membership changes mid-token).
