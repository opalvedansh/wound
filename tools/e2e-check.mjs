#!/usr/bin/env node
/**
 * End-to-end check of the running stack (API + model + database + storage + Redis), with throwaway clinics and
 * logins that are deleted afterwards. Run after starting the services, or against a deployment:
 *
 *   node --env-file=.env tools/e2e-check.mjs [path/to/wound-photo.jpg]
 *
 * API_URL defaults to http://localhost:3333/api. The photo defaults to a FUSeg validation image if present.
 */
import { existsSync, readFileSync } from 'node:fs';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { createClient } from '@supabase/supabase-js';
import pg from 'pg';

const API = (process.env.API_URL ?? 'http://localhost:3333/api').replace(/\/+$/, '');

/** A GET with exactly these headers, returning the status. */
const rawStatus = (url, headers) =>
  new Promise((resolve, reject) => {
    const req = (url.startsWith('https:') ? httpsRequest : httpRequest)(url, { headers }, (res) => {
      res.resume();
      resolve(res.statusCode);
    });
    req.on('error', reject);
    req.end();
  });
// Default: a synthetic photo (red shape beside a 20 mm calibration sticker), so the check never needs patient data.
const photoPath = process.argv[2] ?? 'tools/fixtures/synthetic-wound-sticker.jpg';
if (!existsSync(photoPath)) throw new Error(`No photo at ${photoPath}.`);
const photo = readFileSync(photoPath);
const photoType = photoPath.endsWith('.png') ? 'image/png' : 'image/jpeg';

