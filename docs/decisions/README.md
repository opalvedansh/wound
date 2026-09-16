# Architecture decision records

**How these files work:**
- Each file records one decision.
- A new decision gets the next number.
- To change a decision, write a new record that replaces the old one, and update the old record's status.

**What each record contains:** Status, Date, where it takes effect, Context, Decision and Consequences.

**Security-critical records:** a person must review code that implements them before it's merged.

| # | Decision | Status |
|---|---|---|
| [0001](0001-prisma-client-generator.md) | Generate the Prisma client with `prisma-client`, CommonJS output | Accepted |
| [0002](0002-app-api-role-per-transaction.md) | The API reads and writes tenant data as role `app_api`, set per transaction | Accepted |
| [0003](0003-membership-and-invite-lookups-under-rls.md) | Membership and invite lookups run under RLS, with no bypass | Accepted |
| [0004](0004-db-access-rule-jest-test.md) | A Jest test enforces the database-access rule | Accepted |
| [0005](0005-buffered-view-audit.md) | View-audit events are written in batches | Accepted |
