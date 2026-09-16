# ADR-0004: A Jest test enforces the database-access rule

- **Status:** Accepted
- **Date:** 2026-09-16
- **Takes effect:** T7 (`apps/api/src/infra/db/db-access.spec.ts`)
- **Security-critical:** yes. A person reviews every change to this.

## Context

Clinic isolation depends on every query going through `withTenant` (ADR-0002). A single stray `new PrismaClient()` or unsafe raw query would skip RLS. Code review alone isn't enough, so the rule has to be checked automatically.

The repo has no ESLint setup (the Nx generators are configured with `linter: none`). Adding ESLint and typescript-eslint across four projects is a bigger change than this rule needs.

## Decision

A Jest test in the API's unit tests reads every `apps/api/src/**/*.ts` file outside `apps/api/src/infra/db/`. It fails, naming the file and line, if it finds any of these:

- an import or `require` of `@prisma/client`, `@prisma/adapter-pg`, `pg`, or the generated client (ADR-0001)
- an import from inside `infra/db` other than its public entry point
- `$queryRawUnsafe` or `$executeRawUnsafe`
- `SET ROLE`, `RESET ROLE` or `set_config` inside a string

The test also runs its checks on a fixture that contains every violation, and it fails unless all of them are reported. A broken pattern therefore can't pass silently.

## Consequences

- **Where it runs:** everywhere the unit tests run, locally (`npm run test:api`) and in CI.
- **Its limit:** it's a text scan. It catches mistakes, not deliberate evasion such as a computed `require`. Code review covers the rest.
- **If ESLint is added later:** move the import checks to `no-restricted-imports`, and keep this test for the SQL patterns.
