# Deploying the prototype

Three services, three free hosts. Deploy them in this order, because each one needs the address of the one before.

| Service | Code | Host | Config in the repo |
| --- | --- | --- | --- |
| Wound model API | `wound-ai/` | Hugging Face Space (Docker) | `wound-ai/Dockerfile` |
| NestJS API | `apps/api` | Render (web service) | `render.yaml` |
| Web portal | `apps/web` | Vercel | `vercel.json` |

The database, sign-in and photo storage are the Supabase project already set up (migrations in `prisma/migrations`).
Browsers only ever talk to the web portal and the NestJS API; the model API is called by the NestJS API alone,
with a shared key.

Everything here is a **research prototype, not for patient care**: no real patient photos until the ethics and
regulatory steps in `wound-ai/docs/roadmap.md` are done, and patient data must move to an India-region database
before then.

## 1. Model: Hugging Face Space

1. Create a **private model repo** (e.g. `you/wound-models`) and upload the trained `*.pt` files (`boundary.pt`,
   `wound_type.pt`, `pu_stage.pt`) as you train them. They are never committed to git.
2. Create a **Space**: SDK *Docker*, hardware *CPU basic*, visibility private if your plan allows.
3. Push the contents of `wound-ai/` to the Space repo, and add this at the top of the Space's `README.md`:

   ```yaml
   ---
   title: Wound model API
   sdk: docker
   app_port: 7860
   ---
   ```

4. Space **secrets**: `WOUND_API_KEY` (a long random string), `HF_MODEL_REPO` (`you/wound-models`) and `HF_TOKEN`
   (a read token for that repo).
5. Check: `https://<space>.hf.space/health` lists the model versions. The Space sleeps when idle; the NestJS API
   retries once to cover the wake-up.

## 2. API: Render

1. Render → **New → Blueprint** → this GitHub repo. It reads `render.yaml`.
2. Fill in the secrets it asks for: the Supabase values from `.env`, `WOUND_API_URL` = the Space URL,
   `WOUND_API_KEY` = the Space's key, `CORS_ORIGINS` = the Vercel URL (add it after step 3, then redeploy).
3. Check: `https://<service>.onrender.com/api` answers. The free plan sleeps after 15 minutes idle.

## 3. Web portal: Vercel

1. Vercel → **New Project** → this repo → Root Directory **`./`** (the repo root). `vercel.json` sets the install,
   build and output commands.
2. Environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_API_URL` = `https://<service>.onrender.com/api`
   - `DATABASE_URL` and `DIRECT_URL` (the build runs `prisma generate`; the PDF report route reads the database)
3. `NEXT_PUBLIC_*` values are fixed at build time: redeploy after changing them.
4. Never add `WOUND_API_KEY` or the Supabase secret key here.

## After deploying

- Add the Vercel URL to Render's `CORS_ORIGINS`, and to Supabase → Authentication → URL Configuration.
- Sign in on a phone, run one visit with the printed sticker, and approve the draft.
