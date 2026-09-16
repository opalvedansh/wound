# ADR-0002: The API reads and writes tenant data as role `app_api`, set per transaction

- **Status:** Accepted
- **Date:** 2026-09-16
- **Takes effect:** T6 (role and grants), T7 (`withTenant`)
- **Security-critical:** yes. A person reviews every change to this.

## Context

Postgres row-level security (RLS) enforces clinic isolation in the database, not only in application code.

RLS doesn't apply to a table's owner or to roles with `BYPASSRLS`. Prisma migrations create the tables as `postgres`, so a connection that stays `postgres` would skip every policy.

Options:

1. **A separate login role for the API.** This adds a second database password to store and rotate. Supabase's connection pooler also needs a project-specific user name for it.
2. **Connect as `postgres`, then switch to a restricted role inside each transaction** with `SET LOCAL ROLE`.

## Decision

Option 2.

- **The role:** `app_api` is `NOLOGIN NOBYPASSRLS`, owns no tables, and gets only the grants it needs (T6). `postgres` is made a member of `app_api` so it can switch to it.
- **The connection:** the API connects as `postgres`. Every tenant transaction starts with these steps, in order:
  1. `SET LOCAL ROLE app_api`
  2. `set_config('app.org_id', …, true)` and `set_config('app.user_id', …, true)`
  3. `set_config('statement_timeout', …, true)` and `set_config('idle_in_transaction_session_timeout', …, true)`
- **Transaction-local only:** every setting uses `SET LOCAL` or `set_config(…, true)`, so nothing carries over to the next user of a pooled connection. Session-level `SET` is never used.
- **Why timeouts are set here:** settings attached to a role (`ALTER ROLE … SET`) apply at login, not on `SET ROLE`.
- **Who may do this:** only `infra/db` may run raw SQL or change roles (ADR-0004).

## Consequences

- **Simpler setup:** one database secret and one connection string.
- **Risk: the connection is privileged.** An SQL injection anywhere could run `RESET ROLE` and escape RLS. Mitigations:
  - Prisma parameterizes queries.
  - Unsafe raw-query methods are banned outside `infra/db` (ADR-0004).
  - A person reviews `infra/db`.
- **Risk: a query outside `withTenant` runs as `postgres`, with no RLS.** Mitigation: `infra/db` doesn't export the Prisma client (ADR-0004).
- **T7 integration tests must prove:**
  - no org set → 0 rows
  - another org's rows → 0 rows
  - an idle transaction is ended by the transaction-local timeout
- **Revisit** if the external security review (M7) asks for a dedicated login role, or once secrets are kept in a secrets manager.