const supa = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const db = new pg.Client({ connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL });
const results = [];
const check = (name, ok, extra = '') => {
  results.push(ok);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? `  — ${extra}` : ''}`);
};
const users = [];
const clinics = [];

async function login(tag) {
  const email = `e2e-${tag}-${Date.now()}@example.com`;
  const password = `${crypto.randomUUID()}Aa1!`;
  const { data, error } = await supa.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  users.push(data.user.id);
  const anon = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: s, error: e2 } = await anon.auth.signInWithPassword({ email, password });
  if (e2) throw e2;
  return { id: data.user.id, email, token: s.session.access_token };
}

async function clinic(name, members) {
  const c = await db.query(`INSERT INTO "Clinic" (id, name, "updatedAt") VALUES (gen_random_uuid(), $1, now()) RETURNING id`, [name]);
  clinics.push(c.rows[0].id);
  for (const [user, role] of members) {
    await db.query(`INSERT INTO "User" (id, email, "updatedAt") VALUES ($1, $2, now()) ON CONFLICT (id) DO NOTHING`, [user.id, user.email]);
    await db.query(`INSERT INTO "Membership" (id, "userId", "clinicId", role, "updatedAt") VALUES (gen_random_uuid(), $1, $2, $3, now())`, [user.id, c.rows[0].id, role]);
  }
  return c.rows[0].id;
}

async function call(who, path, init = {}) {
  const headers = { ...(typeof init.body === 'string' ? { 'Content-Type': 'application/json' } : {}), ...(who ? { Authorization: `Bearer ${who.token}` } : {}), ...init.headers };
  const res = await fetch(API + path, { ...init, headers });
  const text = await res.text();
  let body = text;
  try {
    body = JSON.parse(text);
  } catch {}
  return { status: res.status, body, headers: res.headers };
}
const json = (body) => JSON.stringify(body);
const consent = { care: true, photos: true, aiTraining: false, noticeVersion: 'dpdp-1' };
const until = async (fn, ms = 90_000) => {
  const end = Date.now() + ms;
  for (;;) {
    const v = await fn();
    if (v || Date.now() > end) return v;
    await new Promise((r) => setTimeout(r, 1500));
  }
};

async function main() {
  await db.connect();
  const [adminA, doctorA, frontA, adminB, outsider] = await Promise.all(['admin-a', 'doctor-a', 'front-a', 'admin-b', 'outsider'].map(login));
  await clinic('E2E clinic A', [[adminA, 'ADMIN'], [doctorA, 'DOCTOR'], [frontA, 'FRONT_DESK']]);
  await clinic('E2E clinic B', [[adminB, 'ADMIN']]);

  // Access and roles
  check('no token → 401', (await call(null, '/patients')).status === 401);
  check('signed in but in no clinic → 403', (await call(outsider, '/patients')).status === 403);
  const me = await call(adminA, '/me');
  check('/me lists the clinic and role', me.status === 200 && me.body.memberships[0]?.role === 'ADMIN');

  // Registration (front desk), generated code, idempotent retry
  const key = crypto.randomUUID();
  const reg = (who) => call(who, '/patients', { method: 'POST', body: json({ firstName: 'Test', lastName: 'Patient', sex: 'F', ageYears: 64, consent }), headers: { 'Idempotency-Key': key } });
  const p1 = await reg(frontA);
  const p2 = await reg(frontA);
  check('front desk registers a patient with a generated code', p1.status === 201 && /^WM-\d{4}$/.test(p1.body.patientId), p1.body.patientId);
  check('a retried POST with the same Idempotency-Key returns the same patient', p2.body?.id === p1.body.id);
  check('registration without consent is refused', (await call(frontA, '/patients', { method: 'POST', body: json({ firstName: 'X', lastName: 'Y', sex: 'M', ageYears: 30 }) })).status === 400);
  const patientId = p1.body.id;
  check('front desk sees the profile but no clinical data', (await call(frontA, `/patients/${patientId}`)).body.cases === null);
  check('front desk cannot open the dashboard', (await call(frontA, '/dashboard')).status === 403);
  check('another clinic cannot see the patient', (await call(adminB, `/patients/${patientId}`)).status === 404);

  // Lists: pagination and search
  for (let i = 0; i < 27; i++) await call(doctorA, '/patients', { method: 'POST', body: json({ firstName: `Bulk${i}`, lastName: 'Row', sex: 'M', ageYears: 50, consent }) });
  const page1 = await call(doctorA, '/patients?limit=25');
  const page2 = await call(doctorA, `/patients?limit=25&cursor=${page1.body.nextCursor}`);
  check('keyset pagination: 25 + 3 with no overlap', page1.body.items.length === 25 && page2.body.items.length === 3 && !page2.body.nextCursor && !page2.body.items.some((x) => page1.body.items.find((y) => y.id === x.id)));
  check('trigram search', (await call(doctorA, '/patients?q=bulk1')).body.items.length >= 1 && (await call(doctorA, '/patients?q=patient')).body.items.length === 1);
  const etag = page1.headers.get('etag');
  // Not fetch: it adds "Cache-Control: no-cache" to conditional requests, which (rightly) disables the 304.
  const again = await rawStatus(`${API}/patients?limit=25`, { Authorization: `Bearer ${doctorA.token}`, 'If-None-Match': etag ?? '' });
  check('GET answers 304 when unchanged (ETag)', !!etag && again === 304, `etag ${etag} → ${again}`);
  check('rate-limit headers present', page1.headers.get('ratelimit-limit') === '300');

  // Wound and async visit
  const kase = await call(doctorA, '/cases', { method: 'POST', body: json({ patientId, location: 'Left heel', onset: '2026-09-15' }) });
  check('doctor opens a wound', kase.status === 201, kase.body.id);
  const caseId = kase.body.id;
  const form = new FormData();
  form.append('photo', new Blob([photo], { type: photoType }), 'wound');
  form.append('intake', json({ diabetes: 'yes', cause: 'started_on_its_own', body_location: 'heel', fever: 'no', patient_name: 'Test Patient' }));
  const started = Date.now();
  const created = await call(doctorA, `/cases/${caseId}/visits`, { method: 'POST', body: form });
  check('visit upload returns at once with status "processing"', created.status === 201 && created.body.status === 'processing', `${Date.now() - started} ms`);
  const visitId = created.body.id;
  const done = await until(async () => {
    const v = await call(doctorA, `/visits/${visitId}`);
    return v.body.status !== 'processing' ? v.body : null;
  });
  check('background analysis finishes', done?.status === 'ok', `status ${done?.status} after ${Math.round((Date.now() - started) / 1000)} s`);
  check('the trained outline model drew an outline', (done?.findings?.outline?.length ?? 0) > 0, `${done?.findings?.outline?.length ?? 0} region(s)`);
  check('size measured from the sticker (true area 9.18 cm²)', Math.abs((done?.findings?.measurement?.area_cm2 ?? 0) - 9.18) < 0.5, `${done?.findings?.measurement?.area_cm2} cm²`);
  check('diabetes + heel → diabetic foot ulcer by rule', done?.findings?.wound_type?.rule === 'diabetes and a foot location');
  check('identity never reaches the model', !('patient_name' in (done?.intake ?? {})));
  const withThumb = await until(async () => (await call(doctorA, `/visits/${visitId}`)).body.thumbUrl, 30_000);
  check('thumbnail made in the background', !!withThumb);
  const caseView = await call(doctorA, `/cases/${caseId}`);
  check('case summary updated (visit count, status, latest photo)', caseView.body.visitCount === 1 && caseView.body.status !== null && !!caseView.body.thumbUrl, `status ${caseView.body.status}`);

  // Dashboard and queue
  const dash = await call(doctorA, '/dashboard');
  check('dashboard counts', dash.status === 200 && dash.body.patients === 28 && dash.body.openWounds === 1 && dash.body.draftsToReview === 1 && dash.body.visitsPerWeek.length === 8, json({ p: dash.body.patients, d: dash.body.draftsToReview }));
  const drafts = await call(doctorA, '/queue?view=drafts');
  check('the draft is in the queue', drafts.body.items[0]?.visitId === visitId);
  check('another clinic cannot review it (not found)', (await call(adminB, `/visits/${visitId}/review`, { method: 'POST', body: json({ decision: 'approved' }) })).status === 404);
  const review = await call(doctorA, `/visits/${visitId}/review`, { method: 'POST', body: json({ decision: 'approved' }) });
  check('doctor approves the draft', review.status === 201 && review.body.decision === 'approved');
  check('reviewed only once', (await call(doctorA, `/visits/${visitId}/review`, { method: 'POST', body: json({ decision: 'approved' }) })).status === 409);
  check('queue and dashboard update at once (cache invalidated)', (await call(doctorA, '/queue/counts')).body.drafts === 0 && (await call(doctorA, '/dashboard')).body.draftsToReview === 0);

  // Share link
  const share = await call(doctorA, `/cases/${caseId}/share-links`, { method: 'POST', body: json({ days: 7 }) });
  check('share link created (URL shown once)', share.status === 201 && !!share.body.url);
  const page = await fetch(share.body.url);
  const html = await page.text();
  check('share page opens without sign-in, personal details hidden', page.status === 200 && html.includes('Patient WM-') && !html.includes('Test Patient') && (page.headers.get('content-security-policy') ?? '').includes("default-src 'none'"));
  await call(doctorA, `/share-links/${share.body.id}/revoke`, { method: 'POST' });
  check('revoked link answers 410', (await fetch(share.body.url)).status === 410);

  // Members and roles
  const members = await call(adminA, '/clinic/members');
  const doctorMembership = members.body.find((m) => m.userId === doctorA.id);
  await call(adminA, `/clinic/members/${doctorMembership.id}`, { method: 'PATCH', body: json({ role: 'FRONT_DESK' }) });
  check('a role change applies on the very next request', (await call(doctorA, '/dashboard')).status === 403);
  await call(adminA, `/clinic/members/${doctorMembership.id}`, { method: 'PATCH', body: json({ role: 'DOCTOR' }) });
  const self = members.body.find((m) => m.userId === adminA.id);
  check('the last admin cannot be demoted', (await call(adminA, `/clinic/members/${self.id}`, { method: 'PATCH', body: json({ role: 'DOCTOR' }) })).status === 409);
  check('doctors cannot manage members', (await call(doctorA, '/clinic/members')).status === 403);

  // Export and audit
  const csv = await call(adminA, '/exports/patients.csv');
  check('admin exports de-identified CSV', csv.status === 200 && String(csv.body).startsWith('patient_code,sex,age_band') && !String(csv.body).includes('Test'));
  check('doctors cannot export', (await call(doctorA, '/exports/patients.csv')).status === 403);
  await new Promise((r) => setTimeout(r, 2500)); // audit entries are flushed every 2 s
  const audit = await call(adminA, '/audit?limit=100');
  const actions = new Set(audit.body.items.map((i) => i.action));
  check('audit log has creates, reviews, shares and the export', ['patient.create', 'visit.review', 'share.create', 'export.patients', 'member.update'].every((a) => actions.has(a)), [...actions].join(','));

  // Deletes
  check('deleting the visit', (await call(doctorA, `/visits/${visitId}`, { method: 'DELETE' })).status === 204);
  const photos = await supa.storage.from('images').list(`${clinics[0]}/treatments/${done.treatmentId}`);
  check('...removes its photo and thumbnail', (photos.data ?? []).length === 0);
  check('deleting the patient', (await call(adminA, `/patients/${patientId}`, { method: 'DELETE' })).status === 204);
  check('...and it is gone from lists', (await call(adminA, `/patients/${patientId}`)).status === 404);
}

main()
  .catch((error) => {
    results.push(false);
    console.log('ERROR', error.message);
  })
  .finally(async () => {
    // Everything this check made: clinics cascade to their data; photos and logins are removed explicitly.
    for (const id of clinics) {
      const { data } = await supa.storage.from('images').list(`${id}/treatments`, { limit: 1000 });
      for (const folder of data ?? []) {
        const files = await supa.storage.from('images').list(`${id}/treatments/${folder.name}`);
        await supa.storage.from('images').remove((files.data ?? []).map((f) => `${id}/treatments/${folder.name}/${f.name}`));
      }
      await db.query(`DELETE FROM "Clinic" WHERE id = $1`, [id]);
    }
    for (const id of users) {
      await db.query(`DELETE FROM "User" WHERE id = $1`, [id]);
      await supa.auth.admin.deleteUser(id);
    }
    await db.end();
    console.log(`\n${results.filter(Boolean).length}/${results.length} checks passed`);
    process.exit(results.every(Boolean) ? 0 : 1);
  });
