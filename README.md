# Wound care: photo → AI draft → clinician review

A clinician photographs a wound beside a printed calibration sticker and answers a few questions. An AI model
outlines and measures the wound, estimates its type, raises red flags from the answers, and drafts a report.
The clinician approves, edits or rejects the draft; nothing reaches the record without that review.

**Research prototype, not for patient care.** It is trained on public datasets only. No real patient photos
until the ethics, clinical-validation and regulatory steps in [`wound-ai/docs/roadmap.md`](wound-ai/docs/roadmap.md)
are done.

## How it fits together

```
 Web portal (apps/web, Next.js) ───────────┐                    ┌─► Postgres (Supabase): clinic-scoped, indexed
 Mobile app (apps/mobile, Expo, offline) ──┼─► NestJS API ──────┼─► Redis: cache, rate limits, job queue
                                           │   (apps/api,       ├─► Supabase Storage: private photos + thumbnails
                                           │    stateless)      └─► background jobs ──► wound model API (wound-ai)
                                           └─ sign-in: Supabase Auth (invite-only)
```

- **Clinics and roles.** Every record belongs to a clinic; members are admins, doctors or front-desk staff
  (front desk registers patients but sees no clinical data). Admins invite members and see the audit log.
- **Browsers and the app only talk to the API.** The API holds the model's key, stores photos privately, and sends
  the model only the photo and clinical answers, never a patient's identity.
- **Photos are analysed in the background:** a visit is saved at once as "processing"; a worker calls the model,
  writes the measurement and the AI draft, and makes a thumbnail. A clinician approves, edits or rejects the draft.
- **The mobile app works offline** and syncs field by field (`packages/domain/src/lib/sync.ts`).
- `packages/domain`: types and rules shared by the apps (API types, sync rules, model contract, question catalogue).
- `wound-ai/`: the model service, training scripts and the roadmap.
- How it stays fast at scale, with measurements: [`docs/performance.md`](docs/performance.md).

## Run it locally

You need Node 24, Python 3.12 (with [uv](https://docs.astral.sh/uv/)), Docker (for Redis), and the values in
`.env` (copy `.env.example`).

```bash
# 0. Redis on :6380 (once; afterwards `docker start wound-redis`)
docker run -d --name wound-redis -p 6380:6379 redis:7

# 1. Model (port 8010 here, because 8000 is taken on this Mac; WOUND_API_URL in .env must match)
cd wound-ai && set -a && . ../.env && set +a
CKPT_DIR=checkpoints .venv/bin/uvicorn api.server:app --port 8010

# 2. API on :3333 (also runs the background jobs)
npx nx serve api

# 3. Web portal on :3000
npx nx dev web

# 4. Mobile app in the browser on :19000 (or on a phone with Expo Go)
cd apps/mobile && npx expo start --web --port 19000
```

First time only: `uv venv --python 3.12 wound-ai/.venv`, install `torch torchvision` and
`wound-ai/requirements.txt` into it, `npm install`, `npx prisma generate`, `npx prisma migrate deploy`, and make
yourself the first admin: `node --env-file=.env tools/bootstrap-clinic.mjs you@example.com "Clinic name"`.

Trained weights go in `wound-ai/checkpoints/` (`boundary.pt` for the outline, `wound_type.pt` for the type).
They are never committed. Without them the model still runs the photo quality check, sticker detection and the
red-flag rules.

## Tests

```bash
cd wound-ai && .venv/bin/python -m pytest tests && .venv/bin/python scripts/smoke_test.py
npx jest -c packages/domain/jest.config.cts packages/domain
npx jest -c apps/api/jest.config.cts apps/api/src
```

CI runs all of these plus the type-checks, a check that the migrations rebuild the schema exactly, and the
production builds on every push (`.github/workflows/ci.yml`).

Against running services (each makes its own throwaway clinic and users, and deletes them afterwards):

```bash
node --env-file=.env tools/e2e-check.mjs      # 52 API checks: roles, tenancy, visits, queue, sync, share links…
node --env-file=.env tools/portal-check.mjs   # the portal in Chrome, as an admin and as front desk
node --env-file=.env tools/app-check.mjs      # the app's web build in Chrome: sign in, pull, register, push
```

## Training the models

- On a Mac (Apple GPU): see `wound-ai/README.md`; the data goes in `wound-ai/data/` (git-ignored).
- On Kaggle's free GPUs: [`wound-ai/notebooks/kaggle_train.ipynb`](wound-ai/notebooks/kaggle_train.ipynb) fetches
  the public datasets and trains the full-size models.

## Deploying

Supabase (database, sign-in, photos), Upstash (Redis), Hugging Face Space (model), Render (API and jobs), Vercel
(portal): [`docs/deploy.md`](docs/deploy.md).
