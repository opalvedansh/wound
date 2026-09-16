# ADR-0003: Membership and invite lookups run under RLS, with no bypass

- **Status:** Accepted
- **Date:** 2026-09-16
- **Takes effect:** T4 (`OrgGuard`, with the database mocked), T6 (policies), T7 (`withUserScope`), T10 (invites)
- **Security-critical:** yes. A person reviews every change to this.

## Context

**The problem:** two lookups have to happen before the API knows which clinic the request belongs to.
- **Membership:** `OrgGuard` has to find the caller's clinic, so its `membership` query runs without `app.org_id` set. A policy that only checks `org_id = app.org_id` returns nothing.
- **Invites:** invite acceptance has the same problem, because the invite belongs to an org the caller hasn't joined yet.

**Why the usual fixes were rejected:** they bypass RLS, with a service-role connection or a `SECURITY DEFINER` function. Each adds a path where one bug exposes every clinic's data.

## Decision

- **Membership read policy:**

  ```sql
  org_id = nullif(current_setting('app.org_id', true), '')::uuid
  OR user_id = nullif(current_setting('app.user_id', true), '')::uuid
  ```

  Writes (`INSERT`, `UPDATE`, `DELETE`) use only the `org_id` condition.
- **`withUserScope(userId, fn)`** works like `withTenant` (ADR-0002) but sets only `app.user_id`. Every other table's policy needs `app.org_id`, so inside `withUserScope` the caller can read their own membership rows and nothing else.
- **Invite acceptance:**
  - **The link:** it carries the invite's org ID alongside the secret token.
  - **The lookup:** acceptance runs in `withTenant` for that org and finds the invite by token hash.
  - **Failures:** a wrong org ID or a wrong token finds nothing, and both return the same 404.
- **Why the `nullif(…, '')` is required:** once a pooled connection has used a custom setting, `current_setting(…, true)` returns an empty string instead of NULL, and `''::uuid` raises an error.

## Consequences

- **No bypass in the request path:** M1's request handling has no way around RLS.
- **Elevated rights appear in only two places:**
  - the `auth.users` sync trigger (T6), which runs inside the database as its owner
  - Supabase Auth admin calls that send invites, which don't touch our tables
- **`withTenant` doesn't check membership itself.**
  - **Normal requests:** callers pass the org that `OrgGuard` resolved.
  - **Invite acceptance (the one exception):** it uses the org from the link, and touches only that invite and the new membership row.
- **Users see all their own memberships:** a user can read every membership row of their own. In the pilot, each user has exactly one.
- **Extra T7 test:** a pooled connection that had `app.org_id` set by an earlier transaction still sees 0 rows when no org is set.
