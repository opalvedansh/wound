# ADR-0001: Generate the Prisma client with `prisma-client`, CommonJS output

- **Status:** Accepted. This replaces the M1 plan's "keep `prisma-client-js`".
- **Date:** 2026-09-16
- **Takes effect:** T6, when the schema is rewritten

## Context

The M1 plan said to keep the `prisma-client-js` generator for two reasons:
- The newer `prisma-client` generator was expected to cause ESM problems in the API's CommonJS build.
- The switch would only be needed if partial indexes required it.

T1 checked both on Prisma 7.10.0, using a scratch schema and no database:

| Check | `prisma-client-js` | `prisma-client` |
|---|---|---|
| `prisma validate` with `previewFeatures = ["partialIndexes"]` | passes | passes |
| `prisma generate` | works | works |
| Generated client compiles with the API's compiler options (CommonJS, `bundler` resolution) and loads in Node 22 | not applicable (prebuilt in `node_modules`) | works with `moduleFormat = "cjs"` and `importFileExtension = ""` |

`prisma migrate diff` doesn't depend on the generator. It emitted `CREATE UNIQUE INDEX … WHERE (deleted_at IS NULL)` as expected.

Other findings:

- **The old generator is deprecated.** Prisma's v7 generator reference says: "The `prisma-client-js` generator is deprecated."
- **Prisma 8 is close.** It's at release candidate: on 2026-09-16, npm's `latest` tag for `prisma` points to `8.0.0-rc.15`, and no v8 upgrade guide has been published.
- **A security fix may need a new major version.** `npm audit` reports high-severity advisories in dependencies of the `prisma` CLI (`@prisma/config` → `deepmerge-ts`, and `mysql2`), and the only fix it offers is a different major version. Staying on a deprecated generator could block that upgrade.
- **Without `importFileExtension = ""`, the generated client fails at runtime.** It imports `./internal/class.ts`, and the compiled CommonJS output fails with `Cannot find module './internal/class.ts'`.

So the ESM concern is solved by configuration, and the old generator is on its way out.

## Decision

From T6, `prisma/schema.prisma` uses:

```prisma
generator client {
  provider            = "prisma-client"
  output              = "../apps/api/src/infra/db/generated"
  moduleFormat        = "cjs"
  importFileExtension = ""
  previewFeatures     = ["partialIndexes"]
}
```

- **Location:** the generated client lives inside `infra/db`, is git-ignored, and compiles as part of the API.
- **Access:** only `infra/db` may import the generated client (ADR-0004).
- **Order:** `prisma generate` runs before type-checking, tests and builds, both locally and in CI.
- **Version:** Prisma packages stay on 7.x. Don't run `npm i prisma@latest` while `latest` points at a pre-release.

## Consequences

- **No extra rewrite.** The switch happens while the schema and all database code are being rewritten anyway (T6, T7), so no working module has to change.
- **Existing `@prisma/client` users are replaced in T6 or T7.** They are `apps/api/src/app/prisma.service.ts`, `packages/domain/src/lib/prisma.ts` (used by the web report route) and `apps/web/src/app/api/assessment-questions/route.ts`.
- **Pitfall (both generators): don't use `findUnique` or `upsert` on a partial unique key.** Prisma lists a partial unique key such as `orgId_externalId` as a `findUnique`/`upsert` key. Postgres enforces it only where `deleted_at IS NULL`, so a soft-deleted row can match. Look rows up by such a key with `findFirst` plus `deletedAt: null`.
- **Still to verify in T6 (needs a database):** `prisma migrate dev` reports no drift after the partial indexes are applied.
- **Revisit** this decision before upgrading to Prisma 8.
