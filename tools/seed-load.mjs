#!/usr/bin/env node
/**
 * A large synthetic clinic for load tests and query plans: 5,000 patients, ~6,000 wounds and ~18,000 analysed
 * visits (no photos), generated inside Postgres. Prints a sign-in token for an admin of that clinic.
 *
 *   node --env-file=.env tools/seed-load.mjs            # create (or reuse) and print a token
 *   node --env-file=.env tools/seed-load.mjs --drop     # delete the clinic, its data and its admin
 *
 * Everything is fake (names from a short list); nothing is a real patient.
 */
import { createClient } from '@supabase/supabase-js';
import pg from 'pg';

const NAME = 'Load test clinic (synthetic)';
const EMAIL = 'load-test-admin@example.com';
const PATIENTS = Number(process.env.SEED_PATIENTS ?? 5000);

const supa = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const db = new pg.Client({ connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL });
await db.connect();

async function findUser() {
  for (let page = 1; page <= 20; page++) {
    const { data } = await supa.auth.admin.listUsers({ page, perPage: 200 });
    const u = data.users.find((x) => x.email === EMAIL);
    if (u || data.users.length < 200) return u ?? null;
  }
  return null;
}

if (process.argv.includes('--drop')) {
  const clinics = await db.query(`SELECT id FROM "Clinic" WHERE name = $1`, [NAME]);
  for (const c of clinics.rows) await db.query(`DELETE FROM "Clinic" WHERE id = $1`, [c.id]);
  const u = await findUser();
  if (u) {
    await db.query(`DELETE FROM "User" WHERE id = $1`, [u.id]);
    await supa.auth.admin.deleteUser(u.id);
  }
  console.log(`Removed ${clinics.rowCount} clinic(s) and the admin.`);
  await db.end();
  process.exit(0);
}

const password = `${crypto.randomUUID()}Aa1!`;
let user = await findUser();
if (user) await supa.auth.admin.updateUserById(user.id, { password });
else user = (await supa.auth.admin.createUser({ email: EMAIL, password, email_confirm: true })).data.user;

