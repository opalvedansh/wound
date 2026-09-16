-- =============================================================================
-- P0 database lockdown (one-off runbook)
-- =============================================================================
-- Purpose: wipe the test schema and make sure no client key (anon/authenticated)
-- can read data or storage objects. The fresh schema comes back in M1 through
-- Prisma migrations.
--
-- DESTRUCTIVE: drops every table, view and function in `public`.
-- Only run it because the database holds TEST DATA ONLY (confirmed).
--
-- Before running:
--   1. Rotate the Supabase keys, the DB password and the JWT signing key.
--   2. Take a backup if you want to keep the test data for reference.
-- How to run: Supabase dashboard → SQL Editor, as `postgres`.
--   Run PART A, then PART B, then the VERIFY queries.
--
-- Dashboard steps that go with this script:
--   - Integrations → Data API → turn "Enable Data API" OFF. Nothing should reach
--     tables through PostgREST anymore; data goes through the NestJS API.
--   - Storage → `images` bucket → "Empty bucket". Objects must be deleted through
--     the Storage API or dashboard; a SQL DELETE leaves the files orphaned.
--   - Authentication → Sign In / Providers → turn "Allow new users to sign up" OFF.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- PART A: public schema
-- -----------------------------------------------------------------------------
BEGIN;

-- A1. Drop triggers on auth.users that call functions in `public`.
-- The old user-sync trigger writes to public."User"; once that table is gone,
-- every new sign-in or invite would fail inside the trigger.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT t.tgname
    FROM pg_trigger t
    JOIN pg_proc p ON p.oid = t.tgfoid
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE t.tgrelid = 'auth.users'::regclass
      AND NOT t.tgisinternal
      AND n.nspname = 'public'
  LOOP
    EXECUTE format('DROP TRIGGER %I ON auth.users', r.tgname);
  END LOOP;
END $$;

-- A2. Drop all views and tables in `public`, skipping anything owned by an extension.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.relname, c.relkind
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('v', 'm', 'r', 'p')
      AND NOT EXISTS (
        SELECT 1 FROM pg_depend d
        WHERE d.classid = 'pg_class'::regclass AND d.objid = c.oid AND d.deptype = 'e'
      )
    ORDER BY CASE c.relkind WHEN 'v' THEN 0 WHEN 'm' THEN 1 ELSE 2 END
  LOOP
    EXECUTE format(
      CASE r.relkind
        WHEN 'v' THEN 'DROP VIEW IF EXISTS public.%I CASCADE'
        WHEN 'm' THEN 'DROP MATERIALIZED VIEW IF EXISTS public.%I CASCADE'
        ELSE 'DROP TABLE IF EXISTS public.%I CASCADE'
      END,
      r.relname
    );
  END LOOP;
END $$;

-- A3. Drop leftover functions and procedures in `public`, skipping extension-owned ones.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind IN ('f', 'p')
      AND NOT EXISTS (
        SELECT 1 FROM pg_depend d
        WHERE d.classid = 'pg_proc'::regclass AND d.objid = p.oid AND d.deptype = 'e'
      )
  LOOP
    EXECUTE format('DROP ROUTINE IF EXISTS %s CASCADE', r.sig);
  END LOOP;
END $$;

-- A4. Client roles get nothing in `public`, now or later.
-- Default privileges must be altered FOR ROLE postgres; migrations create objects as postgres.
REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated, service_role;
-- New functions are otherwise executable by PUBLIC, which anon/authenticated inherit.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

COMMIT;


-- -----------------------------------------------------------------------------
-- PART B: storage
-- Separate transaction: if the platform refuses a statement, PART A stays
-- applied and this step can be done in the dashboard instead
-- (bucket settings → turn "Public bucket" off; Storage → Policies → delete).
-- -----------------------------------------------------------------------------
BEGIN;

-- B1. Every bucket is private.
UPDATE storage.buckets SET public = false WHERE public;

-- B2. Drop every policy on storage.objects, so client roles see no objects.
-- The API signs URLs server-side, so it doesn't need these policies.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
  LOOP
    EXECUTE format('DROP POLICY %I ON storage.objects', r.policyname);
  END LOOP;
END $$;

COMMIT;


-- -----------------------------------------------------------------------------
-- VERIFY (read-only). Every query should return the expected value shown.
-- -----------------------------------------------------------------------------

-- V1. Expect 0: no tables left in public.
SELECT count(*) AS public_tables FROM pg_tables WHERE schemaname = 'public';

-- V2. Expect 0 rows: no auth.users triggers calling public functions.
SELECT t.tgname
FROM pg_trigger t
JOIN pg_proc p ON p.oid = t.tgfoid
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE t.tgrelid = 'auth.users'::regclass AND NOT t.tgisinternal AND n.nspname = 'public';

-- V3. Expect 0 rows: postgres's default privileges in public no longer grant to client roles.
-- (Entries owned by supabase_admin may still exist; they don't apply to objects our migrations create.)
SELECT pg_get_userbyid(a.defaclrole) AS owner, a.defaclobjtype, a.defaclacl
FROM pg_default_acl a
JOIN pg_namespace n ON n.oid = a.defaclnamespace
WHERE n.nspname = 'public'
  AND pg_get_userbyid(a.defaclrole) = 'postgres'
  AND a.defaclacl::text ~ '(anon|authenticated)=';

-- V4. Expect 0: no public buckets.
SELECT count(*) AS public_buckets FROM storage.buckets WHERE public;

-- V5. Expect 0: no policies on storage.objects.
SELECT count(*) AS object_policies FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects';

-- -----------------------------------------------------------------------------
-- VERIFY from outside (shell), using the NEW anon key:
--
--   export SUPABASE_URL=...  ANON=...
--
--   # Expect an error (Data API disabled or table missing), never rows:
--   curl -s "$SUPABASE_URL/rest/v1/Patient?select=*" \
--     -H "apikey: $ANON" -H "Authorization: Bearer $ANON"
--
--   # Expect [] or an error, never object names:
--   curl -s -X POST "$SUPABASE_URL/storage/v1/object/list/images" \
--     -H "apikey: $ANON" -H "Authorization: Bearer $ANON" \
--     -H "Content-Type: application/json" -d '{"prefix":""}'
--
--   # With the OLD service-role key: expect 401 (key rotated).
--   # Web app running: POST <web-url>/api/auth/signup → expect 404.
-- -----------------------------------------------------------------------------
