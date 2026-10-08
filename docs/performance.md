# Performance

How the backend stays fast as clinics, users and records grow, and what was measured.

## Design

| Concern | How it's handled |
| --- | --- |
| Many users | Stateless API: any instance serves any request (sessions are JWTs checked locally against Supabase's keys; memberships cached in Redis). Add instances to add capacity. |
| Database connections | Supabase transaction pooler + a small pool per instance (`DB_POOL_MAX`); statement timeout 15 s. |
| Query cost | Every list is paginated (keyset on an index, 25 per page); every query is scoped by `clinicId` and backed by an index (trigram GIN for name/ID search); nested reads are one SQL statement (Prisma relation joins). |
| Lists and dashboards | Read summary columns kept on each wound and patient (status, visit count, first/latest area, next visit) instead of scanning visits. |
| Repeated reads | Redis read-through cache for the dashboard, queue counts, first pages of lists and `/me`, invalidated by a per-clinic version number bumped on every write; concurrent misses share one load (no stampede). |
| Browser round trips | ETags (unchanged responses are 304s), compression, TanStack Query cache (revisited pages render instantly), hover prefetch, thumbnails instead of full photos, signed photo URLs stable for hours so browsers cache images. |
| Slow work | The model call, thumbnails, review forwarding and clean-up run as BullMQ jobs with retries, never inside a request. |
| Abuse | Per-user rate limits in Redis (stricter for uploads and exports); Idempotency-Key on creates. |
| Mobile | Offline-first: the app reads its own copy; sync sends only changed fields and pulls only what changed. |

## Measured (2026-10-08)

Synthetic clinic (`tools/seed-load.mjs`): 5,000 patients, 6,000 wounds, 18,000 analysed visits.

### Query plans (`EXPLAIN ANALYZE` on the database)

| Query | Time | Plan |
| --- | --- | --- |
| Patients, newest page | 0.9 ms | index scan `Patient(clinicId, createdAt)` |
| Patients, deep keyset page | 0.3 ms | same index |
| Patient search "verma" / "wm-04" | 1.0 / 0.3 ms | index scan (trigram GIN when matches are rare) |
| Patients, overdue filter | 1.1 ms | index scan |
| Queue, AI drafts | 0.5 ms | index `AIResult(clinicId, reviewStatus, urgent, createdAt)` |
| Queue, wounds to review | 4.3 ms | sequential scan of 6,000 wounds (planner's choice at this size; index on `(clinicId, status, nextVisitDue)` takes over as it grows) |
| Dashboard, visits per week | 10 ms | index `AIResult(clinicId, createdAt)` |
| Case, visits page | 0.3 ms | nested index scans |

### Load (autocannon, 50 connections, 10 s each)

One API process (production build) and Redis (Docker) on a laptop, with the real database (Seoul, ~170 ms
round trip from the laptop):

| Endpoint | Requests/s | p50 | p90 | p99 | Errors |
| --- | --- | --- | --- | --- | --- |
| `GET /dashboard` | 1,360 | 22 ms | 43 ms | 77 ms | 0 |
| `GET /queue/counts` | 1,079 | 39 ms | 76 ms | 147 ms | 0 |
| `GET /patients?limit=25` | 718 | 49 ms | 88 ms | 661 ms | 0 |
| `GET /patients?q=verma` | 977 | 40 ms | 77 ms | 278 ms | 0 |
| `GET /queue?view=attention` | 658 | 50 ms | 127 ms | 567 ms | 0 |
| `GET /me` | 1,081 | 30 ms | 68 ms | 221 ms | 0 |

Before the cache stampede fix and first-page caching, the same run gave 57 requests/s for the patient list
(p50 861 ms), 25 requests/s for the queue, and 28 errors on a cold dashboard (50 requests each computing it at
once exhausted the connection pool).

Uncached reads cost one database round trip, so their latency is the distance to the database: ~1 ms queries,
plus roughly 70 ms from Render Singapore to Seoul, versus the ~170 ms measured from the laptop. A page of patients in the portal is
one request.

### What 1,000,000 users needs

The free tiers carry a pilot (a few clinics). The design scales by adding, not rewriting: more API instances
behind Render's load balancer, a separate worker service for analyses, Supabase Pro for connections and storage
(1M users with photos is terabytes; photos are already private objects with 320 px thumbnails), Upstash
pay-as-you-go, and model replicas on a GPU host. Rough sizing: each API instance handles ~700–1,300 cached reads/s;
clinic users make a few requests a minute, so a handful of instances serve tens of thousands of concurrent users,
with the database (indexed, one round trip per request) and the model (one call per photo, queued) as the parts to
scale next.

## Reproduce

```bash
node --env-file=.env tools/seed-load.mjs > /tmp/load.json           # prints {clinicId, token}
RATE_LIMIT_PER_MINUTE=10000000 NODE_ENV=production node dist/apps/api/main.js
npx autocannon -c 50 -d 10 -H "Authorization=Bearer $(jq -r .token /tmp/load.json)" http://localhost:3333/api/patients?limit=25
node --env-file=.env tools/seed-load.mjs --drop                     # remove the synthetic clinic
```
