#!/usr/bin/env node
/**
 * Creates a clinic and makes an existing sign-in account its first admin. After that, the admin invites
 * everyone else from the portal (Settings → Members).
 *
 *   node --env-file=.env tools/bootstrap-clinic.mjs you@example.com "Clinic name"
 *
 * Needs SUPABASE_URL, SUPABASE_SECRET_KEY and DATABASE_URL. Safe to run again: an existing membership is kept.
 */
import { createClient } from '@supabase/supabase-js';
import pg from 'pg';

const [email, clinicName = 'My clinic'] = process.argv.slice(2);
if (!email) {
  console.error('usage: node --env-file=.env tools/bootstrap-clinic.mjs <email> [clinic name]');
  process.exit(1);
}

const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
let user;
for (let page = 1; page <= 50 && !user; page++) {
  const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
  if (error) throw error;
  if (!data.users.length) break;
  user = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
}
if (!user) {
  console.error(`No sign-in account for ${email}. Add it in Supabase → Authentication → Users first.`);
  process.exit(1);
}

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
try {
  await db.query('BEGIN');
  await db.query(
    `INSERT INTO "User" (id, email, "updatedAt") VALUES ($1, $2, now()) ON CONFLICT (id) DO NOTHING`,
    [user.id, user.email],
  );
  const existing = await db.query(`SELECT m."clinicId", c.name FROM "Membership" m JOIN "Clinic" c ON c.id = m."clinicId" WHERE m."userId" = $1 AND m.role = 'ADMIN' LIMIT 1`, [user.id]);
  if (existing.rows.length) {
    console.log(`${email} is already an admin of "${existing.rows[0].name}" (${existing.rows[0].clinicId}).`);
  } else {
    const clinic = await db.query(`INSERT INTO "Clinic" (id, name, "updatedAt") VALUES (gen_random_uuid(), $1, now()) RETURNING id`, [clinicName]);
    await db.query(
      `INSERT INTO "Membership" (id, "userId", "clinicId", role, "updatedAt") VALUES (gen_random_uuid(), $1, $2, 'ADMIN', now())`,
      [user.id, clinic.rows[0].id],
    );
    console.log(`Created "${clinicName}" (${clinic.rows[0].id}) with ${email} as admin.`);
  }
  await db.query('COMMIT');
} catch (error) {
  await db.query('ROLLBACK');
  throw error;
} finally {
  await db.end();
}
