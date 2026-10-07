# Wound care: photo → AI draft → clinician review

A clinician photographs a wound beside a printed calibration sticker and answers a few questions. An AI model
outlines and measures the wound, estimates its type, raises red flags from the answers, and drafts a report.
The clinician approves, edits or rejects the draft; nothing reaches the record without that review.

**Research prototype, not for patient care.** It is trained on public datasets only. No real patient photos
until the ethics, clinical-validation and regulatory steps in [`wound-ai/docs/roadmap.md`](wound-ai/docs/roadmap.md)
are done.

## How it fits together

```
 Web portal (apps/web, Next.js) ──┐
 Mobile app (apps/mobile, Expo) ──┼─► NestJS API (apps/api) ──► wound model API (wound-ai, FastAPI + PyTorch)
                                  │        │
                                  │        └─► Supabase: Postgres (Prisma), private photo storage
                                  └─ sign-in: Supabase Auth
```

- Browsers only talk to the portal and the NestJS API. The API holds the model's key, stores photos privately,
  and sends the model only the photo and the clinical answers, never a patient's identity.
- `packages/domain`: types and rules shared by the apps (case status, report template, model contract).
- `wound-ai/`: the model service, training scripts, the 30-day build plan and the roadmap.

## Run it locally

You need Node 24, Python 3.12 (with [uv](https://docs.astral.sh/uv/)), and the values in `.env` (copy
`.env.example`). Three terminals:

```bash
# 1. Model (port 8010 here, because 8000 is taken on this Mac; WOUND_API_URL in .env must match)
cd wound-ai && set -a && . ../.env && set +a
CKPT_DIR=checkpoints .venv/bin/uvicorn api.server:app --port 8010

# 2. API on :3333
npx nx serve api

# 3. Web portal on :3000
npx nx dev web
```

First time only: `uv venv --python 3.12 wound-ai/.venv`, install `torch torchvision` and
`wound-ai/requirements.txt` into it, `npm install`, `npx prisma generate`, and `npx prisma migrate deploy`.

Trained weights go in `wound-ai/checkpoints/` (`boundary.pt` for the outline, `wound_type.pt` for the type).
They are never committed. Without them the model still runs the photo quality check, sticker detection and the
red-flag rules.

## Tests

```bash
cd wound-ai && .venv/bin/python -m pytest tests && .venv/bin/python scripts/smoke_test.py
npx jest -c packages/domain/jest.config.cts packages/domain
npx jest -c apps/api/jest.config.cts apps/api/src
```

CI runs all of these plus the type-checks on every push (`.github/workflows/ci.yml`).

## Training the models

- On a Mac (Apple GPU): see `wound-ai/README.md`; the data goes in `wound-ai/data/` (git-ignored).
- On Kaggle's free GPUs: [`wound-ai/notebooks/kaggle_train.ipynb`](wound-ai/notebooks/kaggle_train.ipynb) fetches
  the public datasets and trains the full-size models.

## Deploying

Hugging Face Space (model), Render (API), Vercel (portal): [`docs/deploy.md`](docs/deploy.md).