let clinicId = (await db.query(`SELECT id FROM "Clinic" WHERE name = $1`, [NAME])).rows[0]?.id;
if (!clinicId) {
  const t0 = Date.now();
  clinicId = (await db.query(`INSERT INTO "Clinic" (id, name, "patientSeq", "updatedAt") VALUES (gen_random_uuid(), $1, $2, now()) RETURNING id`, [NAME, PATIENTS])).rows[0].id;
  await db.query(`INSERT INTO "User" (id, email, "firstName", "lastName", "updatedAt") VALUES ($1, $2, 'Load', 'Admin', now()) ON CONFLICT (id) DO NOTHING`, [user.id, EMAIL]);
  await db.query(`INSERT INTO "Membership" (id, "userId", "clinicId", role, "updatedAt") VALUES (gen_random_uuid(), $1, $2, 'ADMIN', now())`, [user.id, clinicId]);
  await db.query('BEGIN');
  await db.query(
    `INSERT INTO "Patient" (id, "clinicId", "patientId", "firstName", "lastName", sex, "ageYears", consent, "searchText", "createdAt", "updatedAt")
     SELECT gen_random_uuid(), $1, 'WM-' || lpad(i::text, 5, '0'), f, l, (ARRAY['M','F'])[1 + i % 2], 30 + i % 60,
            '{"care":true,"photos":true,"location":false,"aiTraining":false,"noticeVersion":"dpdp-1"}'::jsonb,
            lower(f || ' ' || l || ' wm-' || lpad(i::text, 5, '0')), now() - (i % 180) * interval '1 day', now()
     FROM generate_series(1, $2::int) i,
          LATERAL (SELECT (ARRAY['Asha','Ravi','Meena','Arjun','Priya','Kiran','Sunil','Lata','Vikram','Neha','Rohan','Divya','Amit','Pooja','Rahul'])[1 + (i * 7) % 15] AS f,
                          (ARRAY['Kumar','Sharma','Verma','Rao','Iyer','Patel','Singh','Das','Nair','Gupta','Reddy','Joshi'])[1 + (i * 11) % 12] AS l) n`,
    [clinicId, PATIENTS],
  );
  // One wound per patient, a second one for every fifth.
  await db.query(
    `INSERT INTO "Case" (id, "clinicId", "patientId", onset, location, "woundType", comorbidities, "createdAt", "updatedAt")
     SELECT gen_random_uuid(), p."clinicId", p.id, p."createdAt" - interval '10 days',
            (ARRAY['Left heel','Right heel','Sacrum','Left lower leg','Right foot','Abdomen'])[1 + k % 6],
            (ARRAY['Diabetic foot ulcer','Pressure injury','Venous leg ulcer','Surgical wound','Burn'])[1 + (k * 3) % 5],
            CASE WHEN k % 3 = 0 THEN ARRAY['Diabetes'] ELSE ARRAY[]::text[] END, p."createdAt", now()
     FROM (SELECT p.*, row_number() OVER () AS k FROM "Patient" p WHERE p."clinicId" = $1) p, generate_series(1, CASE WHEN p.k % 5 = 0 THEN 2 ELSE 1 END)`,
    [clinicId],
  );
  // Three visits per wound on average, area shrinking (or growing for one in eight).
  await db.query(
    `WITH t AS (
       INSERT INTO "Treatment" (id, "clinicId", "caseId", sequence, therapy, "nextVisit", "createdAt", "updatedAt")
       SELECT gen_random_uuid(), c."clinicId", c.id, s, ARRAY['Cleansing','Dressing'], (c."createdAt" + (s * 7 + 7) * interval '1 day')::date,
              c."createdAt" + s * 7 * interval '1 day', now()
       FROM (SELECT c.*, row_number() OVER () AS k FROM "Case" c WHERE c."clinicId" = $1) c, generate_series(1, 2 + (c.k % 3)::int) s
       RETURNING id, "clinicId", sequence, "createdAt"
     ), ph AS (
       INSERT INTO "Phase" (id, "clinicId", "treatmentId", "phaseType", "createdAt", "updatedAt")
       SELECT gen_random_uuid(), t."clinicId", t.id, 'PRE', t."createdAt", now() FROM t
       RETURNING id, "clinicId", "treatmentId", "createdAt"
     )
     INSERT INTO "AIResult" (id, "clinicId", "phaseId", status, area, length, height, "confidenceScore", findings, intake, urgent, "flagCount", "reviewStatus", "createdAt", "updatedAt")
     SELECT gen_random_uuid(), ph."clinicId", ph.id, 'ok', a, round((sqrt(a) * 1.3)::numeric, 2), round((sqrt(a) * 0.8)::numeric, 2), 0.8,
            jsonb_build_object('status', 'ok', 'wound_type', jsonb_build_object('label', 'pressure', 'prob', 0.8, 'top', '[]'::jsonb)),
            '{}'::jsonb, random() < 0.05, (random() * 3)::int,
            CASE WHEN ph."createdAt" < now() - interval '14 days' THEN 'approved' ELSE 'pending' END, ph."createdAt", now()
     FROM ph JOIN t ON t.id = ph."treatmentId",
          LATERAL (SELECT round((12 * CASE WHEN random() < 0.125 THEN 1 + t.sequence * 0.1 ELSE 1 - t.sequence * 0.15 END)::numeric, 2)::float8 AS a) x`,
    [clinicId],
  );
  // Summary columns, as SummaryService keeps them.
  await db.query(
    `UPDATE "Case" c SET "visitCount" = s.n, "lastVisitAt" = s.last, "firstAreaCm2" = s.first_area, "latestAreaCm2" = s.last_area,
            "latestResultId" = s.last_id, "nextVisitDue" = s.next_due,
            status = CASE WHEN s.next_due < current_date THEN 'overdue' WHEN s.last_area > s.first_area * 1.1 THEN 'review' ELSE 'healing' END,
            "statusReason" = CASE WHEN s.next_due < current_date THEN 'Visit overdue' WHEN s.last_area > s.first_area * 1.1 THEN 'Wound grew since the first visit' END
     FROM (
       SELECT t."caseId", count(*) n, max(r."createdAt") last,
              (array_agg(r.area ORDER BY r."createdAt"))[1] first_area, (array_agg(r.area ORDER BY r."createdAt" DESC))[1] last_area,
              (array_agg(r.id ORDER BY r."createdAt" DESC))[1] last_id, max(t."nextVisit") next_due
       FROM "Treatment" t JOIN "Phase" p ON p."treatmentId" = t.id JOIN "AIResult" r ON r."phaseId" = p.id
       WHERE t."clinicId" = $1 GROUP BY t."caseId"
     ) s WHERE c.id = s."caseId"`,
    [clinicId],
  );
  await db.query(
    `UPDATE "Patient" p SET "lastVisitAt" = s.last, "nextVisitDue" = s.next_due, status = s.status
     FROM (SELECT "patientId", max("lastVisitAt") last, min("nextVisitDue") next_due,
                  CASE WHEN bool_or(status = 'overdue') THEN 'overdue' WHEN bool_or(status = 'review') THEN 'review' ELSE 'healing' END status
           FROM "Case" WHERE "clinicId" = $1 GROUP BY "patientId") s
     WHERE p.id = s."patientId"`,
    [clinicId],
  );
  await db.query('COMMIT');
  await db.query('ANALYZE "Patient", "Case", "Treatment", "Phase", "AIResult"');
  console.error(`Seeded in ${Math.round((Date.now() - t0) / 1000)} s.`);
}

const counts = await db.query(
  `SELECT (SELECT count(*) FROM "Patient" WHERE "clinicId" = $1) patients, (SELECT count(*) FROM "Case" WHERE "clinicId" = $1) cases,
          (SELECT count(*) FROM "AIResult" WHERE "clinicId" = $1) visits`,
  [clinicId],
);
console.error(`Clinic ${clinicId}: ${JSON.stringify(counts.rows[0])}`);
const anon = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
const { data } = await anon.auth.signInWithPassword({ email: EMAIL, password });
console.log(JSON.stringify({ clinicId, token: data.session.access_token }));
await db.end();
